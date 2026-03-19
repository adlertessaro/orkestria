import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"
import { agentePesquisador } from "./04-pesquisador"
import { agenteAnalistaEscritor } from "./05-analista-escritor"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PRECOS: Record<string, [number, number]> = {
  "gpt-4o":      [2.50, 10.00],
  "gpt-4o-mini": [0.15,  0.60],
}

function calcularCusto(modelo: string, input: number, output: number): number {
  const [pi, po] = PRECOS[modelo] || [0, 0]
  return (input * pi + output * po) / 1_000_000
}

const MAX_TENTATIVAS = 3

// ─── AGENTE PRINCIPAL ─────────────────────────────────────────────────────────

export async function agenteRevisorJuiz(issueKeys: string[]): Promise<void> {
  console.log(`⚖️ [Juiz] Revisando ${issueKeys.length} documentos...`)

  const { data: agente } = await supabaseAdmin
    .from("agentes")
    .select("prompt_sistema, llm_model, temperature")
    .eq("slug", "revisor-juiz")
    .single()

  if (!agente) {
    console.error("❌ [Juiz] Agente não encontrado no banco")
    return
  }

    // Filtra só issues que têm escritor_resultado
  const { data: prontas } = await supabaseAdmin
    .from("agentes_analises")
    .select("id_issue")
    .in("id_issue", issueKeys)
    .eq("escritor_status", "gerado")

  const issuesParaJuiz = prontas?.map(r => r.id_issue) || []

  const puladas = issueKeys.filter(k => !issuesParaJuiz.includes(k))
  if (puladas.length > 0) {
    console.log(`⏭️ [Juiz] Pulando ${puladas.length} issues sem escritor_resultado: ${puladas.join(", ")}`)
  }

  for (const issueKey of issuesParaJuiz) {
    await revisarComLoop(issueKey, agente)
  }

}

// ─── LOOP DE REVISÃO ──────────────────────────────────────────────────────────

async function revisarComLoop(
  issueKey: string,
  agente: { prompt_sistema: string; llm_model: string; temperature?: number }
): Promise<void> {
  const modelo = agente.llm_model || "gpt-4o"

  // Recupera tentativas anteriores do juiz pra essa issue
  const { data: execucoesAnteriores } = await supabaseAdmin
    .from("agentes_execucoes")
    .select("id")
    .eq("id_issue", issueKey)
    .eq("agente_slug", "revisor-juiz")
    .in("status", ["aprovado", "reprovado"])

  const tentativa = (execucoesAnteriores?.length || 0) + 1

  if (tentativa > MAX_TENTATIVAS) {
    console.warn(`🚫 [Juiz] ${issueKey} atingiu ${MAX_TENTATIVAS} tentativas — escalando para humano`)

    await supabaseAdmin
      .from("agentes_analises")
      .upsert({
        id_issue: issueKey,
        juiz_status: "limite_tentativas",
        status_geral: "Bloqueado",
        requer_intervencao: true,
        intervencao_motivo: `Juiz rejeitou ${MAX_TENTATIVAS} vezes consecutivas. Requer revisão humana.`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id_issue" })

    return
  }

  console.log(`⚖️ [Juiz] ${issueKey} — tentativa ${tentativa}/${MAX_TENTATIVAS}`)

  try {
    // Busca documento do escritor
        const { data: analise } = await supabaseAdmin
      .from("agentes_analises")
      .select("escritor_resultado, juiz_pontos_criticos, juiz_pontos_criticos_escrita, juiz_pontos_criticos_pesquisa")
      .eq("id_issue", issueKey)
      .single()

    if (!analise?.escritor_resultado) {
      console.error(`❌ [Juiz] ${issueKey} sem escritor_resultado`)
      return
    }

    // Se for retentativa, injeta os pontos críticos da rodada anterior no contexto
        const ultimaTentativa = tentativa >= MAX_TENTATIVAS

    const contextoPontoCritico = analise.juiz_pontos_criticos
        ? `\n\n⚠️ ESTA É A TENTATIVA ${tentativa}. Na revisão anterior você reprovou pelos pontos abaixo.
        Verifique PRIMEIRO se cada um foi atendido no documento antes de avaliar o restante.
        Se todos foram atendidos, esses pontos NÃO podem ser motivo de reprovação novamente.
        Se algum ainda estiver ausente, aponte SOMENTE esse ponto como crítico.
        ${ultimaTentativa ? `\n🔴 ÚLTIMA TENTATIVA: Se os pontos pendentes não comprometem a execução pelo desenvolvedor júnior, APROVE e registre como risco com o prefixo "PENDÊNCIA NÃO BLOQUEANTE:". Só reprove se houver contradição lógica grave ou implementação inviável.` : ""}

        PONTOS DA RODADA ANTERIOR:
        ${analise.juiz_pontos_criticos}`
                : ""


    const userPrompt = `Revise o documento abaixo com rigor.${contextoPontoCritico}

---

${analise.escritor_resultado}

---

Responda EXCLUSIVAMENTE em JSON com a estrutura:
{
  "aprovado": true | false,
  "score": 0-100,
  "classificacao": "Simples | Média | Complexa",
  "inconsistencias": ["string"],
  "pontos_criticos_pesquisa": ["pontos que precisam de busca externa — leis, normas, mercado"],
  "pontos_criticos_escrita": ["pontos que o escritor resolve sozinho — regras internas, detalhes de comportamento, tratamento de exceção"],
  "devolutiva": "texto completo da auditoria conforme estrutura do prompt"
}`

    const resposta = await openai.chat.completions.create({
      model: modelo,
      messages: [
        { role: "system", content: agente.prompt_sistema },
        { role: "user", content: userPrompt }
      ],
      temperature: agente.temperature || 0.1,
      response_format: { type: "json_object" },
    })

    const usage = resposta.usage
    const custoUsd = calcularCusto(modelo, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
    const revisao = JSON.parse(resposta.choices[0]?.message?.content || "{}")

    const aprovado: boolean = revisao.aprovado === true
    const score: number = revisao.score || 0
    const pontosCriticosPesquisa: string[] = revisao.pontos_criticos_pesquisa || []
    const pontosCriticosEscrita: string[] = revisao.pontos_criticos_escrita || []
    const devolutiva: string = revisao.devolutiva || ""

    console.log(`${aprovado ? "✅" : "🚫"} [Juiz] ${issueKey} — score: ${score}/100 | $${custoUsd.toFixed(5)}`)

    // ─── Log técnico ──────────────────────────────────────────────────────
    await supabaseAdmin.from("agentes_execucoes").insert({
      id_issue: issueKey,
      agente_slug: "revisor-juiz",
      status: aprovado ? "aprovado" : "reprovado",
      resultado: {
        tentativa,
        score,
        aprovado,
        modelo,
        tokens_input: usage?.prompt_tokens || 0,
        tokens_output: usage?.completion_tokens || 0,
        custo_usd: custoUsd,
        inconsistencias: revisao.inconsistencias || [],
        pontos_criticos_pesquisa: pontosCriticosPesquisa,
        pontos_criticos_escrita: pontosCriticosEscrita,
      }
    })

    if (aprovado) {
      // ─── APROVADO — insere em documentos_finais ────────────────────────
      await supabaseAdmin.from("documentos_finais").insert({
        projeto_id: null,
        tipo_documento: "Análise de Negócio",
        retorno_analisador: analise.escritor_resultado,
        retorno_revisor: devolutiva,
        id_issue: issueKey,
      })

      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          juiz_status: "aprovado",
          juiz_score: score,
          juiz_devolutiva: devolutiva,
          juiz_at: new Date().toISOString(),
          status_geral: "Aprovado",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })

      // ⚠️ NÃO marcar processado: true aqui — quem faz isso é o actions-postar-jira após postar com sucesso
      console.log(`🎉 [Juiz] ${issueKey} APROVADO na tentativa ${tentativa}`)

    } else {
      // ─── REPROVADO — salva pontos críticos e relança pesquisador+escritor ──
      console.warn(`🔁 [Juiz] ${issueKey} REPROVADO (tentativa ${tentativa}) — relançando pesquisador`)

      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          juiz_status: "reprovado",
          juiz_score: score,
          juiz_devolutiva: devolutiva,
          juiz_pontos_criticos: [
            ...(pontosCriticosPesquisa),
            ...(pontosCriticosEscrita)
          ].join("\n"),
          juiz_pontos_criticos_pesquisa: pontosCriticosPesquisa.join("\n"),
          juiz_pontos_criticos_escrita: pontosCriticosEscrita.join("\n"),

          juiz_at: new Date().toISOString(),
          // Limpa os dados anteriores do pesquisador e escritor pra forçar reprocessamento
          pesquisador_status: null,
          escritor_status: null,
          escritor_resultado: null,
          status_geral: "Reprocessando",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })

      // Reprocessa pesquisador passando pontos críticos como contexto
      await agentePesquisadorComFeedback(issueKey, pontosCriticosPesquisa)

      // Reprocessa escritor
      await agenteAnalistaEscritor([issueKey])

      // Chama o juiz novamente recursivamente
      await revisarComLoop(issueKey, agente)
    }

  } catch (err: any) {
    console.error(`❌ [Juiz] Erro em ${issueKey}:`, err.message)

    await supabaseAdmin.from("agentes_execucoes").insert({
      id_issue: issueKey,
      agente_slug: "revisor-juiz",
      status: "erro",
      erro: err.message
    })

    await supabaseAdmin
      .from("agentes_analises")
      .upsert({
        id_issue: issueKey,
        juiz_status: "erro",
        status_geral: "Bloqueado",
        requer_intervencao: true,
        intervencao_motivo: `Erro no juiz: ${err.message}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id_issue" })
  }
}

// ─── PESQUISADOR COM FEEDBACK DO JUIZ ─────────────────────────────────────────
// Wrapper que injeta os pontos críticos do juiz no contexto do pesquisador

async function agentePesquisadorComFeedback(
  issueKey: string,
  pontosCriticos: string[]
): Promise<void> {
  console.log(`🔬 [Pesquisador-Feedback] Reiniciando ${issueKey} com ${pontosCriticos.length} pontos críticos`)

  // Salva os pontos críticos em agentes_analises para o pesquisador ler
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: issueKey,
      pesquisador_feedback_juiz: pontosCriticos.join("\n"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  // Chama o pesquisador normalmente — ele vai ler o feedback internamente
  await agentePesquisador([issueKey])
}