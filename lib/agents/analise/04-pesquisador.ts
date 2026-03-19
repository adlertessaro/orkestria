import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const TAVILY_API_KEY = process.env.AGENT_AUTH_ISSUES_TAVILY!

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface DecisaoPesquisa {
  pesquisa_web_realizada: boolean
  motivo_pesquisa: string
  conhecimento_sistema: string
  comportamento_mercado: string | null
  referencias_legais: string | null
  riscos_potenciais: string | null
  informacoes_criticas: string
}

// ─── TAVILY ───────────────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<{ title: string; content: string; score: number; url: string }[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  })

  if (!response.ok) throw new Error(`Tavily erro ${response.status}`)
  const data = await response.json()
  return data.results || []
}

// ─── BUSCA BASE DE CONHECIMENTO (chunks brutos) ───────────────────────────────

async function buscarBaseConhecimento(embeddingDemanda: number[]): Promise<string> {
  const { data: chunks } = await supabaseAdmin.rpc("buscar_base_conhecimento", {
    embedding_input: embeddingDemanda,
    limite: 5,
  })

  if (!chunks || chunks.length === 0) return ""

  return chunks
    .map((c: any) => `[${c.titulo}]\n${c.conteudo}`)
    .join("\n\n---\n\n")
}

// ─── EXTRAI CONHECIMENTO ÚTIL DO MANUAL PARA O ESCRITOR ──────────────────────

async function extrairConhecimentoDoManual(
  titulo: string,
  descricao: string,
  chunksManual: string
): Promise<string> {
  if (!chunksManual) return "Manual não encontrado para este módulo."

  const resposta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é especialista no ERP HOS Farma.
Dado o conteúdo de manuais do sistema e uma demanda, extraia SOMENTE o que é útil para um desenvolvedor implementar a demanda.

Extraia quando encontrado nos manuais:
- Caminho de menu exato (ex: Cadastros > Clientes > Aba Dados Gerais)
- Nome exato dos campos existentes na tela ou cadastro mencionado
- Comportamento atual do sistema naquele módulo
- Regras de negócio internas documentadas

Se o manual não cobrir a demanda, responda apenas: "Manual não encontrado para este módulo."
Seja direto. Não resuma o manual — extraia só o que o dev precisa saber para implementar.`
      },
      {
        role: "user",
        content: `Demanda:\nTítulo: ${titulo}\nDescrição: ${descricao?.slice(0, 400)}\n\n---\n\nManual:\n${chunksManual}`
      }
    ],
    temperature: 0,
    max_tokens: 800,
  })

  return resposta.choices[0]?.message?.content?.trim() || "Manual não encontrado para este módulo."
}

// ─── AVALIA NECESSIDADE DE PESQUISA WEB + DECIDE ─────────────────────────────
// O LLM lê a demanda e decide se vai para o Tavily ou não.
// Retorna a decisão com os campos que já alimentam o escritor.

async function avaliarNecessidadePesquisa(
  titulo: string,
  descricao: string,
  promptSistema: string,
  conhecimento_sistema: string,
  feedbackEfetivo: string | null
): Promise<DecisaoPesquisa> {
  const conteudoUser = feedbackEfetivo
    ? `Título: ${titulo}\nDescrição: ${descricao?.slice(0, 400)}\n\nFEEDBACK DO JUIZ (pontos a cobrir):\n${feedbackEfetivo}`
    : `Título: ${titulo}\nDescrição: ${descricao?.slice(0, 400)}`

  const resposta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: promptSistema },
      { role: "user", content: conteudoUser }
    ],
    temperature: 0,
    max_tokens: 600,
    response_format: { type: "json_object" },
  })

  const raw = JSON.parse(resposta.choices[0]?.message?.content || "{}")

  return {
    pesquisa_web_realizada: raw.pesquisa_web_realizada === true,
    motivo_pesquisa: raw.motivo_pesquisa || "",
    conhecimento_sistema,  // vem do manual já extraído, não do LLM
    comportamento_mercado: raw.comportamento_mercado || null,
    referencias_legais: raw.referencias_legais || null,
    riscos_potenciais: raw.riscos_potenciais || null,
    informacoes_criticas: raw.informacoes_criticas || "",
  }
}

// ─── GERA INTENÇÕES DE BUSCA WEB ─────────────────────────────────────────────

async function gerarIntencoesBusca(titulo: string, descricao: string): Promise<string[]> {
  const resposta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é especialista em ERP para farmácias.
Dado o título e descrição de uma demanda, gere EXATAMENTE 3 intenções de busca curtas e objetivas.
Foque em: legislação, normas técnicas e comportamento de mercado.
Responda APENAS com JSON: {"intencoes": ["busca 1", "busca 2", "busca 3"]}`
      },
      {
        role: "user",
        content: `Título: ${titulo}\nDescrição: ${descricao?.slice(0, 400)}`
      }
    ],
    temperature: 0,
    max_tokens: 150,
    response_format: { type: "json_object" },
  })

  const resultado = JSON.parse(resposta.choices[0]?.message?.content || "{}")
  return resultado.intencoes || []
}

async function gerarIntencoesDoFeedback(feedbackJuiz: string): Promise<string[]> {
  const resposta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é especialista em ERP farmacêutico.
O juiz reprovou uma análise técnica pelos motivos abaixo.
Gere EXATAMENTE 3 buscas curtas e objetivas para encontrar informações que resolvam cada ponto crítico.
Responda APENAS JSON: {"intencoes": ["busca 1", "busca 2", "busca 3"]}`
      },
      {
        role: "user",
        content: `Pontos críticos do juiz:\n${feedbackJuiz}`
      }
    ],
    temperature: 0,
    max_tokens: 150,
    response_format: { type: "json_object" },
  })

  const resultado = JSON.parse(resposta.choices[0]?.message?.content || "{}")
  return resultado.intencoes || []
}

// ─── BUSCA ISSUES SIMILARES CANCELADAS ───────────────────────────────────────

async function buscarContextoSimilares(issueKey: string): Promise<string> {
  const { data: analise } = await supabaseAdmin
    .from("agentes_analises")
    .select("triagem_similares, triagem_elementos_ausentes")
    .eq("id_issue", issueKey)
    .single()

  if (!analise?.triagem_similares || analise.triagem_similares.length === 0) return ""

  const keysSimiliares = analise.triagem_similares.map((s: any) => s.issueKey).filter(Boolean)
  if (keysSimiliares.length === 0) return ""

  const { data: demandas } = await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .select("id_issue, titulo, descricao")
    .in("id_issue", keysSimiliares)

  if (!demandas || demandas.length === 0) return ""

  return demandas
    .map((d: any) => `[${d.id_issue}] ${d.titulo}\n${d.descricao?.slice(0, 300)}`)
    .join("\n\n---\n\n")
}

// ─── AGENTE PRINCIPAL ─────────────────────────────────────────────────────────

export async function agentePesquisador(issueKeys: string[]): Promise<string[]> {
  console.log(`🔎 [Pesquisador] Pesquisando ${issueKeys.length} demandas...`)

  const { data: agente } = await supabaseAdmin
    .from("agentes")
    .select("prompt_sistema, llm_model")
    .eq("slug", "pesquisador")
    .single()

  if (!agente) {
    console.error("❌ [Pesquisador] Agente não encontrado no banco")
    return []
  }

  const pesquisadas: string[] = []

  for (const issueKey of issueKeys) {

    // Guard — evita reprocessar
    const { data: analiseExistente } = await supabaseAdmin
      .from("agentes_analises")
      .select("pesquisador_status, pesquisador_feedback_juiz")
      .eq("id_issue", issueKey)
      .single()

    if (
      analiseExistente?.pesquisador_status === "concluido" &&
      !analiseExistente?.pesquisador_feedback_juiz
    ) {
      console.log(`⏭️ [Pesquisador] ${issueKey} já pesquisado, pulando`)
      continue
    }

    try {
      const { data: demanda } = await supabaseAdmin
        .from("jira_issues_agente_demandas")
        .select("titulo, descricao")
        .eq("id_issue", issueKey)
        .single()

      if (!demanda) continue

      const { data: analiseAtual } = await supabaseAdmin
        .from("agentes_analises")
        .select("pesquisador_feedback_juiz, juiz_pontos_criticos_pesquisa")
        .eq("id_issue", issueKey)
        .single()

      const feedbackJuiz = analiseAtual?.pesquisador_feedback_juiz || null
      const pontosParaPesquisa = Array.isArray(analiseAtual?.juiz_pontos_criticos_pesquisa)
        ? analiseAtual.juiz_pontos_criticos_pesquisa.join("\n")
        : analiseAtual?.juiz_pontos_criticos_pesquisa || null
      const feedbackEfetivo = pontosParaPesquisa || feedbackJuiz || null

      const titulo = demanda.titulo || ""
      const descricao = demanda.descricao || ""

      if (feedbackEfetivo) {
        console.log(`  ⚠️ Feedback do juiz recebido: ${feedbackEfetivo}`)
      }

      // ─── 1. Base de conhecimento — sempre, vem primeiro ──────────────────
      const { data: embeddingDemanda } = await supabaseAdmin
        .from("jira_issues_embeddings")
        .select("embedding")
        .eq("id_issue", issueKey)
        .single()

      const chunksManual = embeddingDemanda
        ? await buscarBaseConhecimento(embeddingDemanda.embedding)
        : ""

      const conhecimento_sistema = await extrairConhecimentoDoManual(titulo, descricao, chunksManual)
      console.log(`  Base conhecimento: ${conhecimento_sistema.length} chars`)

      // ─── 2. LLM decide se pesquisa web é necessária ──────────────────────
      const decisao = await avaliarNecessidadePesquisa(
        titulo,
        descricao,
        agente.prompt_sistema,
        conhecimento_sistema,
        feedbackEfetivo
      )

      console.log(`  Pesquisa web: ${decisao.pesquisa_web_realizada ? "SIM" : "NÃO"} — ${decisao.motivo_pesquisa}`)

      // ─── 3. Tavily — só se o LLM decidir que precisa ─────────────────────
      let referencias_legais = "Pesquisa web não realizada — demanda operacional interna."
      let intencoes: string[] = []
      let totalResultados = 0
      let topResultados = 0

      if (decisao.pesquisa_web_realizada) {
        intencoes = feedbackEfetivo
          ? await gerarIntencoesDoFeedback(feedbackEfetivo)
          : await gerarIntencoesBusca(titulo, descricao)

        console.log(`  Intenções: ${intencoes.join(" | ")}`)

        const todosResultados: { title: string; content: string; score: number; url: string }[] = []

        for (const intencao of intencoes) {
          try {
            const resultados = await tavilySearch(intencao)
            todosResultados.push(...resultados)
          } catch (err: any) {
            console.warn(`⚠️ [Pesquisador] Tavily falhou para "${intencao}":`, err.message)
          }
        }

        const top5Web = todosResultados
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        referencias_legais = top5Web.length > 0
          ? top5Web.map(r => `[${r.title}](${r.url})\n${r.content?.slice(0, 400)}`).join("\n\n---\n\n")
          : "Nenhuma referência encontrada."

        totalResultados = todosResultados.length
        topResultados = top5Web.length
        console.log(`  Tavily: ${totalResultados} resultados → top ${topResultados} selecionados`)
      }

      // ─── 4. Contexto de issues similares ─────────────────────────────────
      const contexto_similares = await buscarContextoSimilares(issueKey)
      console.log(`  Contexto similares: ${contexto_similares.length} chars`)

      // ─── 5. Salva na agentes_analises ────────────────────────────────────
      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          pesquisador_conhecimento_sistema: conhecimento_sistema,
          pesquisador_referencias_legais: referencias_legais,
          pesquisador_contexto_similares: contexto_similares || null,
          pesquisador_intencoes_busca: intencoes.length > 0 ? intencoes : null,
          pesquisador_at: new Date().toISOString(),
          pesquisador_comportamento_mercado: decisao.comportamento_mercado || null,
          pesquisador_riscos: decisao.riscos_potenciais || (
            Array.isArray(analiseAtual?.juiz_pontos_criticos_pesquisa)
              ? analiseAtual.juiz_pontos_criticos_pesquisa.join(", ")
              : analiseAtual?.juiz_pontos_criticos_pesquisa || null
          ),
          pesquisador_status: "concluido",
          pesquisador_feedback_juiz: null,
          status_geral: "em_andamento",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })

      // ─── Log técnico ──────────────────────────────────────────────────────
      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "pesquisador",
        status: "sucesso",
        resultado: {
          pesquisa_web_realizada: decisao.pesquisa_web_realizada,
          motivo_pesquisa: decisao.motivo_pesquisa,
          intencoes,
          total_resultados_web: totalResultados,
          top_resultados_web: topResultados,
          conhecimento_sistema_chars: conhecimento_sistema.length,
          contexto_similares_chars: contexto_similares.length,
        }
      })

      pesquisadas.push(issueKey)
      console.log(`✅ [Pesquisador] ${issueKey} concluído`)

    } catch (err: any) {
      console.error(`❌ [Pesquisador] Erro em ${issueKey}:`, err.message)
      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "pesquisador",
        status: "erro",
        erro: err.message
      })
    }
  }

  console.log(`✅ [Pesquisador] ${pesquisadas.length} demandas pesquisadas`)
  return pesquisadas
}