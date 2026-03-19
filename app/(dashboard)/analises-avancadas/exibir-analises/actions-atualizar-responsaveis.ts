"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { revalidatePath } from "next/cache"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface JiraMember {
  accountId: string
  displayName: string
  emailAddress?: string
  avatarUrl?: string
}

export interface ResponsaveisPayload {
  responsavel?: string | null        // assignee (accountId)
  analista_responsavel?: string | null // customfield_10390 (accountId)
  qa_responsavel?: string | null      // customfield_10385 (accountId)
  developer?: string | null           // customfield_10384 (accountId)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getJiraConfig() {
  const email  = process.env.JIRA_EMAIL
  const apiKey = process.env.JIRA_API_KEY
  const url    = process.env.JIRA_URL

  if (!email || !apiKey || !url) {
    throw new Error("Variáveis de ambiente Jira ausentes: JIRA_EMAIL, JIRA_API_KEY ou JIRA_URL")
  }

  return {
    auth: Buffer.from(`${email}:${apiKey}`).toString("base64"),
    baseUrl: url.replace(/\/$/, ""),
  }
}

// ─── BUSCAR MEMBROS DO PROJETO JIRA ──────────────────────────────────────────

export async function buscarMembrosJira(): Promise<JiraMember[]> {
  try {
    const { auth, baseUrl } = getJiraConfig()

    // Busca usuários atribuíveis ao projeto HOS
    const response = await fetch(
      `${baseUrl}/rest/api/3/user/assignable/search?project=HOS&maxResults=100`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      console.warn(`⚠️ Falha ao buscar membros do Jira (${response.status})`)
      return []
    }

    const data: any[] = await response.json()

    return data
      .filter((u) => u.accountType === "atlassian" && u.active)
      .map((u) => ({
        accountId: u.accountId,
        displayName: u.displayName,
        emailAddress: u.emailAddress,
        avatarUrl: u.avatarUrls?.["24x24"],
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  } catch (err: any) {
    console.error("❌ buscarMembrosJira:", err.message)
    return []
  }
}

// ─── ATUALIZAR RESPONSÁVEIS NO JIRA + SUPABASE ────────────────────────────────

export async function atualizarResponsaveisJira(
  issueKey: string,
  payload: ResponsaveisPayload,
  nomes: {
    responsavel?: string
    analista_responsavel?: string
    qa_responsavel?: string
    developer?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { auth, baseUrl } = getJiraConfig()

    // Monta os fields para o Jira apenas com os campos que foram preenchidos
    const fields: Record<string, any> = {}

    if (payload.responsavel !== undefined) {
      fields.assignee = payload.responsavel ? { id: payload.responsavel } : null
    }

    if (payload.analista_responsavel !== undefined) {
      fields.customfield_10390 = payload.analista_responsavel
        ? { id: payload.analista_responsavel }
        : null
    }

    if (payload.qa_responsavel !== undefined) {
      fields.customfield_10385 = payload.qa_responsavel
        ? { id: payload.qa_responsavel }
        : null
    }

    if (payload.developer !== undefined) {
      // customfield_10384 é array no Jira
      fields.customfield_10384 = payload.developer
        ? [{ id: payload.developer }]
        : []
    }

    if (Object.keys(fields).length === 0) {
      return { success: true } // nada a atualizar
    }

    console.log(`📝 [Responsáveis] Atualizando ${issueKey}...`, Object.keys(fields))

    const jiraResponse = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    })

    if (!jiraResponse.ok) {
      let detail = "sem detalhes"
      try { detail = await jiraResponse.text() } catch (_) {}
      throw new Error(`Jira retornou ${jiraResponse.status}: ${detail.slice(0, 200)}`)
    }

    console.log(`✅ [Responsáveis] ${issueKey} atualizado no Jira`)

    // Sincroniza no Supabase com os nomes em texto
    const supabaseUpdate: Record<string, any> = {
      ultima_atualizacao: new Date().toISOString(),
    }

    if (nomes.responsavel !== undefined)
      supabaseUpdate.responsavel = nomes.responsavel || "Sem Responsável"

    if (nomes.analista_responsavel !== undefined)
      supabaseUpdate.analista_responsavel = nomes.analista_responsavel || "Sem Analista"

    if (nomes.qa_responsavel !== undefined)
      supabaseUpdate.qa_responsavel = nomes.qa_responsavel || "Sem QA"

    if (nomes.developer !== undefined)
      supabaseUpdate.developer = nomes.developer || "Sem Developer"

    await supabaseAdmin
      .from("jira_issues")
      .update(supabaseUpdate)
      .eq("issue_key", issueKey)

    console.log(`✅ [Responsáveis] ${issueKey} sincronizado no Supabase`)

    revalidatePath("/analises")
    return { success: true }
  } catch (err: any) {
    console.error(`❌ [Responsáveis] Falha em ${issueKey}:`, err.message)
    return { success: false, error: err.message }
  }
}