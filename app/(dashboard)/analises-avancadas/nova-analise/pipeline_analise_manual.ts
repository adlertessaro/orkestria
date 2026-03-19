import { supabaseAdmin } from "@/lib/supabase/supabase"
import { agenteTriagem } from "@/lib/agents/analise/03-triagem"
import { agentePesquisador } from "@/lib/agents/analise/04-pesquisador"
import { agenteAnalistaEscritor } from "@/lib/agents/analise/05-analista-escritor"
import { agenteRevisorJuiz } from "@/lib/agents/analise/06-revisor-juiz"
import { agenteMapeadorDev } from "@/lib/agents/analise/07-classificador-issue"
import { postarRespostaJiraAutomatico } from "@/app/(dashboard)/analises-avancadas/exibir-analises/actions-postar-jira"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type EtapaStatus = "pendente" | "rodando" | "sucesso" | "erro" | "pulado"

export interface EtapaLog {
  etapa: string
  slug: string
  status: EtapaStatus
  mensagem?: string
  inicio?: string
  fim?: string
  dados?: Record<string, any>
}

export interface AnaliseManualResult {
  success: boolean
  issueKey: string
  etapas: EtapaLog[]
  error?: string
  postado?: boolean
  bloqueado?: boolean
}

// ─── VERIFICAR SE PODE EXECUTAR ───────────────────────────────────────────────

export async function verificarBloqueio(issueKey: string): Promise<{ bloqueado: boolean; motivo?: string; status?: string }> {
  const { data } = await supabaseAdmin
    .from("agentes_analises_manuais_sessoes")
    .select("status, id_issue")
    .eq("id_issue", issueKey)
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.status === "concluido") {
    return { bloqueado: true, motivo: "Esta issue já possui uma análise concluída.", status: "concluido" }
  }
  if (data?.status === "cancelado") {
    return { bloqueado: true, motivo: "Esta issue foi cancelada na triagem.", status: "cancelado" }
  }
  if (data?.status === "em_andamento") {
    return { bloqueado: true, motivo: "Já existe uma análise em andamento para esta issue.", status: "em_andamento" }
  }

  return { bloqueado: false }
}

// ─── HELPER: Persiste log ─────────────────────────────────────────────────────

async function salvarLogEtapa(issueKey: string, sessionId: string, etapa: EtapaLog): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("agentes_analises_manuais_log")
      .upsert(
        {
          session_id: sessionId,
          id_issue: issueKey,
          etapa_slug: etapa.slug,
          etapa_nome: etapa.etapa,
          status: etapa.status,
          mensagem: etapa.mensagem || null,
          inicio: etapa.inicio || null,
          fim: etapa.fim || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id,etapa_slug" }
      )
    if (error) console.error(`❌ [DB] Erro ao salvar log ${etapa.slug}:`, error)
  } catch (err: any) {
    console.warn(`⚠️ [ManualLog] Falha ao salvar log da etapa ${etapa.slug}:`, err.message)
  }
}

async function finalizarSessao(sessionId: string, issueKey: string, status: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("agentes_analises_manuais_sessoes")
      .update({ status, finalizado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("session_id", sessionId)
    if (error) console.error(`❌ [DB] Erro ao finalizar sessão:`, error)
    else console.log(`✅ [DB] Sessão finalizada com status: ${status}`)
  } catch (err: any) {
    console.warn(`⚠️ [ManualLog] Falha ao finalizar sessão:`, err.message)
  }
}

// ─── PIPELINE PRINCIPAL ───────────────────────────────────────────────────────

export async function executarAnaliseManual(
  issueKey: string,
  onEtapa?: (etapa: EtapaLog) => void
): Promise<AnaliseManualResult> {
  // ── Bloqueia se já concluída ou em andamento ───────────────────────────────
  const bloqueio = await verificarBloqueio(issueKey)
  if (bloqueio.bloqueado) {
    console.warn(`🚫 [AnaliseManual] Bloqueado para ${issueKey}: ${bloqueio.motivo}`)
    return { success: false, issueKey, etapas: [], error: bloqueio.motivo, bloqueado: true }
  }

  const sessionId = `manual_${issueKey}_${Date.now()}`
  const etapas: EtapaLog[] = []

  console.log(`🚀 [AnaliseManual] Iniciando análise de ${issueKey} (Session: ${sessionId})`)

  const log = async (etapa: EtapaLog) => {
    console.log(`📊 [Pipeline] ${etapa.etapa}: ${etapa.status}${etapa.mensagem ? ` - ${etapa.mensagem}` : ""}`)
    const idx = etapas.findIndex(e => e.slug === etapa.slug)
    if (idx >= 0) etapas[idx] = etapa
    else etapas.push(etapa)
    onEtapa?.(etapa)
    await salvarLogEtapa(issueKey, sessionId, etapa)
  }

  // Cria sessão
  try {
    const { error } = await supabaseAdmin
      .from("agentes_analises_manuais_sessoes")
      .upsert(
        { session_id: sessionId, id_issue: issueKey, status: "em_andamento", iniciado_em: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "session_id" }
      )
    if (error) console.error(`❌ [DB] Erro ao criar sessão:`, error)
    else console.log(`✅ [DB] Sessão criada: ${sessionId}`)
  } catch (err: any) {
    console.error(`❌ [DB] Erro crítico ao criar sessão:`, err.message)
  }

  try {
    // ── Verifica análise parcial no agentes_analises ────────────────────────
    const { data: analiseExistente } = await supabaseAdmin
      .from("agentes_analises")
      .select("triagem_status, juiz_status")
      .eq("id_issue", issueKey)
      .single()

    // Fast-track: juiz já aprovou
    if (analiseExistente?.juiz_status === "aprovado") {
      console.log(`⏩ [FastTrack] Juiz já aprovou — pulando para mapeador`)
      await log({ etapa: "Triagem", slug: "triagem", status: "pulado", mensagem: "Já executada anteriormente" })
      await log({ etapa: "Pesquisador", slug: "pesquisador", status: "pulado", mensagem: "Já executado anteriormente" })
      await log({ etapa: "Escritor / Analista", slug: "escritor", status: "pulado", mensagem: "Já executado anteriormente" })
      await log({ etapa: "Revisor / Juiz", slug: "juiz", status: "pulado", mensagem: "Já aprovado anteriormente" })

      await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "rodando", inicio: new Date().toISOString() })
      const mapeadorResult = await agenteMapeadorDev(issueKey)
      if (mapeadorResult) {
        await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "sucesso", mensagem: `${mapeadorResult.plataforma} → ${mapeadorResult.devEscolhido?.nome_exibicao}`, fim: new Date().toISOString() })
      } else {
        await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "erro", mensagem: "Mapeador não retornou resultado", fim: new Date().toISOString() })
        await finalizarSessao(sessionId, issueKey, "erro")
        return { success: false, issueKey, etapas, error: "Mapeador falhou" }
      }

      await log({ etapa: "Postagem no Jira", slug: "postagem", status: "rodando", inicio: new Date().toISOString() })
      const postagem = await postarRespostaJiraAutomatico(issueKey)
      if (postagem.success) {
        await log({ etapa: "Postagem no Jira", slug: "postagem", status: "sucesso", mensagem: "Postado com sucesso no Jira", fim: new Date().toISOString() })
      } else {
        await log({ etapa: "Postagem no Jira", slug: "postagem", status: "erro", mensagem: postagem.error, fim: new Date().toISOString() })
        await finalizarSessao(sessionId, issueKey, "erro")
        return { success: false, issueKey, etapas, error: postagem.error }
      }

      await finalizarSessao(sessionId, issueKey, "concluido")
      return { success: true, issueKey, etapas, postado: true }
    }

    // Fast-track: triagem reprovou
    if (analiseExistente?.triagem_status === "reprovado") {
      console.log(`⏩ [FastTrack] Triagem reprovou — postando cancelamento`)
      await log({ etapa: "Triagem", slug: "triagem", status: "pulado", mensagem: "Issue reprovada na triagem — seguindo para cancelamento" })
      await log({ etapa: "Postagem no Jira", slug: "postagem", status: "rodando", inicio: new Date().toISOString() })
      const postagem = await postarRespostaJiraAutomatico(issueKey)
      await log({ etapa: "Postagem no Jira", slug: "postagem", status: postagem.success ? "sucesso" : "erro", mensagem: postagem.success ? "Cancelamento postado no Jira" : postagem.error, fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, postagem.success ? "concluido" : "erro")
      return { success: postagem.success, issueKey, etapas, postado: postagem.success }
    }

    // ── 1️⃣ TRIAGEM ────────────────────────────────────────────────────────────
    await log({ etapa: "Triagem", slug: "triagem", status: "rodando", inicio: new Date().toISOString() })
    const triagemResult = await agenteTriagem([issueKey])

    if (triagemResult.length === 0) {
      const { data: analisePos } = await supabaseAdmin
        .from("agentes_analises")
        .select("triagem_status, triagem_motivo")
        .eq("id_issue", issueKey)
        .single()

      if (analisePos?.triagem_status === "reprovado") {
        await log({ etapa: "Triagem", slug: "triagem", status: "erro", mensagem: `Reprovada: ${analisePos.triagem_motivo}`, fim: new Date().toISOString() })
        await log({ etapa: "Postagem no Jira", slug: "postagem", status: "rodando", inicio: new Date().toISOString() })
        const postagem = await postarRespostaJiraAutomatico(issueKey)
        await log({ etapa: "Postagem no Jira", slug: "postagem", status: postagem.success ? "sucesso" : "erro", mensagem: postagem.success ? "Cancelamento postado" : postagem.error, fim: new Date().toISOString() })
        await finalizarSessao(sessionId, issueKey, "cancelado")
        return { success: postagem.success, issueKey, etapas }
      }

      await log({ etapa: "Triagem", slug: "triagem", status: "erro", mensagem: "Triagem não retornou aprovação e status desconhecido", fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: "Triagem falhou sem status definido" }
    }

    const issueParaPipeline = triagemResult[0]
    const msgTriagem = issueParaPipeline !== issueKey
      ? `Aprovada → referência identificada: ${issueParaPipeline}`
      : "Aprovada"
    await log({ etapa: "Triagem", slug: "triagem", status: "sucesso", mensagem: msgTriagem, fim: new Date().toISOString() })

    // ── 2️⃣ PESQUISADOR ────────────────────────────────────────────────────────
    await log({ etapa: "Pesquisador", slug: "pesquisador", status: "rodando", inicio: new Date().toISOString() })
    const pesquisadas = await agentePesquisador(triagemResult)

    if (pesquisadas.length === 0) {
      await log({ etapa: "Pesquisador", slug: "pesquisador", status: "erro", mensagem: "Pesquisador não retornou resultados", fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: "Pesquisador falhou" }
    }
    await log({ etapa: "Pesquisador", slug: "pesquisador", status: "sucesso", mensagem: `${pesquisadas.length} issue(s) pesquisada(s)`, fim: new Date().toISOString() })

    // ── 3️⃣ ESCRITOR ───────────────────────────────────────────────────────────
    await log({ etapa: "Escritor / Analista", slug: "escritor", status: "rodando", inicio: new Date().toISOString() })
    const escritas = await agenteAnalistaEscritor(pesquisadas)

    if (escritas.length === 0) {
      await log({ etapa: "Escritor / Analista", slug: "escritor", status: "erro", mensagem: "Escritor não gerou documento", fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: "Escritor falhou" }
    }
    await log({ etapa: "Escritor / Analista", slug: "escritor", status: "sucesso", mensagem: "Análise técnica gerada", fim: new Date().toISOString() })

    // ── 4️⃣ JUIZ ───────────────────────────────────────────────────────────────
    await log({ etapa: "Revisor / Juiz", slug: "juiz", status: "rodando", mensagem: "Revisando e pontuando o documento...", inicio: new Date().toISOString() })
    await agenteRevisorJuiz(escritas)

    const { data: analiseJuiz } = await supabaseAdmin
      .from("agentes_analises")
      .select("juiz_status, juiz_score")
      .eq("id_issue", issueParaPipeline)
      .single()

    if (analiseJuiz?.juiz_status !== "aprovado") {
      await log({ etapa: "Revisor / Juiz", slug: "juiz", status: "erro", mensagem: `Juiz não aprovou — status: ${analiseJuiz?.juiz_status}`, fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: "Juiz não aprovou o documento" }
    }
    await log({ etapa: "Revisor / Juiz", slug: "juiz", status: "sucesso", mensagem: `Aprovado com score ${analiseJuiz.juiz_score}/100`, fim: new Date().toISOString() })

    // ── 5️⃣ MAPEADOR ───────────────────────────────────────────────────────────
    await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "rodando", inicio: new Date().toISOString() })
    const mapeadorResult = await agenteMapeadorDev(issueParaPipeline)

    if (!mapeadorResult) {
      await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "erro", mensagem: "Mapeador não retornou resultado", fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: "Mapeador falhou" }
    }
    await log({ etapa: "Mapeador de Dev", slug: "mapeador", status: "sucesso", mensagem: `${mapeadorResult.plataforma} → ${mapeadorResult.devEscolhido?.nome_exibicao}`, fim: new Date().toISOString() })

    // ── 6️⃣ POSTAGEM ───────────────────────────────────────────────────────────
    await log({ etapa: "Postagem no Jira", slug: "postagem", status: "rodando", inicio: new Date().toISOString() })
    const postagem = await postarRespostaJiraAutomatico(issueParaPipeline)

    if (postagem.success) {
      await log({ etapa: "Postagem no Jira", slug: "postagem", status: "sucesso", mensagem: "Postado com sucesso no Jira", fim: new Date().toISOString() })
    } else {
      await log({ etapa: "Postagem no Jira", slug: "postagem", status: "erro", mensagem: postagem.error, fim: new Date().toISOString() })
      await finalizarSessao(sessionId, issueKey, "erro")
      return { success: false, issueKey, etapas, error: postagem.error }
    }

    await finalizarSessao(sessionId, issueKey, "concluido")
    console.log(`🎉 [AnaliseManual] Concluída com sucesso!`)
    return { success: true, issueKey, etapas, postado: true }

  } catch (err: any) {
    console.error(`❌ [AnaliseManual] Erro crítico em ${issueKey}:`, err.message)
    await finalizarSessao(sessionId, issueKey, "erro")
    return { success: false, issueKey, etapas, error: err.message }
  }
}