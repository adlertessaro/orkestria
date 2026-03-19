import { supabaseAdmin } from "@/lib/supabase/supabase";

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

export async function sincronizarDecisaoComTrello() {
  console.log("📤 Iniciando sincronização de volta para o Trello...");

  // 1. Busca demandas processadas pela IA que ainda não foram enviadas ao Trello
  const { data: demandas, error: errD } = await supabaseAdmin
    .from('trello_helper_agente_demandas')
    .select('*')
    .eq('processado', true)
    .eq('sincronizado_trello', false);

  if (errD || !demandas || demandas.length === 0) {
    console.log("Nenhuma decisão pendente de envio para o Trello.");
    return;
  }

  for (const demanda of demandas) {
    try {

      const resCheck = await fetch(`https://api.trello.com/1/cards/${demanda.id_card}?members=true&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);
      const cardAtual = await resCheck.json();

      if (cardAtual.idMembers && cardAtual.idMembers.length > 0) {
          console.log(`⚠️ Card ${demanda.id_card} já recebeu membro manualmente. Cancelando ação do Agente.`);
          // Apenas marca como sincronizado para tirar da fila
          await supabaseAdmin.from('trello_helper_agente_demandas').update({ sincronizado_trello: true }).eq('id', demanda.id);
          continue;

      }
      // 2. Busca MANUAL dos dados do membro (Já que não tem FK)
      const { data: membro, error: errM } = await supabaseAdmin
        .from('trello_helper_agentes_mapeamento_membros')
        .select('nome_exibicao, setor')
        .eq('trello_member_id', demanda.membro_escolhido)
        .single();

      if (errM || !membro) {
        console.error(`Membro ${demanda.membro_escolhido} não encontrado no mapeamento.`);
        continue;
      }

      // --- AÇÃO 1: Atribuir o Membro ao Card no Trello ---
      const urlAssign = `https://api.trello.com/1/cards/${demanda.id_card}/idMembers?value=${demanda.membro_escolhido}&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
      const resAssign = await fetch(urlAssign, { method: 'POST' });

      if (!resAssign.ok) throw new Error("Falha ao atribuir membro no Trello");

      // --- AÇÃO 2: Postar o Comentário ---
      const textoComentario = `Olá. A demanda encontra-se atualmente com o setor ${membro.setor}, com o ${membro.nome_exibicao}`;
      
      const urlComment = `https://api.trello.com/1/cards/${demanda.id_card}/actions/comments?text=${encodeURIComponent(textoComentario)}&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
      const resComment = await fetch(urlComment, { method: 'POST' });

      if (!resComment.ok) throw new Error("Falha ao postar comentário no Trello");

      // --- AÇÃO 3: Marcar como Sincronizado no Banco ---
      await supabaseAdmin
        .from('trello_helper_agente_demandas')
        .update({ sincronizado_trello: true })
        .eq('id', demanda.id);

      console.log(`✅ Trello Atualizado: ${demanda.titulo} -> ${membro.nome_exibicao}`);

    } catch (err) {
      console.error(`❌ Erro no card ${demanda.id_card}:`, err);
    }
  }
}