import { NextResponse } from "next/server"
import { buscarSessoesAnteriores, buscarLogsSessao, buscarAnaliseDetalhada } from "../../action_analise_manual"

export const dynamic = "force-dynamic"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface DadosEtapa {
  triagem_status?: string | null
  triagem_motivo?: string | null
  triagem_maturidade?: string | null
  triagem_recomendacao?: string | null
  triagem_elementos_presentes?: any
  triagem_elementos_ausentes?: any
  triagem_similares?: any
  pesquisador_intencoes_busca?: any
  pesquisador_feedback_juiz?: string | null
  escritor_modelo?: string | null
  escritor_resultado?: string | null
  escritor_resultado_editado?: string | null
  juiz_score?: number | null
  juiz_motivo?: string | null
  juiz_devolutiva?: string | null
  juiz_pontos_criticos?: string | null
  juiz_pontos_criticos_pesquisa?: string | null
  juiz_pontos_criticos_escrita?: string | null
  plataforma?: string | null
  desenvolvedor_jira_id?: string | null
  intervencao_motivo?: string | null
  intervencao_humana_status?: string | null
  intervencao_humana_motivo?: string | null
  intervencao_humana_por?: string | null
  observacao_humana?: string | null
}

export interface EtapaRica {
  etapa: string
  slug: string
  status: string
  mensagem?: string
  inicio?: string
  fim?: string
  duracao?: number
  dados?: DadosEtapa
}

interface HistoricoItem {
  id: string
  issue: string
  dataHora: string
  sucesso: boolean
  duracao: number
  status: string
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function calcDuracao(inicio?: string | null, fim?: string | null): number | undefined {
  if (!inicio || !fim) return undefined
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000)
}

function dadosDaEtapa(slug: string, analise: any): DadosEtapa | undefined {
  if (!analise) return undefined
  switch (slug) {
    case "triagem":
      return {
        triagem_status: analise.triagem_status,
        triagem_motivo: analise.triagem_motivo,
        triagem_maturidade: analise.triagem_maturidade,
        triagem_recomendacao: analise.triagem_recomendacao,
        triagem_elementos_presentes: analise.triagem_elementos_presentes,
        triagem_elementos_ausentes: analise.triagem_elementos_ausentes,
        triagem_similares: analise.triagem_similares,
      }
    case "pesquisador":
      return {
        pesquisador_intencoes_busca: analise.pesquisador_intencoes_busca,
        pesquisador_feedback_juiz: analise.pesquisador_feedback_juiz,
      }
    case "escritor":
      return {
        escritor_modelo: analise.escritor_modelo,
        escritor_resultado: analise.escritor_resultado,
        escritor_resultado_editado: analise.escritor_resultado_editado,
      }
    case "juiz":
      return {
        juiz_score: analise.juiz_score,
        juiz_motivo: analise.juiz_motivo,
        juiz_devolutiva: analise.juiz_devolutiva,
        juiz_pontos_criticos: analise.juiz_pontos_criticos,
        juiz_pontos_criticos_pesquisa: analise.juiz_pontos_criticos_pesquisa,
        juiz_pontos_criticos_escrita: analise.juiz_pontos_criticos_escrita,
      }
    case "mapeador":
      return {
        plataforma: analise.plataforma,
        desenvolvedor_jira_id: analise.desenvolvedor_jira_id,
      }
    default:
      return undefined
  }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    console.log(`[Historico API] GET request - sessionId: ${sessionId}`)

    // ── Modo detalhado: ?sessionId=xxx ──────────────────────────────────────
    if (sessionId) {
      const logs = await buscarLogsSessao(sessionId)

      // Extrai o issueKey do sessionId (formato: manual_HOS-XXX_timestamp)
      const issueKeyMatch = sessionId.match(/^manual_(HOS-\d+)_/)
      const issueKey = issueKeyMatch?.[1] ?? null

      const analise = issueKey ? await buscarAnaliseDetalhada(issueKey) : null

      const etapas: EtapaRica[] = logs.map((log) => ({
        etapa: log.etapa,
        slug: log.slug,
        status: log.status,
        mensagem: log.mensagem,
        inicio: log.inicio,
        fim: log.fim,
        duracao: calcDuracao(log.inicio, log.fim),
        dados: dadosDaEtapa(log.slug, analise),
      }))

      console.log(`[Historico API] Retornando ${etapas.length} etapas para ${issueKey}`)
      return NextResponse.json(etapas)
    }

    // ── Modo lista ──────────────────────────────────────────────────────────
    const sessoes = await buscarSessoesAnteriores()

    const historico: HistoricoItem[] = sessoes.map((sessao) => ({
      id: sessao.session_id,
      issue: sessao.id_issue,
      dataHora: sessao.iniciado_em,
      sucesso: sessao.status === "concluido",
      duracao: calcDuracao(sessao.iniciado_em, sessao.finalizado_em) ?? 0,
      status: sessao.status,
    }))

    console.log(`[Historico API] Retornando ${historico.length} sessões`)
    return NextResponse.json(historico)

  } catch (error: any) {
    console.error("❌ [Historico API] Erro:", error)
    return NextResponse.json(
      { error: "Erro ao buscar histórico", details: error.message },
      { status: 500 }
    )
  }
}