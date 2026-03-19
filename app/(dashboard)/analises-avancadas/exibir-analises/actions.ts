
"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { revalidatePath } from "next/cache"

const PAGE_SIZE = 30

// ─── BUSCAR ───────────────────────────────────────────────────────────────────

export async function buscarAnalises(
  page: number,
  search: string,
  filtros: {
    status: string[]
    triagem: string[]
    juiz: string[]
    intervencao: boolean
  }
) {
  let query = supabaseAdmin
    .from("agentes_analises")
    .select(`
      *,
      jira_issues_agente_demandas!agentes_analises_id_issue_fkey(titulo, descricao)
    `, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (search) query = query.ilike("id_issue", `%${search}%`)
  if (filtros.status.length > 0) query = query.in("status_geral", filtros.status)
  if (filtros.triagem.length > 0) query = query.in("triagem_status", filtros.triagem)
  if (filtros.juiz.length > 0) query = query.in("juiz_status", filtros.juiz)
  if (filtros.intervencao) query = query.eq("precisa_intervencao_humana", true)

  const { data, count } = await query

  return {
    analises: data || [],
    total: count || 0,
    hasMore: (data?.length || 0) === PAGE_SIZE,
  }
}

// ─── APROVAR MANUALMENTE ──────────────────────────────────────────────────────

export async function aprovarManualmente(
  idIssue: string,
  motivo: string,
  por: string
) {
  // Busca o resultado do escritor (editado tem prioridade)
  const { data: analise } = await supabaseAdmin
    .from("agentes_analises")
    .select("escritor_resultado, escritor_resultado_editado, juiz_devolutiva")
    .eq("id_issue", idIssue)
    .single()

  const documento = analise?.escritor_resultado_editado || analise?.escritor_resultado || ""

  // Insere em documentos_finais com flag manual
  await supabaseAdmin.from("documentos_finais").insert({
    tipo_documento: "Análise de Negócio",
    retorno_analisador: documento,
    retorno_revisor: analise?.juiz_devolutiva || null,
    aprovado_manualmente: true,
    aprovado_por: por,
  })

  // Atualiza agentes_analises
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: idIssue,
      juiz_status: "aprovado_manual",
      status_geral: "Aprovado",
      precisa_intervencao_humana: false,
      intervencao_humana_status: "aprovado",
      intervencao_humana_motivo: motivo,
      intervencao_humana_por: por,
      intervencao_humana_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .update({ processado: true })
    .eq("id_issue", idIssue)

  revalidatePath("/analises")
}

// ─── REPROVAR MANUALMENTE ─────────────────────────────────────────────────────

export async function reprovarManualmente(
  idIssue: string,
  motivo: string,
  por: string
) {
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: idIssue,
      juiz_status: "reprovado_manual",
      status_geral: "Bloqueado",
      requer_intervencao: false,
      intervencao_humana_status: "reprovado",
      intervencao_humana_motivo: motivo,
      intervencao_humana_por: por,
      intervencao_humana_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  revalidatePath("/analises")
}

// ─── SALVAR EDIÇÃO DO ESCRITOR ────────────────────────────────────────────────

export async function salvarEdicaoEscritor(
  idIssue: string,
  texto: string,
  por: string
) {
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: idIssue,
      escritor_resultado_editado: texto,
      intervencao_humana_por: por,
      intervencao_humana_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  revalidatePath("/analises")
}

// ─── SALVAR OBSERVAÇÃO ────────────────────────────────────────────────────────

export async function salvarObservacao(
  idIssue: string,
  observacao: string,
  por: string
) {
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: idIssue,
      observacao_humana: observacao,
      intervencao_humana_por: por,
      intervencao_humana_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  revalidatePath("/analises")
}

// ─── FORÇAR REPROCESSAMENTO ───────────────────────────────────────────────────

export async function forcarReprocessamento(
  idIssue: string,
  from: "triagem" | "pesquisador" | "escritor" | "juiz",
  por: string
) {
  const limpar: Record<string, any> = {
    intervencao_humana_status: "reprocessamento_forcado",
    intervencao_humana_por: por,
    intervencao_humana_at: new Date().toISOString(),
    status_geral: "em_andamento",
    requer_intervencao: false,
    updated_at: new Date().toISOString(),
  }

  if (from === "triagem") {
    Object.assign(limpar, {
      triagem_status: null, triagem_motivo: null, triagem_at: null,
      triagem_maturidade: null, triagem_elementos_presentes: null,
      triagem_elementos_ausentes: null, triagem_similares: null,
      pesquisador_status: null, pesquisador_at: null,
      escritor_status: null, escritor_resultado: null, escritor_at: null,
      juiz_status: null, juiz_score: null, juiz_at: null,
      juiz_pontos_criticos: null, juiz_devolutiva: null,
    })
  } else if (from === "pesquisador") {
    Object.assign(limpar, {
      pesquisador_status: null, pesquisador_at: null, pesquisador_feedback_juiz: null,
      escritor_status: null, escritor_resultado: null, escritor_at: null,
      juiz_status: null, juiz_score: null, juiz_at: null,
      juiz_pontos_criticos: null, juiz_devolutiva: null,
    })
  } else if (from === "escritor") {
    Object.assign(limpar, {
      escritor_status: null, escritor_resultado: null, escritor_at: null,
      juiz_status: null, juiz_score: null, juiz_at: null,
      juiz_pontos_criticos: null, juiz_devolutiva: null,
    })
  } else if (from === "juiz") {
    Object.assign(limpar, {
      juiz_status: null, juiz_score: null, juiz_at: null,
      juiz_pontos_criticos: null, juiz_devolutiva: null,
    })
  }

  await supabaseAdmin
    .from("agentes_analises")
    .upsert({ id_issue: idIssue, ...limpar }, { onConflict: "id_issue" })

  revalidatePath("/analises")
}
