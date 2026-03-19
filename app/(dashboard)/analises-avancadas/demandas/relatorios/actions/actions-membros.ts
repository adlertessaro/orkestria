"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function sincronizarMembrosAction() {
  const JIRA_URL = process.env.JIRA_URL
  const JIRA_EMAIL = process.env.JIRA_EMAIL
  const JIRA_API_KEY = process.env.JIRA_API_KEY

  if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_KEY) return

  const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64")
  const baseUrl = JIRA_URL.replace(/\/$/, "")
  let startAt = 0
  const PAGE_SIZE = 50

  while (true) {
    const response = await fetch(
      `${baseUrl}/rest/api/3/users/search?maxResults=${PAGE_SIZE}&startAt=${startAt}`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${JIRA_AUTH}`, Accept: "application/json" },
        cache: "no-store"
      }
    )

    if (!response.ok) break

    const membros = await response.json()
    if (!membros || membros.length === 0) break

    for (const membro of membros) {
      if (!membro.accountId || membro.accountType !== "atlassian") continue
      await supabaseAdmin.from("jira_members").upsert({
        jira_account_id: membro.accountId,
        nome: membro.displayName || "Sem Nome",
        email: membro.emailAddress || null,
        cargo: membro.jobTitle || null,
        ativo: membro.active ?? true,
      }, { onConflict: "jira_account_id" })
    }

    console.log(`👥 Membros startAt=${startAt} — ${membros.length} processados`)
    startAt += PAGE_SIZE
    if (membros.length < PAGE_SIZE) break
  }
}
