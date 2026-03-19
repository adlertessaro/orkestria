import { supabaseAdmin } from "@/lib/supabase/supabase";
import { processarDecisaoAgente } from "./agent_service_helper";
import { sincronizarDecisaoComTrello } from "./action_sync_trello";

/**
 * Especialista em Limpeza: Busca cards "sujos" no Trello,
 * limpa os dados e prepara para a IA na tabela trello_helper_agente_demandas.
 */
export async function processarEExtrairDemandas() {
  // 1. Busca cards não enviados e que não estão concluídos
  const { data: cards, error } = await supabaseAdmin
    .from('trello_cards')
    .select('id_trello, title, description, raw_data')
    .eq('enviado_para_agente', false)
    .neq('status', 'Concluído');

  if (error) {
    console.error("Erro ao buscar cards no Trello:", error);
    return;
  }


// 2. Só entra no loop de extração SE houver cards
  if (cards && cards.length > 0) {
    for (const card of cards) {
      try {
          // VALIDAÇÃO: Se o card já tem membros no raw_data, ignoramos a extração para a IA
        const temMembros = card.raw_data?.members && card.raw_data.members.length > 0;

        if (temMembros) {
          console.log(`⏩ Pulando card ${card.id_trello}: Já possui membros atribuídos.`);
          
          // Marcamos como enviado_para_agente = true apenas para ele não ser processado novamente,
          // mas não inserimos na tabela de demandas da IA.
          await supabaseAdmin
            .from('trello_cards')
            .update({ enviado_para_agente: true })
            .eq('id_trello', card.id_trello);
            
          continue; 
        }
        // --- TRATAMENTO DO TÍTULO ---
        // Entrada: "HOS Helper - SOL-40859 - Conciliação bancária - WEB"
        // Objetivo: Remover o prefixo (HOS Helper... -) e o sufixo (- WEB)
        
        // Remove o início: "HOS Helper - SOL-XXXXX - "
        let tituloLimpo = card.title.replace(/^HOS Helper - SOL-\d+ - /i, "");
        
        // Remove o final: Tira o que vem depois do último " - "
        const partesTitulo = tituloLimpo.split(" - ");
        if (partesTitulo.length > 1) {
          partesTitulo.pop(); // Remove a última parte (ex: WEB)
          tituloLimpo = partesTitulo.join(" - ");
        }

        // --- TRATAMENTO DA DESCRIÇÃO ---
        // Objetivo: Extrair apenas o que vem após "**Descrição**:"
        const marcadorDesc = "**Descrição**:";
        const posicaoDesc = card.description.indexOf(marcadorDesc);
        let descricaoLimpa = "";

        if (posicaoDesc !== -1) {
          // Pega tudo após o marcador e remove espaços em branco extras
          descricaoLimpa = card.description.substring(posicaoDesc + marcadorDesc.length).trim();
        } else {
          descricaoLimpa = "Descrição não encontrada no formato esperado.";
        }

        // --- GRAVAÇÃO NA TABELA DE APOIO ---
        const { error: insertError } = await supabaseAdmin
          .from('trello_helper_agente_demandas')
          .upsert({
              id_card: card.id_trello,
              titulo: tituloLimpo,
              descricao: descricaoLimpa
            }, 
            { onConflict: 'id_card' }
          );

        // Se a limpeza foi salva com sucesso, marcamos o card original como processado
        if (!insertError) {
          await supabaseAdmin
            .from('trello_cards')
            .update({ enviado_para_agente: true })
            .eq('id_trello', card.id_trello);
        } else {
          console.error(`Erro ao inserir demanda limpa (Card: ${card.id_trello}):`, insertError);
        }

      } catch (err) {
        console.error(`Falha crítica no processamento do card ${card.id_trello}:`, err);
      }
    }
  }
    console.log("Iniciando inteligência do Agente...");
    await processarDecisaoAgente();

    console.log("🔗 Devolvendo informações para o Trello...");
    await sincronizarDecisaoComTrello();
}