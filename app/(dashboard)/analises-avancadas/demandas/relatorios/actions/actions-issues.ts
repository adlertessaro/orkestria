"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { extrairTextoADF, extrairCampo } from "./jira-parsers"

export async function sincronizarPaginaAction(nextPageToken?: string): Promise<{
  total: number, processados: number, nextPageToken: string | null, fim: boolean
}> {
  const JIRA_URL = process.env.JIRA_URL
  const JIRA_EMAIL = process.env.JIRA_EMAIL
  const JIRA_API_KEY = process.env.JIRA_API_KEY

  if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_KEY) return { total: 0, processados: 0, nextPageToken: null, fim: true }

  const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64")
  const baseUrl = JIRA_URL.replace(/\/$/, "")

  // ORDER BY updated DESC — issues recém-alteradas (responsável, developer, etc.)
  // são sempre sincronizadas nas primeiras páginas de cada ciclo
  const jql = "project = HOS ORDER BY updated DESC"

  const fields = "summary,status,priority,assignee,updated,created,description,customfield_10348,customfield_10390,customfield_10385,customfield_10483,customfield_10481,customfield_10384,customfield_10831,customfield_10731,customfield_10698,labels"

  const url = nextPageToken
    ? `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&nextPageToken=${nextPageToken}&fields=${fields}`
    : `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${fields}`

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Basic ${JIRA_AUTH}`, Accept: "application/json" },
    cache: "no-store",
  })

  if (!response.ok) throw new Error(`Jira erro ${response.status}: ${await response.text()}`)

  const data = await response.json()
  const issues = data.issues || []
  let processados = 0

  function extrairUsuario(campo: any): string | null {
    if (!campo) return null
    if (Array.isArray(campo)) return campo.map((u: any) => u?.displayName).filter(Boolean).join(", ") || null
    if (typeof campo === "object") return campo.displayName || null
    return null
  }

  function extrairDeveloper(campo: any): string | null {
    if (!campo) return null
    if (Array.isArray(campo)) {
      const nomes = campo.map((u: any) => u?.displayName ?? u?.name).filter(Boolean)
      return nomes.length > 0 ? nomes.join(", ") : null
    }
    if (typeof campo === "object") return campo.displayName ?? campo.name ?? null
    if (typeof campo === "string") return campo
    return null
  }

  function extrairLabels(campo: any): string[] {
    if (!campo) return []
    if (Array.isArray(campo)) return campo.filter((l: any) => typeof l === "string")
    return []
  }

  for (const issue of issues) {
    if (!issue || !issue.fields) continue
    const f = issue.fields

    const payload = {
      issue_key:            issue.key,
      resumo:               f.summary || "Sem Título",
      status:               f.status?.name || "Sem Status",
      prioridade:           f.priority?.name || "Sem Prioridade",
      responsavel:          extrairUsuario(f.assignee) ?? "Sem Responsável",
      analista_responsavel: extrairUsuario(f.customfield_10390) ?? "Sem Analista",
      qa_responsavel:       extrairUsuario(f.customfield_10385) ?? "Sem QA",
      cnpj_cliente:         f.customfield_10483 || "Sem CNPJ",
      razao_social:         f.customfield_10481 || "Sem Razão Social",
      ultima_atualizacao:   f.updated ? new Date(f.updated).toISOString() : new Date().toISOString(),
      data_criacao:         f.created ? new Date(f.created).toISOString() : new Date().toISOString(),
      setor_responsavel:    extrairCampo(f.customfield_10348) ?? "Sem Setor",
      developer:            extrairDeveloper(f.customfield_10384) ?? "Sem Developer",
      description:          extrairTextoADF(f.description?.content || []) || "Sem Description",
      analise_tecnica:      extrairTextoADF(f.customfield_10831?.content || []) || "Sem Analise Técnica",
      retorno_qa:           extrairTextoADF(f.customfield_10731?.content || []) || "Sem Retorno QA",
      retorno_analise:      extrairTextoADF(f.customfield_10698?.content || []) || "Sem Retorno Analise",
      labels:               extrairLabels(f.labels),
    }

    const { error } = await supabaseAdmin
      .from("jira_issues")
      .upsert(payload, { onConflict: "issue_key" })

    if (error) {
      console.error(`❌ Erro upsert ${issue.key}:`, error.message)
      continue
    }

    processados++
  }

  const proximoToken = data.nextPageToken || null
  const fim = data.isLast === true || !proximoToken

  console.log(`✅ issues=${issues.length} salvos=${processados} isLast=${data.isLast} nextToken=${proximoToken}`)

  return { total: issues.length, processados, nextPageToken: proximoToken, fim }
}

export async function buscarTotalIssuesAction(): Promise<number> {
  const JIRA_URL = process.env.JIRA_URL
  const JIRA_EMAIL = process.env.JIRA_EMAIL
  const JIRA_API_KEY = process.env.JIRA_API_KEY

  if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_KEY) return 0

  const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64")
  const baseUrl = JIRA_URL.replace(/\/$/, "")
  const jql = "project = HOS ORDER BY updated DESC"

  const response = await fetch(
    `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1&fields=summary`,
    {
      method: "GET",
      headers: { Authorization: `Basic ${JIRA_AUTH}`, Accept: "application/json" },
      cache: "no-store",
    }
  )

  if (!response.ok) return 0
  const data = await response.json()
  return data.total || 0
}