"use server"

import { processarEExtrairDemandas } from "@/lib/agents/helper/action_agent_helper"
import { supabaseAdmin } from "@/lib/supabase/supabase"
import { revalidatePath } from "next/cache"

const TRELLO_API_KEY = process.env.TRELLO_API_KEY
const TRELLO_TOKEN = process.env.TRELLO_TOKEN
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID


function extrairCampo(texto: string, campo: string): string {
  if (!texto) return "Não informado";
  const regex = new RegExp(`\\*\\*${campo}\\*\\*[:\\s]*(.*)`, "i");
  const match = texto.match(regex);
  return match ? match[1].trim() : "Não informado";
}

function criarLotes(array: any[], tamanho: number) {
  const lotes = []
  for (let i = 0; i < array.length; i += tamanho) {
    lotes.push(array.slice(i, i + tamanho))
  }
  return lotes
}

async function buscarDetalhesCompletos(cardId: string) {
  const url = `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&members=true&actions=commentCard`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}


export async function sincronizarTrelloAction(p0: any) {
  let statusFinal = "Erro"
  let errorMsg = null
  let totalCardsProcessed = 0
  let currentLogId: string | null = null

  try {
    // 1. Criar o log inicial (Avisar que começou)
    const { data: logInicial, error: errorLog } = await supabaseAdmin
      .from("trello_helper_sync_logs")
      .insert({
        service_name: "Trello",
        status: "Em andamento",
        sincroniza_complete: false, // Botão vira "Cancelar"
        items_processed: 0
      })
      .select()
      .single()

    if (errorLog || !logInicial) throw new Error("Falha ao criar log no banco")
    currentLogId = logInicial.id

    // 2. Mapeamento de Listas
    const resListas = await fetch(`https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`)
    const listas = await resListas.json()
    const mapaListas = Object.fromEntries(listas.map((l: any) => [l.id, l.name]))

    // 3. Atualizar Membros
    const resMembros = await fetch(`https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`)
    const membrosBoard = await resMembros.json()
    for (const m of membrosBoard) {
      await supabaseAdmin.from("trello_members").upsert({
        id_trello: m.id,
        full_name: m.fullName,
        username: m.username
      }, { onConflict: 'id_trello' })
    }

    // 4. Buscar Cards
    const resCards = await fetch(`https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`)
    const todosCards = await resCards.json()
    const lotesDeCards = criarLotes(todosCards, 100)

    for (const lote of lotesDeCards) {
      // Verificação de Interrupção
      const { data: check } = await supabaseAdmin
        .from("trello_helper_sync_logs")
        .select("status")
        .eq("id", currentLogId)
        .single();

      if (check?.status === 'Interrompido') {
        statusFinal = "Interrompido";
        return { success: false, error: "Cancelado pelo usuário" };
      }

      const promessasDeDetalhes = lote.map((c: any) => buscarDetalhesCompletos(c.id));
      const cardsDetalhados = await Promise.all(promessasDeDetalhes);

      for (const card of cardsDetalhados) {
        if (!card) continue;

        // 1. SALVAR O CARD (A BASE DE TUDO)
        await supabaseAdmin.from("trello_cards").upsert({
          id_trello: card.id,
          id_board: card.idBoard,
          title: card.name,
          status: mapaListas[card.idList] || "Desconhecida",
          last_sync: new Date().toISOString(),
          ultima_atualizacao: card.dateLastActivity,
          description: card.desc,
          url_card: card.url || '#',
          raw_data: card,
          created_at: new Date(parseInt(card.id.substring(0, 8), 16) * 1000).toISOString()
        }, { onConflict: 'id_trello' });

        // 2. SALVAR MEMBROS
        // A tabela trello_card_members espera UM registro por membro:
        if (card.members && card.members.length > 0) {
          for (const m of card.members) {
            await supabaseAdmin.from("trello_card_members").upsert({
              id_card: card.id,
              id_member: m.id, // Salvando o ID individual, não a lista toda
              name_member: m.fullName
            }, { onConflict: 'id_card,id_member' }); // Precisamos dessa constraint no banco!
          }
        }

        // 3. SALVAR COMENTÁRIOS
        // Pegamos as 'actions' do tipo 'commentCard' que vieram no buscarDetalhesCompletos
        const comentarios = card.actions?.filter((a: any) => a.type === "commentCard") || [];
        
        if (comentarios.length > 0) {
          // Aqui unificamos os textos para caber no seu campo 'comments_text'
          const textoUnificado = comentarios.map((c: any) => c.data.text).join("\n---\n");
          
          await supabaseAdmin.from("trello_comments").upsert({
            id_trello: card.id,
            id_card: card.id,
            id_member: comentarios[0].idMemberCreator, // ID de quem comentou por último
            date_created: comentarios[0].date,
            comment_text: textoUnificado
          }, { onConflict: 'id_trello' });
        }

        totalCardsProcessed++;
      }
          // Atualiza o progresso no banco para o Polling mostrar na tela
    await supabaseAdmin
        .from("trello_helper_sync_logs")
        .update({ items_processed: totalCardsProcessed })
        .eq("id", currentLogId);
    }

    statusFinal = "Sucesso";
// --- INTEGRAÇÃO COM AGENTE ---
    // Chamamos a extração logo após o sucesso da sincronização Trello
    try {
      console.log("Iniciando extração de dados para o Agente...");
      await processarEExtrairDemandas();
      console.log("Extração concluída com sucesso.");
    } catch (agentError) {
      console.error("Erro na extração do agente, mas a sincronização Trello foi concluída:", agentError);
      // Não mudamos o statusFinal para erro aqui para não invalidar a busca do Trello que deu certo
    }

    return { success: true, count: totalCardsProcessed };

  } catch (e: any) {
    statusFinal = "Erro"
    errorMsg = e.message
    return { success: false, error: e.message }
  } finally {
    // 5. FECHAMENTO (Obrigatório): Sempre executa para liberar o botão
    if (currentLogId) {
      await supabaseAdmin.from("trello_helper_sync_logs").update({
        status: statusFinal,
        sincroniza_complete: true, // Botão volta a ser "Forçar Busca"
        items_processed: totalCardsProcessed,
        error_message: statusFinal === "Interrompido" ? "Sincronização não concluída. Interrompido pelo Usuário" : errorMsg
      }).eq("id", currentLogId)
    }
    try {
      revalidatePath("/helper/relatorios");
    } catch (e) {
      // Apenas ignora: o agendador local não possui contexto de cache web
      console.log("ℹ️ Info: Cache não revalidado no agendador local.");
    }
  }
}

// --- OUTRAS ACTIONS MANTIDAS E AJUSTADAS ---

export async function cancelarSincronizacaoAction(logId: string) {
  await supabaseAdmin
    .from("trello_helper_sync_logs")
    .update({ 
      status: 'Interrompido', 
      sincroniza_complete: true,
      error_message: "Sincronização não concluída. Interrompido pelo Usuário" 
    })
    .eq("id", logId)
  
  try {
    revalidatePath("/helper/relatorios");
  } catch (revalError) {
    console.error("Erro ao revalidar a rota após cancelar sincronização:", revalError);
  }
}

export async function buscarDadosRelatorioAction(filtros: any) {
  try {
    let query = supabaseAdmin
      .from("trello_cards")
      .select(`status, title, description, ultima_atualizacao, created_at`)
      .order("status", { ascending: false })
      .order("created_at", { ascending: false });
      

    if (filtros.status && filtros.status !== "todos") {
      query = query.eq('status', filtros.status);
    }
    if (filtros.dataInicio) query = query.gte('created_at', filtros.dataInicio);
    if (filtros.dataFim) query = query.lte('created_at', filtros.dataFim);
    if (filtros.helperId) query = query.ilike('title', `%${filtros.helperId}%`);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(card => {
      const desc = card.description || "";
      return {
        Status: card.status,
        Titulo: card.title,
        Cliente: extrairCampo(desc, "Cliente"),
        TipoAjuda: extrairCampo(desc, "Tipo da Ajuda"),
        Solicitante: extrairCampo(desc, "Solicitado por"),
        DataSolicitacao: card.created_at ? card.created_at.split('-').reverse().join('/') : "---",
        UltAtualizacao: card.ultima_atualizacao ? new Date(card.ultima_atualizacao).toLocaleDateString('pt-BR') : "---"
      };
    });
  } catch (e: any) {
    return [];
  }
}

export async function buscarLogsSincronizacao() {
  const { data, error } = await supabaseAdmin
    .from("trello_helper_sync_logs")
    .select("id, status, items_processed, error_message, created_at, sincroniza_complete")
    .order("created_at", { ascending: false })
    .limit(10)
  
  if (error) return []
  return data.map(log => ({
    id: log.id,
    Status: log.status,
    SincronizaComplete: log.sincroniza_complete,
    ItemsProcessados: log.items_processed,
    MensagemErro: log.error_message,
    DataCriacao: new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }));
}