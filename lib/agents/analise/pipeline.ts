import { supabaseAdmin } from "@/lib/supabase/supabase"
import { agenteTriagem } from "./03-triagem"
import { agentePesquisador } from "./04-pesquisador"
import { agenteAnalistaEscritor } from "./05-analista-escritor"
import { agenteRevisorJuiz } from "./06-revisor-juiz"
import { agenteMapeadorDev } from "./07-classificador-issue"
import { postarRespostaJiraAutomatico } from "@/app/(dashboard)/analises-avancadas/exibir-analises/actions-postar-jira"

interface PipelineMetrics {
  triagem: number
  pesquisadas: number
  escritas: number
  mapeadas: number
  postadas: number
  erros: string[]
}

export async function executarPipelineAgentes(): Promise<PipelineMetrics> {
  console.log("🚀 [Pipeline] Iniciando motor de inteligência e postagem...")

  const metrics: PipelineMetrics = {
    triagem: 0,
    pesquisadas: 0,
    escritas: 0,
    mapeadas: 0,
    postadas: 0,
    erros: [],
  }

  try {
    // ─── BLOCO 1: FLUXO DE INTELIGÊNCIA (ANÁLISE) ──────────────────────────
    const { data: issuesElegiveis, error: triagemError } = await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .select("id_issue")
      .eq("processado", false)
      .in("status", ["Backlog", "Aguardando Análise"])
      .eq("aguardando_processar", false) // Pula se já aguardando mapeamento/postagem

    if (triagemError) {
      metrics.erros.push(`Erro buscando issues elegíveis: ${triagemError.message}`)
      console.error("❌ [Pipeline] Erro na triagem:", triagemError)
      return metrics
    }

    if (issuesElegiveis?.length) {
      const issueKeys = issuesElegiveis.map((i) => i.id_issue)
      console.log(`📥 Processando inteligência para ${issueKeys.length} issues...`)
      metrics.triagem = issueKeys.length

      // 1. Triagem (filtra e pode aprovar/cancelar)
      const aprovadasTriagem = await agenteTriagem(issueKeys)

      if (aprovadasTriagem.length > 0) {
        // 2. Pesquisador
        const pesquisadas = await agentePesquisador(aprovadasTriagem)
        metrics.pesquisadas = pesquisadas.length

        // 3. Escritor
        const escritas = await agenteAnalistaEscritor(pesquisadas)
        metrics.escritas = escritas.length

        // 4. Juiz (seta aguardando_processar = true se aprovar)
        await agenteRevisorJuiz(escritas)
      }
    }

    // ─── BLOCO 2: FLUXO DE FINALIZAÇÃO (LOGÍSTICA E JIRA) ───────────────────
    const { data: prontasParaPostar, error: finalizacaoError } = await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .select("id_issue")
      .eq("aguardando_processar", true)

    if (finalizacaoError) {
      metrics.erros.push(`Erro buscando issues para finalização: ${finalizacaoError.message}`)
      console.error("❌ [Pipeline] Erro na finalização:", finalizacaoError)
      return metrics
    }

    if (prontasParaPostar?.length) {
      console.log(`🎯 [Finalização] ${prontasParaPostar.length} issues prontas para Jira.`)
      metrics.mapeadas = prontasParaPostar.length

      // Processa em paralelo (limitado a 3 simultâneas para não sobrecarregar Jira/Supabase)
      const processarFinalizacao = async (issueKey: string) => {
        try {
          // 5. Mapeador: Define plataforma e dev
          await agenteMapeadorDev(issueKey)

          // 6. Postador: Carimba no Jira e baixa a bandeira
          const resultadoPostagem = await postarRespostaJiraAutomatico(issueKey)
          if (resultadoPostagem.success) {
            metrics.postadas++
          } else {
            metrics.erros.push(`Postagem falhou ${issueKey}: ${resultadoPostagem.error}`)
          }
        } catch (err: any) {
          metrics.erros.push(`Processamento ${issueKey} falhou: ${err.message}`)
          console.error(`❌ [Pipeline] Issue ${issueKey}:`, err.message)
        }
      }

      // Batch de 3 para não sobrecarregar
      const chunkSize = 3
      for (let i = 0; i < prontasParaPostar.length; i += chunkSize) {
        const chunk = prontasParaPostar.slice(i, i + chunkSize).map((p) => p.id_issue)
        await Promise.all(chunk.map(processarFinalizacao))
      }
    } else {
      console.log("🏁 [Pipeline] Nenhuma issue pendente de postagem.")
    }

    console.log("📊 [Pipeline] Métricas:", metrics)
    return metrics

  } catch (err: any) {
    const errorMsg = `💥 [Pipeline] Erro crítico: ${err.message}`
    console.error(errorMsg)
    metrics.erros.push(errorMsg)
    return metrics
  }
}
