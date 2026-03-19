"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { executarAnaliseManual as _executarAnaliseManual, verificarBloqueio as _verificarBloqueio } from "./pipeline_analise_manual"
import type { EtapaLog, EtapaStatus, AnaliseManualResult } from "./pipeline_analise_manual"

// Re-exporta tipos
export type { EtapaStatus, EtapaLog, AnaliseManualResult } from "./pipeline_analise_manual"

// ─── WRAPPERS (use server exige funções async definidas aqui) ─────────────────

export async function executarAnaliseManual(issueKey: string): Promise<AnaliseManualResult> {
  return _executarAnaliseManual(issueKey)
}

export async function verificarBloqueio(issueKey: string) {
  return _verificarBloqueio(issueKey)
}

// ─── BUSCAR SESSÕES ANTERIORES ────────────────────────────────────────────────

export async function buscarSessoesAnteriores(): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from("agentes_analises_manuais_sessoes")
    .select("*")
    .order("iniciado_em", { ascending: false })
    .limit(20)

  if (error) {
    console.error(`❌ [DB] Erro ao buscar sessões:`, error)
    return []
  }
  return data || []
}

export async function buscarLogsSessao(sessionId: string): Promise<EtapaLog[]> {
  const { data, error } = await supabaseAdmin
    .from("agentes_analises_manuais_log")
    .select("*")
    .eq("session_id", sessionId)
    .order("inicio", { ascending: true })

  if (error) {
    console.error(`❌ [DB] Erro ao buscar logs:`, error)
    return []
  }

  return (data || []).map(r => ({
    etapa: r.etapa_nome,
    slug: r.etapa_slug,
    status: r.status as EtapaStatus,
    mensagem: r.mensagem,
    inicio: r.inicio,
    fim: r.fim,
  }))
}

// ─── BUSCAR ANÁLISE DETALHADA ─────────────────────────────────────────────────

export interface AnaliseDetalhada {
  triagem_status?: string | null
  triagem_motivo?: string | null
  triagem_maturidade?: string | null
  triagem_recomendacao?: string | null
  triagem_elementos_presentes?: any
  triagem_elementos_ausentes?: any
  triagem_similares?: any
  triagem_at?: string | null
  pesquisador_status?: string | null
  pesquisador_conhecimento_sistema?: string | null
  pesquisador_referencias_legais?: string | null
  pesquisador_contexto_similares?: string | null
  pesquisador_intencoes_busca?: any
  pesquisador_at?: string | null
  pesquisador_feedback_juiz?: string | null
  escritor_status?: string | null
  escritor_resultado?: string | null
  escritor_resultado_editado?: string | null
  escritor_modelo?: string | null
  escritor_at?: string | null
  juiz_status?: string | null
  juiz_score?: number | null
  juiz_motivo?: string | null
  juiz_devolutiva?: string | null
  juiz_pontos_criticos?: string | null
  juiz_pontos_criticos_pesquisa?: string | null
  juiz_pontos_criticos_escrita?: string | null
  juiz_at?: string | null
  plataforma?: string | null
  desenvolvedor_jira_id?: string | null
  status_geral?: string | null
  requer_intervencao?: boolean
  intervencao_motivo?: string | null
  intervencao_humana_status?: string | null
  intervencao_humana_motivo?: string | null
  intervencao_humana_por?: string | null
  intervencao_humana_at?: string | null
  observacao_humana?: string | null
}

export async function buscarAnaliseDetalhada(issueKey: string): Promise<AnaliseDetalhada | null> {
  const { data, error } = await supabaseAdmin
    .from("agentes_analises")
    .select(`
      triagem_status, triagem_motivo, triagem_maturidade, triagem_recomendacao,
      triagem_elementos_presentes, triagem_elementos_ausentes, triagem_similares, triagem_at,
      pesquisador_status, pesquisador_conhecimento_sistema, pesquisador_referencias_legais,
      pesquisador_contexto_similares, pesquisador_intencoes_busca, pesquisador_at, pesquisador_feedback_juiz,
      escritor_status, escritor_resultado, escritor_resultado_editado, escritor_modelo, escritor_at,
      juiz_status, juiz_score, juiz_motivo, juiz_devolutiva, juiz_pontos_criticos,
      juiz_pontos_criticos_pesquisa, juiz_pontos_criticos_escrita, juiz_at,
      plataforma, desenvolvedor_jira_id,
      status_geral, requer_intervencao, intervencao_motivo,
      intervencao_humana_status, intervencao_humana_motivo, intervencao_humana_por,
      intervencao_humana_at, observacao_humana
    `)
    .eq("id_issue", issueKey)
    .single()

  if (error) {
    console.warn(`⚠️ [DB] Análise detalhada não encontrada para ${issueKey}:`, error.message)
    return null
  }
  return data as AnaliseDetalhada
}