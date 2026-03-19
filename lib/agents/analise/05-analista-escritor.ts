import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── PREÇOS ───────────────────────────────────────────────────────────────────

const PRECOS: Record<string, [number, number]> = {
  "gpt-4o":      [2.50, 10.00],
  "gpt-4o-mini": [0.15,  0.60],
}

function calcularCusto(modelo: string, input: number, output: number): number {
  const [pi, po] = PRECOS[modelo] || [0, 0]
  return (input * pi + output * po) / 1_000_000
}

// ─── MODELO DINÂMICO ──────────────────────────────────────────────────────────

function escolherModelo(maturidade: string | null, categoria: string | null): string {
  const isComplexo =
    maturidade === "Alta" ||
    categoria?.toLowerCase().includes("fiscal") ||
    categoria?.toLowerCase().includes("financeiro") ||
    categoria?.toLowerCase().includes("integração")
  return isComplexo ? "gpt-4o" : "gpt-4o-mini"
}

// ─── AGENTE PRINCIPAL ─────────────────────────────────────────────────────────

export async function agenteAnalistaEscritor(issueKeys: string[]): Promise<string[]> {
  console.log(`✍️ [Escritor] Escrevendo ${issueKeys.length} análises...`)

  const { data: agente } = await supabaseAdmin
    .from("agentes")
    .select("prompt_sistema, llm_model, temperature")
    .eq("slug", "analista-escritor")
    .single()

  if (!agente) {
    console.error("❌ [Escritor] Agente não encontrado no banco")
    return []
  }

  const escritas: string[] = []

  for (const issueKey of issueKeys) {
    // Guard — evita reprocessar
    const { data: analiseExistente } = await supabaseAdmin
      .from("agentes_analises")
      .select("escritor_status")
      .eq("id_issue", issueKey)
      .single()

    if (analiseExistente?.escritor_status) {
      console.log(`⏭️ [Escritor] ${issueKey} já escrito (${analiseExistente.escritor_status}), pulando`)
      continue
    }

    try {
      // Busca demanda refinada
      const { data: demanda } = await supabaseAdmin
        .from("jira_issues_agente_demandas")
        .select("titulo, descricao, categoria_embedding")
        .eq("id_issue", issueKey)
        .single()

      if (!demanda) continue

      // Busca contexto do pesquisador + triagem
      const { data: analise } = await supabaseAdmin
        .from("agentes_analises")
        .select(`
          triagem_maturidade,
          triagem_elementos_ausentes,
          pesquisador_conhecimento_sistema,
          pesquisador_referencias_legais,
          pesquisador_contexto_similares,
          juiz_pontos_criticos
        `)
        .eq("id_issue", issueKey)
        .single()

      const temFeedbackJuiz = !!analise?.juiz_pontos_criticos
      const modelo = temFeedbackJuiz
        ? "gpt-4o"  // reprocessamento sempre usa o modelo mais forte
        : escolherModelo(analise?.triagem_maturidade || null, demanda.categoria_embedding || null)


      const titulo = demanda.titulo || ""
      const descricao = demanda.descricao || ""

      console.log(`🤖 [Escritor] ${issueKey} — modelo: ${modelo}`)

      // ─── Monta contexto ────────────────────────────────────────────────────
      const partes: string[] = []

      partes.push(`DEMANDA:\nTítulo: ${titulo}\nDescrição: ${descricao}`)

      if (analise?.pesquisador_conhecimento_sistema) {
        partes.push(`[BASE DE CONHECIMENTO DO SISTEMA]\n${analise.pesquisador_conhecimento_sistema}`)
      }

      if (analise?.pesquisador_referencias_legais) {
        partes.push(`[REFERÊNCIAS WEB — LEGISLAÇÃO E MERCADO]\n${analise.pesquisador_referencias_legais}`)
      }

      if (analise?.pesquisador_contexto_similares) {
        partes.push(`[DEMANDAS SIMILARES ANTERIORES — INCLUIR NO ESCOPO DA ANÁLISE]\n${analise.pesquisador_contexto_similares}`)
      }

      if (analise?.triagem_elementos_ausentes?.length) {
        partes.push(`[ELEMENTOS AUSENTES IDENTIFICADOS NA TRIAGEM — MARCAR COMO RISCO]\n${analise.triagem_elementos_ausentes.join(", ")}`)
      }

      if (analise?.juiz_pontos_criticos) {
        partes.push(`[PONTOS OBRIGATÓRIOS — O JUIZ REPROVOU A VERSÃO ANTERIOR POR ESSES MOTIVOS]\nVocê DEVE cobrir cada um explicitamente na análise.\nSe não houver informação suficiente, registre como "INDEFINIDO — requer decisão do solicitante".\n\n${analise.juiz_pontos_criticos}`)
      }

      const userPrompt = partes.join("\n\n---\n\n")

      
      // ─── Chamada LLM ───────────────────────────────────────────────────────
      const resposta = await openai.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: agente.prompt_sistema },
          { role: "user", content: userPrompt }
        ],
        temperature: agente.temperature || 0.2,
        max_tokens: 2000,
      })

      const documento = resposta.choices[0]?.message?.content || ""
      const usage = resposta.usage
      const custoUsd = calcularCusto(modelo, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)

      console.log(`📄 [Escritor] ${issueKey} — ${documento.length} chars | ${modelo} | $${custoUsd.toFixed(5)}`)


      // ─── Atualiza agentes_analises ────────────────────────────────────────
      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          escritor_status: "gerado",
          escritor_resultado: documento,
          escritor_modelo: modelo,
          escritor_at: new Date().toISOString(),
          status_geral: "Revisar",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })

      // ─── Log técnico ──────────────────────────────────────────────────────
      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "analista-escritor",
        status: "sucesso",
        resultado: {
          modelo,
          tokens_input: usage?.prompt_tokens || 0,
          tokens_output: usage?.completion_tokens || 0,
          custo_usd: custoUsd,
          documento_chars: documento.length,
        }
      })

      escritas.push(issueKey)
      console.log(`✅ [Escritor] ${issueKey} concluído`)

    } catch (err: any) {
      console.error(`❌ [Escritor] Erro em ${issueKey}:`, err.message)

      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "analista-escritor",
        status: "erro",
        erro: err.message
      })

      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          escritor_status: "erro",
          escritor_at: new Date().toISOString(),
          requer_intervencao: true,
          intervencao_motivo: `Erro no escritor: ${err.message}`,
          status_geral: "Bloqueado",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })
    }
  }

  console.log(`✅ [Escritor] ${escritas.length} análises geradas`)
  return escritas
}

// ─── TESTE ────────────────────────────────────────────────────────────────────

// export async function testarEscritor(issueKey: string): Promise<void> {
//   console.log(`🧪 [Teste Escritor] Iniciando para ${issueKey}...`)

//   const { data: demanda } = await supabaseAdmin
//     .from("jira_issues_agente_demandas")
//     .select("titulo, descricao, categoria_embedding")
//     .eq("id_issue", issueKey)
//     .single()

//   if (!demanda) {
//     console.error("❌ Issue não encontrada")
//     return
//   }

//   const { data: analise } = await supabaseAdmin
//     .from("agentes_analises")
//     .select("triagem_maturidade, pesquisador_conhecimento_sistema, pesquisador_referencias_legais, pesquisador_contexto_similares, triagem_elementos_ausentes")
//     .eq("id_issue", issueKey)
//     .single()

//   const modelo = escolherModelo(
//     analise?.triagem_maturidade || null,
//     demanda.categoria_embedding || null
//   )

//   console.log(`\n📋 ${issueKey}`)
//   console.log(`  Título: ${demanda.titulo}`)
//   console.log(`  Categoria: ${demanda.categoria_embedding || "não informada"}`)
//   console.log(`  Maturidade triagem: ${analise?.triagem_maturidade || "não informada"}`)
//   console.log(`  Modelo selecionado: ${modelo}`)
//   console.log(`\n📦 Contexto que seria enviado:`)
//   console.log(`  Conhecimento sistema: ${analise?.pesquisador_conhecimento_sistema?.length || 0} chars`)
//   console.log(`  Referências web: ${analise?.pesquisador_referencias_legais?.length || 0} chars`)
//   console.log(`  Similares: ${analise?.pesquisador_contexto_similares?.length || 0} chars`)
//   console.log(`  Elementos ausentes: ${analise?.triagem_elementos_ausentes?.join(", ") || "nenhum"}`)
//   console.log(`\n✅ [Teste Escritor] Verificado — sem chamar LLM.`)
// }
