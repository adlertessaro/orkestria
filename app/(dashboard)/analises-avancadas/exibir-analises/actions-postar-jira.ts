import { supabaseAdmin } from "@/lib/supabase/supabase"

const ID_JIRA_GABRIEL_ZAMBONI = "70121:77db4c46-5a5a-4ba5-8ae1-818d4a0a2b69"
const ID_JIRA_FRANCIS        = "70121:580b60a2-3e4d-4d8e-a075-dae34f30ba3c"
const ID_JIRA_ANALISTA       = "70121:b53ee24f-7d96-476c-91fb-1a2898140c73"

const TRANSICOES_APROVACAO    = ["36", "4", "29", "10"]
const TRANSICOES_CANCELAMENTO = ["36", "4", "29", "9"]

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

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Tenta executar a transição — se falhar, loga e segue para a próxima
async function executarTransicao(
  issueKey: string,
  transicaoId: string,
  auth: string,
  baseUrl: string
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transition: { id: transicaoId } }),
    })

    if (!response.ok) {
      let errorDetail = "sem detalhes"
      try { errorDetail = await response.text() } catch (_) {}
      console.warn(`  → ⚠️ Transição ${transicaoId} falhou (${response.status}): ${errorDetail.slice(0, 150)} — pulando`)
      return
    }

    console.log(`  → ✅ Transição ${transicaoId} executada`)
    await esperar(1500) // aguarda Jira processar antes da próxima transição
  } catch (err: any) {
    console.warn(`  → ⚠️ Transição ${transicaoId} erro inesperado: ${err.message} — pulando`)
  }
}

// ─── FLUXO DE CANCELAMENTO ────────────────────────────────────────────────────
// Chamado para issues canceladas pela triagem (duplicata ou muito similar)

async function processarIssueCancelada(
  issueKey: string,
  auth: string,
  baseUrl: string
): Promise<void> {
  console.log(`🚫 [Jira-Auto] Processando cancelamento de ${issueKey}...`)

  // Busca o retorno_analise gerado pela triagem
  const { data: issueData } = await supabaseAdmin
    .from("jira_issues")
    .select("retorno_analise")
    .eq("issue_key", issueKey)
    .single()

  const MENSAGEM_PADRAO_MATURIDADE = `⛔⛔
A ideia não está sendo aceita, pois a solicitação apresentada possui descrição insuficiente e imaturidade na definição do que realmente se deseja alterar ou implementar.
Durante a análise, não foram identificadas informações claras sobre o cenário, regra de negócio impactada ou comportamento esperado do sistema, o que impede a validação técnica e a realização de testes consistentes.
Para que a equipe consiga avaliar corretamente, é importante detalhar melhor o contexto, exemplos práticos e o resultado esperado.
Caso novas informações ou evidências sejam reunidas, orientamos que uma nova ideia seja aberta com a descrição mais completa para uma nova análise.`

  const textoRetorno = issueData?.retorno_analise || MENSAGEM_PADRAO_MATURIDADE

  if (!issueData?.retorno_analise) {
    console.log(`  → ℹ️ ${issueKey} sem retorno_analise — usando mensagem padrão de maturidade`)
  }

  // Define analista e posta no retorno_analise (customfield_10698)
  const camposUpdate = {
    fields: {
      customfield_10390: { id: ID_JIRA_ANALISTA },
      customfield_10698: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: textoRetorno }],
          },
        ],
      },
    },
  }

  const jiraResponse = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(camposUpdate),
  })

  if (!jiraResponse.ok) {
    let errorDetail = "sem detalhes"
    try { errorDetail = await jiraResponse.text() } catch (_) {}
    console.error(`  → ❌ Falha ao atualizar campos de ${issueKey} (${jiraResponse.status}): ${errorDetail.slice(0, 150)}`)
  } else {
    console.log(`  → ✅ Campos de cancelamento atualizados em ${issueKey}`)
  }

  // Executa transições de cancelamento (36 → 4 → 29 → 9)
  console.log(`  → Executando transições de cancelamento em ${issueKey}...`)
  for (const transicaoId of TRANSICOES_CANCELAMENTO) {
    await executarTransicao(issueKey, transicaoId, auth, baseUrl)
  }

  // Marca como processado no banco
  await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .update({
      aguardando_processar: false,
      sincronizado_jira: true,
      processado: true,
    })
    .eq("id_issue", issueKey)

  await supabaseAdmin.from("jira_issues_postagens_logs").upsert(
    {
      id_issue: issueKey,
      log_type: "postagem_automatica",
      status: "sucesso",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id_issue, log_type" }
  )

  console.log(`✅ [Jira-Auto] ${issueKey} cancelado com sucesso`)
}

// ─── COMENTÁRIOS PENDENTES ────────────────────────────────────────────────────
// Posta comentários gerados pela triagem na issue referência

async function postarComentariosPendentes(
  issueKey: string,
  auth: string,
  baseUrl: string
): Promise<void> {
  const { data: comentarios, error } = await supabaseAdmin
    .from("jira_comments")
    .select("id, corpo_comentario")
    .eq("issue_id", issueKey)
    .eq("aguardando_processar", true)
    .eq("sincronizado_jira", false)

  if (error) {
    console.warn(`⚠️ [Jira-Auto] Erro ao buscar comentários de ${issueKey}:`, error.message)
    return
  }

  if (!comentarios || comentarios.length === 0) {
    console.log(`  → Sem comentários pendentes para ${issueKey}`)
    return
  }

  console.log(`  → Postando ${comentarios.length} comentário(s) em ${issueKey}...`)

  for (const comentario of comentarios) {
    try {
      const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: {
            version: 1,
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: comentario.corpo_comentario }],
              },
            ],
          },
        }),
      })

      if (!response.ok) {
        let errorDetail = "sem detalhes"
        try { errorDetail = await response.text() } catch (_) {}
        console.error(`  → ❌ Falha ao postar comentário ${comentario.id} (${response.status}): ${errorDetail.slice(0, 150)}`)
        continue
      }

      await supabaseAdmin
        .from("jira_comments")
        .update({
          sincronizado_jira: true,
          aguardando_processar: false,
        })
        .eq("id", comentario.id)

      console.log(`  → ✅ Comentário ${comentario.id} postado`)
    } catch (err: any) {
      console.error(`  → ❌ Erro inesperado no comentário ${comentario.id}:`, err.message)
    }
  }
}

// ─── POSTAGEM PRINCIPAL (APROVAÇÃO) ──────────────────────────────────────────

interface PostagemResult {
  success: boolean
  error?: string
}

export async function postarRespostaJiraAutomatico(issueKey: string): Promise<PostagemResult> {
  console.log(`📤 [Jira-Auto] Iniciando postagem de ${issueKey}...`)

  try {
    // ✅ GUARD — verifica se deve processar
    const { data: demanda } = await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .select("aguardando_processar, processado, sincronizado_jira")
      .eq("id_issue", issueKey)
      .single()

    if (demanda?.processado && demanda?.sincronizado_jira) {
      console.log(`⏭️ [Jira-Auto] ${issueKey} já processado e sincronizado, pulando`)
      return { success: true }
    }

    if (!demanda?.aguardando_processar) {
      console.log(`⏭️ [Jira-Auto] ${issueKey} não está aguardando processar, pulando`)
      return { success: true }
    }

    const { auth, baseUrl } = getJiraConfig()

    // Verifica se é cancelamento (triagem_status = "reprovado")
    const { data: analiseStatus } = await supabaseAdmin
      .from("agentes_analises")
      .select("triagem_status")
      .eq("id_issue", issueKey)
      .single()

    if (analiseStatus?.triagem_status === "reprovado") {
      await processarIssueCancelada(issueKey, auth, baseUrl)
      return { success: true }
    }

    // 1️⃣ Busca análise
    const { data: analise, error: analiseError } = await supabaseAdmin
      .from("agentes_analises")
      .select(`
        plataforma,
        escritor_resultado,
        escritor_resultado_editado,
        desenvolvedor_jira_id
      `)
      .eq("id_issue", issueKey)
      .single()

    if (analiseError || !analise) {
      throw new Error(`Análise não encontrada: ${analiseError?.message ?? "registro vazio"}`)
    }

    if (!analise.plataforma) {
      throw new Error("Logística incompleta. O Agente 07 precisa rodar primeiro.")
    }

    const textoFinal = analise.escritor_resultado_editado || analise.escritor_resultado

    if (!textoFinal) {
      throw new Error("Nenhum texto de análise disponível para postagem.")
    }

    const isWeb = analise.plataforma === "WEB"
    const responsavelLiderId = isWeb ? ID_JIRA_GABRIEL_ZAMBONI : ID_JIRA_FRANCIS
    const setorNome = isWeb ? "DESENV WEB" : "DESENV DESKTOP"
    const setorId   = isWeb ? "10380" : "10381"

    // 2️⃣ Atualiza campos
    const camposUpdate = {
      fields: {
        customfield_10390: { id: ID_JIRA_ANALISTA },
        customfield_10348: { id: setorId },
        customfield_10384: analise.desenvolvedor_jira_id
          ? [{ id: analise.desenvolvedor_jira_id }]
          : [],
        assignee: { id: responsavelLiderId },
        customfield_10698: {
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: textoFinal }],
            },
          ],
        },
      },
    }

    console.log(`  → Atualizando campos (${setorNome})...`)

    const jiraResponse = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(camposUpdate),
    })

    if (!jiraResponse.ok) {
      let errorDetail = "sem detalhes"
      try { errorDetail = await jiraResponse.text() } catch (_) {}
      throw new Error(`Jira retornou ${jiraResponse.status}: ${errorDetail.slice(0, 150)}`)
    }

    console.log(`  → ✅ Campos atualizados`)

    // 3️⃣ Executa transições de aprovação (36 → 4 → 29 → 10)
    console.log(`  → Executando transições de aprovação...`)
    for (const transicaoId of TRANSICOES_APROVACAO) {
      await executarTransicao(issueKey, transicaoId, auth, baseUrl)
    }

    // 4️⃣ Re-aplica responsável após transições (transições podem resetar o assignee)
    console.log(`  → Re-aplicando responsável após transições...`)
    const responsavelUpdate = {
      fields: {
        assignee: { id: responsavelLiderId },
        customfield_10384: analise.desenvolvedor_jira_id
          ? [{ id: analise.desenvolvedor_jira_id }]
          : [],
      },
    }
    const responsavelResponse = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responsavelUpdate),
    })
    if (!responsavelResponse.ok) {
      let errorDetail = "sem detalhes"
      try { errorDetail = await responsavelResponse.text() } catch (_) {}
      console.warn(`  → ⚠️ Falha ao re-aplicar responsável (${responsavelResponse.status}): ${errorDetail.slice(0, 150)}`)
    } else {
      console.log(`  → ✅ Responsável re-aplicado`)
    }

    // 5️⃣ Posta comentários pendentes da triagem (se houver)
    // Busca o UUID interno da issue pois jira_comments.issue_id usa UUID, não issueKey
    const { data: issueRef } = await supabaseAdmin
      .from("jira_issues")
      .select("id")
      .eq("issue_key", issueKey)
      .single()

    if (issueRef?.id) {
      await postarComentariosPendentes(issueRef.id, auth, baseUrl)
    } else {
      console.warn(`  → ⚠️ Não foi possível encontrar UUID de ${issueKey} para buscar comentários`)
    }

    // 6️⃣ Limpa flags no banco
    await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .update({
        aguardando_processar: false,
        sincronizado_jira: true,
        processado: true,
      })
      .eq("id_issue", issueKey)

    await supabaseAdmin.from("jira_issues_postagens_logs").upsert(
      {
        id_issue: issueKey,
        log_type: "postagem_automatica",
        status: "sucesso",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id_issue, log_type" }
    )

    console.log(`🎉 [Jira-Auto] ${issueKey} postado com sucesso no setor ${setorNome}!`)
    return { success: true }

  } catch (err: any) {
    console.error(`❌ [Jira-Auto] Falha em ${issueKey}:`, err.message)

    try {
      await supabaseAdmin.from("jira_issues_postagens_logs").upsert(
        {
          id_issue: issueKey,
          log_type: "postagem_automatica",
          status: "erro",
          error_message: err.message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id_issue, log_type" }
      )
    } catch (logErr: any) {
      console.error(`⚠️ [Jira-Auto] Falha ao registrar log de erro:`, logErr.message)
    }

    return { success: false, error: err.message }
  }
}