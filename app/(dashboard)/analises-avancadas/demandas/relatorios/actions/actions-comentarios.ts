"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"
import { extrairTextoADF } from "./jira-parsers"

export async function sincronizarComentariosJiraAction() {
  const JIRA_URL = process.env.JIRA_URL
  const JIRA_EMAIL = process.env.JIRA_EMAIL
  const JIRA_API_KEY = process.env.JIRA_API_KEY

  if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_KEY) return

  const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64")
  const baseUrl = JIRA_URL.replace(/\/$/, "")

  const { data: issues } = await supabaseAdmin.from("jira_issues").select("id, issue_key")
  if (!issues || issues.length === 0) return

  let total = 0

  for (const issue of issues) {
    try {
      const response = await fetch(
        `${baseUrl}/rest/api/3/issue/${issue.issue_key}/comment?maxResults=100`,
        {
          method: "GET",
          headers: { Authorization: `Basic ${JIRA_AUTH}`, Accept: "application/json" },
          cache: "no-store"
        }
      )

      if (!response.ok) continue

      const data = await response.json()
      const comentarios = data.comments || []

      for (const comentario of comentarios) {
        const corpo = extrairTextoADF(comentario.body?.content || []) || null

        const { data: existe } = await supabaseAdmin
          .from("jira_comments")
          .select("id")
          .eq("issue_id", issue.id)
          .eq("data_criacao", comentario.created)
          .eq("autor", comentario.author?.displayName || "Desconhecido")
          .maybeSingle()

        if (!existe) {
          await supabaseAdmin.from("jira_comments").insert({
            issue_id: issue.id,
            autor: comentario.author?.displayName || "Desconhecido",
            corpo_comentario: corpo,
            data_criacao: comentario.created || new Date().toISOString(),
          })
          total++
        }
      }
    } catch (err: any) {
      console.error(`❌ [Comentários] Erro em ${issue.issue_key}:`, err.message)
    }
  }

  console.log(`✅ [Comentários] ${total} novos comentários sincronizados.`)
}
