import { supabaseAdmin } from "@/lib/supabase/supabase"
import { agenteTriagem } from "../agents/analise/03-triagem"
import { agentePesquisador } from "../agents/analise/04-pesquisador"
import { agenteAnalistaEscritor } from "../agents/analise/05-analista-escritor"
import { agenteRevisorJuiz } from "../agents/analise/06-revisor-juiz"
import { agenteMapeadorDev } from "../agents/analise/07-classificador-issue"
import { postarRespostaJiraAutomatico } from "@/app/(dashboard)/analises-avancadas/exibir-analises/actions-postar-jira"

const LIMITE_DIARIO = 100
const INTERVALO_MS = 10 * 60 * 1000 // 10 minutos

// ─── CONTADOR DIÁRIO ──────────────────────────────────────────────────────────

async function getProcessadosHoje(): Promise<number> {
  const hoje = new Date().toISOString().split("T")[0]

  const { data } = await supabaseAdmin
    .from("agentes_processados_dia")
    .select("quantidade")
    .eq("data", hoje)
    .single()

  return data?.quantidade ?? 0
}

async function incrementarProcessadosHoje(): Promise<void> {
  const hoje = new Date().toISOString().split("T")[0]

  await supabaseAdmin
    .from("agentes_processados_dia")
    .upsert(
      { data: hoje, quantidade: (await getProcessadosHoje()) + 1 },
      { onConflict: "data" }
    )
}

// ─── BUSCA PRÓXIMA ISSUE PENDENTE ─────────────────────────────────────────────

const STATUS_PERMITIDOS = ["Backlog", "Aguardando Análise"]

async function buscarProximaIssuePendente(): Promise<string | null> {
  // Busca issues pendentes sem filtro de status (join não disponível no schema cache)
  const { data, error } = await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .select("id_issue")
    .eq("aguardando_processar", true)
    .eq("processado", false)
    .order("created_at", { ascending: true })
    .limit(1000)

  if (error) {
    console.error("❌ [Agendador] Erro ao buscar issues pendentes:", error.message)
    return null
  }

  if (!data || data.length === 0) return null

  // Filtra pelo status real e exclui manuais em jira_issues
  const ids = data.map(d => d.id_issue)
  const { data: issues } = await supabaseAdmin
    .from("jira_issues")
    .select("issue_key, status, resumo")
    .in("issue_key", ids)
    .in("status", STATUS_PERMITIDOS)

  if (!issues || issues.length === 0) {
    console.log("💤 [Agendador] Nenhuma issue pendente com status permitido.")
    return null
  }

  const permitidas = new Set(
    issues
      .filter(i => !/^manual:/i.test(i.resumo?.trim() || ""))
      .map(i => i.issue_key)
  )

  if (permitidas.size === 0) {
    console.log("💤 [Agendador] Nenhuma issue pendente (todas são manuais ou status não permitido).")
    return null
  }

  // Respeita a ordem original (created_at asc) da primeira query
  const proxima = data.find(d => permitidas.has(d.id_issue))

  console.log(`📋 [Agendador] Issues pendentes encontradas: ${[...permitidas].join(", ")}`)

  return proxima?.id_issue ?? null
}

// ─── PIPELINE COMPLETO ────────────────────────────────────────────────────────

async function processarIssue(issueKey: string): Promise<boolean> {
  console.log(`\n🚀 [Agendador] Processando ${issueKey}...`)

  try {
    // Verifica se já passou por todo o pipeline e está só aguardando postagem
    const { data: analise } = await supabaseAdmin
      .from("agentes_analises")
      .select("triagem_status, juiz_status")
      .eq("id_issue", issueKey)
      .single()

    if (analise?.juiz_status === "aprovado" || analise?.triagem_status === "aprovado_manual") {
      console.log(`   → Demanda aprovada — indo direto para postagem`)
      console.log("6️⃣ POSTAGEM JIRA")
      const postagem = await postarRespostaJiraAutomatico(issueKey)
      if (postagem.success) {
        console.log(`   → ✅ Postado no Jira`)
      } else {
        console.error(`   → ❌ Falha na postagem: ${postagem.error}`)
      }
      return postagem.success
    }

    if (analise?.triagem_status === "reprovado") {
      console.log(`   → Triagem reprovada — indo direto para postagem de cancelamento`)
      const postagem = await postarRespostaJiraAutomatico(issueKey)
      return postagem.success
    }

    // Pipeline completo do zero (ou retomada após erro)
    // 1️⃣ TRIAGEM
    console.log("1️⃣ TRIAGEM")
    const triagemResult = await agenteTriagem([issueKey])
    console.log(`   → ${triagemResult.length} aprovadas: ${triagemResult.join(", ") || "nenhuma"}`)

    if (triagemResult.length === 0) {
      const { data: analiseAtualizada } = await supabaseAdmin
        .from("agentes_analises")
        .select("triagem_status, triagem_motivo")
        .eq("id_issue", issueKey)
        .single()

      if (analiseAtualizada?.triagem_status === "reprovado") {
        console.log(`   → Issue cancelada pela triagem: ${analiseAtualizada.triagem_motivo}`)
        const postagem = await postarRespostaJiraAutomatico(issueKey)
        return postagem.success
      }

      console.warn(`   → Triagem não retornou aprovadas — status: ${analiseAtualizada?.triagem_status ?? "desconhecido"}`)
      return false
    }

    const issueParaPipeline = triagemResult[0]
    if (issueParaPipeline !== issueKey) {
      console.log(`   → Referência identificada: ${issueParaPipeline} — seguindo pipeline com ela`)
    }

    // 2️⃣ PESQUISADOR
    console.log("2️⃣ PESQUISADOR")
    const pesquisadas = await agentePesquisador(triagemResult)
    console.log(`   → ${pesquisadas.length} pesquisadas`)
    if (pesquisadas.length === 0) return false

    // 3️⃣ ESCRITOR
    console.log("3️⃣ ESCRITOR")
    const escritas = await agenteAnalistaEscritor(pesquisadas)
    console.log(`   → ${escritas.length} escritas`)
    if (escritas.length === 0) return false

    // 4️⃣ JUIZ
    console.log("4️⃣ JUIZ")
    await agenteRevisorJuiz(escritas)

    const { data: analiseJuiz } = await supabaseAdmin
      .from("agentes_analises")
      .select("juiz_status")
      .eq("id_issue", issueParaPipeline)
      .single()

    if (analiseJuiz?.juiz_status !== "aprovado") {
      console.warn(`   → ⚠️ Juiz não aprovou ${issueParaPipeline}`)
      return false
    }

    await incrementarProcessadosHoje()
    console.log(`   → ✅ Juiz aprovado — contador do dia incrementado`)

    // 5️⃣ MAPEADOR
    console.log("5️⃣ MAPEADOR")
    const mapeadorResult = await agenteMapeadorDev(issueParaPipeline)
    if (!mapeadorResult) {
      console.warn(`   → ⚠️ Mapeador falhou para ${issueParaPipeline}`)
      return false
    }
    console.log(`   → ✅ ${mapeadorResult.plataforma} → ${mapeadorResult.devEscolhido?.nome_exibicao}`)

    // 6️⃣ POSTAGEM JIRA
    console.log("6️⃣ POSTAGEM JIRA")
    const postagem = await postarRespostaJiraAutomatico(issueParaPipeline)
    if (postagem.success) {
      console.log(`   → ✅ Postado no Jira`)
    } else {
      console.error(`   → ❌ Falha na postagem: ${postagem.error}`)
    }

    return postagem.success

  } catch (err: any) {
    console.error(`❌ [Agendador] Erro ao processar ${issueKey}:`, err.message)
    return false
  }
}

// ─── CICLO PRINCIPAL ──────────────────────────────────────────────────────────

async function executarCiclo(): Promise<void> {
  console.log(`\n⏰ [Agendador] Ciclo iniciado — ${new Date().toLocaleString("pt-BR")}`)

  // Verifica limite diário
  const processadosHoje = await getProcessadosHoje()
  console.log(`📊 [Agendador] Processados hoje: ${processadosHoje}/${LIMITE_DIARIO}`)

  if (processadosHoje >= LIMITE_DIARIO) {
    console.log(`🚫 [Agendador] Limite diário de ${LIMITE_DIARIO} issues atingido. Aguardando amanhã.`)
    return
  }

  // Busca próxima issue pendente
  const issueKey = await buscarProximaIssuePendente()

  if (!issueKey) {
    console.log("💤 [Agendador] Nenhuma issue pendente no momento.")
    return
  }

  await processarIssue(issueKey)

  console.log(`✅ [Agendador] Ciclo concluído — ${new Date().toLocaleString("pt-BR")}`)
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

console.log(`🤖 [Agendador] Iniciando — ciclo a cada ${INTERVALO_MS / 60000} minutos | limite: ${LIMITE_DIARIO}/dia`)

executarCiclo() // Roda imediatamente na inicialização

setInterval(executarCiclo, INTERVALO_MS)