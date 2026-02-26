"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { revalidatePath } from "next/cache"

const TRELLO_API_KEY = process.env.TRELLO_API_KEY
const TRELLO_TOKEN = process.env.TRELLO_TOKEN
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID


function extrairCampo(texto: string, campo: string): string {
  if (!texto) return "Não informado";
  // Procura pelo padrão **Campo** seguido de qualquer texto até o fim da linha
  const regex = new RegExp(`\\*\\*${campo}\\*\\*[:\\s]*(.*)`, "i");
  const match = texto.match(regex);
  return match ? match[1].trim() : "Não informado";
}

// Função auxiliar para criar as "caixas" de 100 itens
function criarLotes(array: any[], tamanho: number) {
  const lotes = []
  for (let i = 0; i < array.length; i += tamanho) {
    lotes.push(array.slice(i, i + tamanho))
  }
  return lotes
}

// Busca os detalhes profundos de um único card
async function buscarDetalhesCompletos(cardId: string) {
  const url = `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&members=true&actions=commentCard`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

export async function sincronizarTrelloAction() {
  let status = "Sucesso"
  let errorMsg = null
  let totalCardsProcessed = 0

  try {
    // 1. Mapeamento de Listas (Colunas do Trello)
    const resListas = await fetch(
      `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    )
    const listas = await resListas.json()
    const mapaListas = Object.fromEntries(listas.map((l: any) => [l.id, l.name]))

    // 2. Atualizar cadastro de membros do board
    const resMembros = await fetch(
      `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    )
    const membrosBoard = await resMembros.json()
    for (const m of membrosBoard) {
      await supabaseAdmin.from("trello_members").upsert({
        id_trello: m.id,
        full_name: m.fullName,
        username: m.username
      }, { onConflict: 'id_trello' })
    }

    // 3. Pegar a lista de todos os cards (apenas IDs e informações básicas)
    const resCards = await fetch(
      `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    )
    const todosCards = await resCards.json()
    
    // 4. Dividir em lotes de 100 para não sobrecarregar a API nem o servidor
    const lotesDeCards = criarLotes(todosCards, 100)

    for (const lote of lotesDeCards) {
      // O Promise.all faz com que todos os 100 cards do lote sejam buscados ao mesmo tempo
      const promessasDeDetalhes = lote.map((c: any) => buscarDetalhesCompletos(c.id))
      const cardsDetalhados = await Promise.all(promessasDeDetalhes)

      for (const card of cardsDetalhados) {
        if (!card) continue

        // Salva o card principal
        await supabaseAdmin.from("trello_cards").upsert({
          id_trello: card.id,
          id_board: card.idBoard,
          title: card.name,
          status: mapaListas[card.idList] || "Desconhecida",
          last_sync: new Date().toISOString(),
          ultima_atualizacao: card.dateLastActivity,
          description: card.desc,
          raw_data: card,
          // Extrai a data de criação diretamente do ID hexadecimal do Trello
          created_at: new Date(parseInt(card.id.substring(0, 8), 16) * 1000).toISOString()
        }, { onConflict: 'id_trello' })


        // Salva os vínculos de membros do card
        if (card.members) {
          for (const m of card.members) {
            await supabaseAdmin.from("trello_card_members").upsert({
              id_card: card.id,
              id_member: m.id,
              name_member: m.fullName
            }, { onConflict: 'id_card, id_member' })
          }
        }

        // Salva os comentários
        if (card.actions) {
          const comentarios = card.actions.filter((a: any) => a.type === "commentCard")
          for (const comm of comentarios) {
            await supabaseAdmin.from("trello_comments").upsert({
              id_trello: comm.id,
              id_card: card.id,
              id_member: comm.idMemberCreator,
              comment_text: comm.data.text,
              date_created: comm.date
            }, { onConflict: 'id_trello' })
          }
        }
        totalCardsProcessed++
      }
    }

    return { success: true, count: totalCardsProcessed }

  } catch (e: any) {
    status = "Erro"
    errorMsg = e.message
    return { success: false, error: e.message }
  } finally {
    // Log de telemetria
    await supabaseAdmin.from("trello_helper_sync_logs").insert({
      service_name: "Trello",
      status: status,
      items_processed: totalCardsProcessed,
      error_message: errorMsg
    })
    revalidatePath("/helper/relatorios")
  }
}

export async function buscarDadosRelatorioAction(filtros: any) {
  try {
    // Iniciamos a query selecionando os campos necessários
    let query = supabaseAdmin
      .from("trello_cards")
      .select(`status, title, description, ultima_atualizacao, created_at`);

    // --- LOGICA DE FILTRO CUMULATIVO (E) ---
    
    // 1. Filtro de Status: Se não for 'todos', aplica obrigatoriamente
    if (filtros.status && filtros.status !== "todos") {
      query = query.eq('status', filtros.status);
    }

    // 2. Filtro de Data Inicial (BETWEEN PARTE 1)
    if (filtros.dataInicio) {
      query = query.gte('created_at', filtros.dataInicio);
    }

    // 3. Filtro de Data Final (BETWEEN PARTE 2)
    if (filtros.dataFim) {
      query = query.lte('created_at', filtros.dataFim);
    }

    // 4. Filtro de Nome (Opcional)
    if (filtros.helperId) {
      query = query.ilike('title', `%${filtros.helperId}%`);
    }

    // Executa a query final com todos os filtros aplicados simultaneamente
    const { data, error } = await query;

    if (error) {
      console.error("Erro Supabase:", error.message);
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Mapeamento dos dados para o PDF
    return data.map(card => {
      const desc = card.description || "";
      
      // Como o campo no banco agora é DATE (YYYY-MM-DD), formatamos direto
      const dataFormatada = card.created_at 
        ? card.created_at.split('-').reverse().join('/') 
        : "---";

      return {
        Status: card.status,
        Titulo: card.title,
        Cliente: extrairCampo(desc, "Cliente"),
        TipoAjuda: extrairCampo(desc, "Tipo da Ajuda"),
        Solicitante: extrairCampo(desc, "Solicitado por"),
        DataSolicitacao: dataFormatada,
        UltAtualizacao: card.ultima_atualizacao 
          ? new Date(card.ultima_atualizacao).toLocaleDateString('pt-BR') 
          : "---"
      };
    });

  } catch (e: any) {
    console.error("Falha Crítica no Filtro:", e.message);
    return [];
  }
}

export async function buscarLogsSincronizacao() {
  const { data, error } = await supabaseAdmin
    .from("trello_helper_sync_logs")
    .select("status, items_processed, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(10)
  
  if (error) return []
  return data.map(log => ({
    Status: log.status,
    ItemsProcessados: log.items_processed,
    MensagemErro: log.error_message,
    DataCriacao: new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }));
}