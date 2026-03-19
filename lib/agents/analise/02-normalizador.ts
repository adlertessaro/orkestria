import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"
import Groq from "groq-sdk"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const groq = new Groq({ apiKey: process.env.AGENT_AUTH_HELPER_GROQ })

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
]

const OPENAI_MODELS = [
    "gpt-4o-mini",
    "gpt-3.5-turbo",
]

// Preços por 1M tokens (input/output) em USD
const PRECOS: Record<string, [number, number]> = {
  "gpt-4o-mini":              [0.15,  0.60],
  "gpt-3.5-turbo":            [0.50,  1.50],
  "llama-3.3-70b-versatile":  [0.59,  0.79],
  "qwen/qwen3-32b":           [0.29,  0.69],
  "gemma2-9b-it":             [0.20,  0.20],
  "llama-3.1-8b-instant":     [0.05,  0.08],
}

const CATEGORIAS = [
  "Financeiro - Contas a Pagar", "Financeiro - Contas a Receber",
  "Financeiro - Conciliação Bancária", "Financeiro - Fluxo de Caixa",
  "Financeiro - Transferência entre Contas", "Financeiro - Baixa de Títulos",
  "Financeiro - Renegociação de Dívida", "Financeiro - Crediário",
  "Financeiro - Limite de Crédito", "Financeiro - Comissão",
  "Financeiro - Fechamento de Caixa", "Financeiro - Sangria / Suprimento",
  "Financeiro - Relatórios Financeiros",
  "Fiscal - Emissão de NF-e", "Fiscal - Emissão de NFC-e",
  "Fiscal - Cancelamento de Nota", "Fiscal - Carta de Correção",
  "Fiscal - CFOP", "Fiscal - CST / Tributação", "Fiscal - ICMS / ST",
  "Fiscal - PIS / COFINS", "Fiscal - Geração de SPED",
  "Fiscal - SPED Fiscal", "Fiscal - SPED Contribuições",
  "Fiscal - Integração Contábil", "Fiscal - Sintegra",
  "Vendas - Frente de Caixa", "Vendas - Cancelamento de Venda",
  "Vendas - Devolução", "Vendas - Troca de Produto", "Vendas - Desconto",
  "Vendas - Promoções", "Vendas - Multiplos / Leve Pague",
  "Vendas - Farmácia Popular", "Vendas - Convênios", "Vendas - TEF",
  "Vendas - Cartão Crédito", "Vendas - Cartão Débito", "Vendas - PIX",
  "Vendas - Boleto", "Vendas - Relatórios de Vendas",
  "Estoque - Cadastro de Produto", "Estoque - Código de Barras",
  "Estoque - Controle de Lote", "Estoque - Validade", "Estoque - Inventário",
  "Estoque - Ajuste de Estoque", "Estoque - Transferência entre Filiais",
  "Estoque - Entrada de Mercadoria", "Estoque - Conferência de Nota",
  "Compras - Pedido de Compra", "Compras - Sugestão de Compra",
  "Compras - Cotação", "Compras - Recebimento de Mercadoria",
  "Compras - Bonificação de Fornecedor", "Compras - Crédito de Fornecedor",
  "Clientes - Cadastro", "Clientes - Limite de Crédito",
  "Clientes - Histórico de Compras", "Clientes - Análise de Crédito",
  "Clientes - Convênios",
  "Integração - API", "Integração - ERP", "Integração - E-commerce",
  "Integração - Ifood", "Integração - Scanntech", "Integração - PBM",
  "Integração - Contábil", "Integração - Marketplace", "Integração - My Pharma",
  "Integração - Gestão", "Integração - Pharma Link", "Integração - Farmacias APP",
  "Integração - IQVIA", "Integração - MARKA", "Integração - SystemFarma",
  "Integração - Amplacard", "Integração - NAPP", "Integração - Agafarma",
  "Relatórios - Vendas", "Relatórios - Financeiro", "Relatórios - Fiscal",
  "Relatórios - Estoque", "Relatórios - Gerenciais", "Relatórios - Comissões",
  "Configuração - Parâmetros do Sistema", "Configuração - Permissões",
  "Configuração - Perfil de Usuário", "Configuração - Filiais",
  "Configuração - Integrações",
  "Bug / Correção", "Nova Funcionalidade", "Melhoria / Refatoração",
  "Documentação", "Infraestrutura / DevOps",
]

// ─── LIMPEZA ──────────────────────────────────────────────────────────────────

function normalizarTitulo(titulo: string): string {
  if (!titulo) return ""
  if (/^an[aá]lise de ideia/i.test(titulo)) {
    const partes = titulo.split(" - ")
    const METADADOS = new Set(["melhoria", "bug", "nova funcionalidade", "importante",
      "crítico", "urgente", "baixa", "média", "alta", "normal"])
    while (partes.length > 3 && METADADOS.has(partes[partes.length - 1].trim().toLowerCase())) {
      partes.pop()
    }
    titulo = partes.slice(2).join(" - ").trim()
  }
  return titulo.charAt(0).toUpperCase() + titulo.slice(1)
}

function extrairDescricao(texto: string): string {
  if (!texto) return ""

  // Prioridade 1: tudo após "Descrição:"
  const matchDesc = texto.match(/Descri[çc][aã]o:[ \t]*\r?\n?([\s\S]+)/i)
  if (matchDesc) {
    return matchDesc[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
  }

  // Prioridade 2: tudo após "Objetivo:"
  const matchObj = texto.match(/Objetivo:[ \t]*(.+)/i)
  if (matchObj) return matchObj[1].trim()

  // Prioridade 3: remove linhas de metadados conhecidos
  const METADADOS = /^(Uma nova solicitação|Criado em|Nº da Ideia|Prazo de retorno|Tipo|Prioridade|Atribuição|Solicitado por|E-mail|Cliente|CRM|Produto)[:\s]/i
  const linhasUteis = texto.split("\n").filter(l => !METADADOS.test(l.trim()))
  return linhasUteis.join("\n").trim() || texto
}

function limparTexto(texto: string): string {
  if (!texto) return ""
  return texto
    .replace(/^(olá|oi|bom dia|boa tarde|boa noite|prezados?|att|atenciosamente|obrigad[oa]|grato|grata)[,.\s!]*/gim, "")
    .replace(/^[-_*=]{3,}\s*$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map(l => l.trim()).join("\n")
    .replace(/ {2,}/g, " ")
    .trim()
}

function prepararTexto(titulo: string, descricao: string): [string, string, string] {
  const tituloLimpo = normalizarTitulo(limparTexto(titulo))
  const descricaoLimpa = limparTexto(extrairDescricao(descricao))
  const textoCompleto = `${tituloLimpo}\n${descricaoLimpa}`.trim()
  return [tituloLimpo, descricaoLimpa, textoCompleto]
}

// ─── CLASSIFICAÇÃO ────────────────────────────────────────────────────────────

function calcularCusto(modelo: string, inputTokens: number, outputTokens: number): number {
  const [precoInput, precoOutput] = PRECOS[modelo] || [0, 0]
  return (inputTokens * precoInput + outputTokens * precoOutput) / 1_000_000
}

async function classificar(titulo: string, descricao: string): Promise<[string, string, object]> {
  const categoriasStr = CATEGORIAS.map(c => `- ${c}`).join("\n")
  const systemPrompt = `
    Classifique tickets de ERP de farmácia.

    Escolha UMA categoria da lista.

    Regras:
    - Use somente categorias da lista
    - Sempre retorne a mesma categoria para textos iguais
    - Não explique nada
    - Retorne apenas JSON

    Categorias:
    ${categoriasStr}

    Formato:
    {"categoria_completa":"Categoria - Subcategoria"}
    `

  const userPrompt = `
    Título: ${titulo || "Sem título"}
    Descrição: ${descricao || "Sem descrição"}
    `

  const modelos_groq = [...GROQ_MODELS]
  const modelos_openai = [...OPENAI_MODELS]

  // ─── Tenta OpenAI primeiro ────────────────────────────────────────────────
  for (const modelo of modelos_openai) {
    try {
      const response = await openai.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 60,
        response_format: { type: "json_object" },
      })

      const conteudo = response.choices[0]?.message?.content?.trim() || ""
      const resultado = JSON.parse(conteudo)
      let categoriaCompleta: string = resultado.categoria_completa || "Bug / Correção"

      if (!CATEGORIAS.includes(categoriaCompleta)) {
        categoriaCompleta = CATEGORIAS.find(c =>
          categoriaCompleta.toLowerCase().includes(c.toLowerCase())
        ) || "Bug / Correção"
      }

      const usage = response.usage
      const custoUsd = calcularCusto(modelo, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
      const usageInfo = { modelo, tokens_input: usage?.prompt_tokens || 0, tokens_output: usage?.completion_tokens || 0, custo_usd: custoUsd }

      const [categoria, subcategoria] = categoriaCompleta.includes(" - ")
        ? categoriaCompleta.split(" - ", 2) as [string, string]
        : [categoriaCompleta, categoriaCompleta]

      return [categoria, subcategoria, usageInfo]

    } catch (err: any) {
      console.warn(`⚠️ [Normalizador] OpenAI '${modelo}' falhou:`, err.message)
    }
  }

  // ─── Fallback Groq ────────────────────────────────────────────────────────

  while (modelos_groq.length > 0) {
    const modelo = modelos_groq[0]
    try {
      const response = await groq.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 40,
        // response_format: { type: "json_object" }, //nem todos os modelos suportam isso, então vamos validar o JSON manualmente
      })

      const conteudo = response.choices[0]?.message?.content?.trim() || ""

      // Tenta parse direto
      let categoriaCompleta = "Bug / Correção"
      try {
        const json = JSON.parse(conteudo)
        categoriaCompleta = json.categoria_completa || "Bug / Correção"
      } catch {
        // Fallback: extrai com regex se o modelo não retornou JSON puro
        const match = conteudo.match(/"categoria_completa"\s*:\s*"([^"]+)"/)
        if (match) categoriaCompleta = match[1]
      }

      if (!CATEGORIAS.includes(categoriaCompleta)) {
        categoriaCompleta = CATEGORIAS.find(c =>
          categoriaCompleta.toLowerCase().includes(c.toLowerCase())
        ) || "Bug / Correção"
      }

      const usage = response.usage
      const custoUsd = calcularCusto(modelo, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
      const usageInfo = { modelo, tokens_input: usage?.prompt_tokens || 0, tokens_output: usage?.completion_tokens || 0, custo_usd: custoUsd }

      const [categoria, subcategoria] = categoriaCompleta.includes(" - ")
        ? categoriaCompleta.split(" - ", 2) as [string, string]
        : [categoriaCompleta, categoriaCompleta]

      console.log(`🏷️ [Normalizador] ${modelo} (fallback) → ${categoriaCompleta} (${custoUsd.toFixed(6)} USD)`)
      return [categoria, subcategoria, usageInfo]

    } catch (err: any) {
      const msg = err.message || ""
      if (msg.includes("rate_limit_exceeded") || msg.includes("model_decommissioned") || msg.includes("json_validate_failed")) {
        modelos_groq.shift()
      if (modelos_groq.length > 0) console.warn(`⚠️ [Normalizador] '${modelo}' indisponível → trocando para '${modelos_groq[0]}'`)
      } else {
        throw err
      }
    }
  }

  return ["Bug / Correção", "Bug / Correção", { modelo: "none", tokens_input: 0, tokens_output: 0, custo_usd: 0 }]
}

// ─── EMBEDDING ────────────────────────────────────────────────────────────────

async function salvarEmbedding(idIssue: string, embedding: number[]): Promise<boolean> {
  const { data: existente } = await supabaseAdmin
    .from("jira_issues_embeddings")
    .select("no_update")
    .eq("id_issue", idIssue)
    .single()

  if (existente?.no_update === true) {
    console.log(`🔒 [Normalizador] Embedding bloqueado para ${idIssue}, pulando...`)
    return false
  }

  await supabaseAdmin
    .from("jira_issues_embeddings")
    .upsert({
      id_issue: idIssue,
      embedding,
      no_update: true,
      update_at: new Date().toISOString()
    }, { onConflict: "id_issue" })

  console.log(`💾 Embedding salvo: ${idIssue}`)
  return true
}

// ─── AGENTE ───────────────────────────────────────────────────────────────────

export async function agenteNormalizador(issueKeys: string[]): Promise<string[]> {
  const normalizadas: string[] = []

  for (const issueKey of issueKeys) {
    try {
      // Busca com log detalhado
      const { data: demanda } = await supabaseAdmin
        .from("jira_issues_agente_demandas")
        .select("titulo, descricao, categoria_embedding, subcategoria_embedding")
        .eq("id_issue", issueKey)
        .maybeSingle()

      if (!demanda) {
        console.log(`⏭️ [Normalizador] ${issueKey} não encontrado na fila`)
        continue
      }

      // Pula se já processado
      if (demanda.categoria_embedding && demanda.subcategoria_embedding) {
        console.log(`⏭️ [Normalizador] ${issueKey} já categorizado`)
        continue
      }

      // Pula se sem conteúdo
      if (!demanda.titulo?.trim() || !demanda.descricao?.trim()) {
        console.log(`⏭️ [Normalizador] ${issueKey} sem conteúdo válido`)
        await supabaseAdmin
          .from("jira_issues_agente_demandas")
          .update({ processado: true })
          .eq("id_issue", issueKey)
        continue
      }

      console.log(`🔄 [Normalizador] Processando ${issueKey}`)

      // 1. Normaliza texto
      const [tituloLimpo, descricaoLimpa, textoCompleto] = prepararTexto(
        demanda.titulo,
        demanda.descricao
      )

      // 2. Embedding (só se não existir ou não bloqueado)
      let embeddingSalvo = false
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: textoCompleto,
        })
        embeddingSalvo = await salvarEmbedding(issueKey, embeddingResponse.data[0].embedding)
      } catch (err: any) {
        console.error(`❌ [Normalizador] Erro embedding ${issueKey}:`, err.message)
        continue  // ← PULA SEM CUSTO SE FALHAR
      }

      if (!embeddingSalvo) {
        console.log(`🔒 [Normalizador] Embedding bloqueado ${issueKey}, só categoriza`)
      }

      // 3. Categorização
      const [categoria, subcategoria, usageInfo] = await classificar(tituloLimpo, descricaoLimpa)

      // 4. Salva TUDO de uma vez (atômico)
      const updateResult = await supabaseAdmin
        .from("jira_issues_agente_demandas")
        .upsert({
          id_issue: issueKey,
          titulo: tituloLimpo,
          descricao: descricaoLimpa,
          categoria_embedding: categoria,
          subcategoria_embedding: subcategoria,
          processado: true,
          update_at: new Date().toISOString()
        }, { onConflict: "id_issue" })
        .select("id_issue")

      if (updateResult.data && updateResult.data.length > 0) {
        await supabaseAdmin
          .from("agentes_execucoes")
          .upsert({
            id_issue: issueKey,
            agente_slug: "normalizador",
            status: "sucesso",
            resultado: { 
              categoria, 
              subcategoria, 
              chars: textoCompleto.length,
              usage: usageInfo 
            }
          }, { onConflict: "id_issue, agente_slug" })

        normalizadas.push(issueKey)
        console.log(`✅ [Normalizador] ${issueKey} → ${categoria} / ${subcategoria}`)
      }

    } catch (err: any) {
      console.error(`💥 [Normalizador] FALHA TOTAL ${issueKey}:`, err.message)
    }
  }

  console.log(`🎉 [Normalizador] ${normalizadas.length}/${issueKeys.length} processadas`)
  return normalizadas
}
