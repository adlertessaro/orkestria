"use server"

import { createClient } from "@supabase/supabase-js"
import { buscarIssuesSmart } from "./action_smart"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const PAGE_SIZE = 30

const STATUS_LABEL_MAP: Record<string, string[]> = {
  "🟡 Recebido":               ["Backlog", "Aguardando Análise"],
  "🔎 Em Análise":             ["Análise Aceita", "Em Análise (Análise)", "Em Revisão (Análise)", "Análise Devolvida"],
  "⚙️ Em Desenvolvimento":     ["Aguardando Desenv", "Em Progresso (Desenv)", "Code Review (Desenv)", "Em andamento (DBA)", "Aguardando DBA"],
  "🧪 Em Validação":           ["Em Andamento (QA)", "Aguardando QA"],
  "🔁 Em Ajuste":              ["Não Aprovado"],
  "🔗 Aguardando Terceiros":   ["Esperando Terceiro (Desenv)", "Espera de Terceiros (QA)", "Em Espera de Terceiro (DBA)"],
  "⏸️ Pausado":                ["Em Pausa (Análise)", "Em Pausa (DBA)", "Pausado (QA)", "Pausado (Desenv)"],
  "📦 Aguardando Publicação":  ["Commit HOS FC", "Commit HOS Integrador", "Commit HOSFARMA", "Pronto para Commit", "Para Produção WEB"],
  "✅ Finalizado":              ["Concluir"],
  "❌ Cancelado":               ["Cancelar"],
}

interface Filtros {
  status: string[]
  clientes: string[]
  responsavel: string[]
  analista: string[]
  qa: string[]
  developer: string[]
  setor: string[]
}

function expandirStatus(labels: string[]): string[] {
  return labels.flatMap(l => STATUS_LABEL_MAP[l] ?? [l])
}

export async function getMembros() {
  const { data, error } = await supabase
    .from("jira_members")
    .select("nome")
    .eq("ativo", true)
    .order("nome")
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function buscarIssues(page: number, search: string, usarIA: boolean, filtros: Filtros) {
  const offset = page * PAGE_SIZE
  const statusReais = expandirStatus(filtros.status)

  // ── Delega para busca semântica ────────────────────────────────────────────
  if (usarIA && search.trim().length > 3) {
    const res = await buscarIssuesSmart(search, page, { ...filtros, status: statusReais })
    return { ...res, semantica: true }
  }

  // ── Busca textual + filtros ────────────────────────────────────────────────
  let query = supabase
    .from("jira_issues")
    .select("*", { count: "exact" })
    .order("ultima_atualizacao", { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (search.trim()) {
    const s = search.trim()
    query = query.or(
      `resumo.ilike.%${s}%,issue_key.ilike.%${s}%,analise_tecnica.ilike.%${s}%,retorno_analise.ilike.%${s}%`
    )
  }

  if (statusReais.length > 0)         query = query.in("status", statusReais)
  if (filtros.responsavel.length > 0) query = query.in("responsavel", filtros.responsavel)
  if (filtros.analista.length > 0)    query = query.in("analista_responsavel", filtros.analista)
  if (filtros.qa.length > 0)         query = query.in("qa_responsavel", filtros.qa)
  if (filtros.developer.length > 0)   query = query.in("developer", filtros.developer)
  if (filtros.setor.length > 0)       query = query.in("setor_responsavel", filtros.setor)

  if (filtros.clientes.length > 0) {
    const orClauses = filtros.clientes.flatMap(c => {
      const cnpjLimpo = c.replace(/\D/g, "")
      return [
        `razao_social.ilike.%${c}%`,
        `cnpj_cliente.ilike.%${c}%`,
        ...(cnpjLimpo && cnpjLimpo !== c ? [`cnpj_cliente.ilike.%${cnpjLimpo}%`] : []),
      ]
    })
    query = query.or(orClauses.join(","))
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    issues: data ?? [],
    hasMore: (data?.length ?? 0) >= PAGE_SIZE,
    total: count ?? 0,
    semantica: false,
  }
}

export async function getIssueDetails(issueKey: string) {
  const { data, error } = await supabase
    .from("jira_issues")
    .select("*")
    .eq("issue_key", issueKey)
    .single()
  if (error) throw new Error(error.message)
  return data
}
