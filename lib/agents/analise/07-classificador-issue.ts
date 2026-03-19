import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Plataforma = "WEB" | "DESKTOP" | "INTEGRAÇÃO"
interface MapeadorResult {
  plataforma: Plataforma
  devEscolhido: Record<string, any> | null
}

const FALLBACK_CONFIG = {
  prompt_sistema: `Você é um coordenador técnico responsável por escolher o developer mais adequado para uma demanda.

Receberá:
- título da demanda
- análise técnica
- lista de developers com suas habilidades

TAREFA

Escolha o developer cuja habilidade técnica mais se aproxima da demanda.

REGRAS

- Considere apenas habilidades técnicas.
- Ignore regras de negócio, textos funcionais ou explicações de usuário.
- Não deduza linguagem de programação.
- Compare apenas o tipo de sistema, módulo ou área técnica com as habilidades listadas.

CRITÉRIO

Escolha o developer cuja habilidade tenha maior relação direta com a demanda.

SAÍDA

Responda APENAS com JSON válido.

{
  "plataforma": "WEB|DESKTOP",
  "habilidades": ["React","Delphi"]
}

Não escreva explicações. Apenas o JSON.`,
  llm_model: "gpt-4o-mini",
  temperature: 0.1,
} as const

export async function agenteMapeadorDev(issueKey: string): Promise<MapeadorResult | undefined> {
  console.log(`🎯 [Mapeador] Classificando logística para ${issueKey}...`)

  try {
    // 0️⃣ CONFIG: BANCO > FALLBACK
    const { data: agenteConfig, error: configError } = await supabaseAdmin
      .from("agentes")
      .select("prompt_sistema, llm_model, temperature")
      .eq("slug", "mapeador")
      .eq("id", "ab3fe242-86f0-44cf-8fcc-296344bb5321")
      .eq("ativo", true)
      .single()

    const config = agenteConfig || FALLBACK_CONFIG
    if (configError || !agenteConfig) {
      console.warn("⚠️ Usando FALLBACK config")
    } else {
      console.log("✅ Config do banco")
    }

    // 1️⃣ Análise
    const { data: analise, error: analiseError } = await supabaseAdmin
      .from("agentes_analises")
      .select("escritor_resultado, escritor_resultado_editado, plataforma, desenvolvedor_jira_id")
      .eq("id_issue", issueKey)
      .single()

    if (analiseError || !analise) {
      console.error("❌ Análise:", analiseError?.message)
      return
    }

    // Já mapeado manualmente?
    if (analise.plataforma && analise.desenvolvedor_jira_id) {
      console.log("ℹ️ Mapeamento manual detectado")
      const { data: devInfo } = await supabaseAdmin
        .from("jira_hos_agentes_mapeamento_membros")
        .select("nome_exibicao")
        .eq("jira_member_assigned_id", analise.desenvolvedor_jira_id)
        .single()
      return {
        plataforma: analise.plataforma as Plataforma,
        devEscolhido: devInfo || null,
      }
    }

    const textoTecnico = analise.escritor_resultado_editado || analise.escritor_resultado
    if (!textoTecnico?.trim()) {
      console.error("❌ Sem texto técnico")
      return
    }

    // 1️⃣.2 Título + resumo da issue
    const { data: demanda } = await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .select("titulo")
      .eq("id_issue", issueKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    const { data: issueResumo } = await supabaseAdmin
      .from("jira_issues")
      .select("resumo")
      .eq("issue_key", issueKey)
      .single()

    // 2️⃣ Extrai plataforma do resumo via regex (DESKTOP | WEB | INTEGRAÇÃO)
    let plataforma: Plataforma | null = null
    let habilidades: string[] = []

    const resumo = issueResumo?.resumo || ""
    const matchResumo = resumo.match(/\b(DESKTOP|WEB|INTEGRA[ÇC][AÃ]O)\b/i)

    if (matchResumo) {
      const match = matchResumo[1].toUpperCase()
      if (match === "WEB") {
        plataforma = "WEB"
      } else {
        // DESKTOP e INTEGRAÇÃO → setor DESENV DESKTOP
        plataforma = "DESKTOP"
      }
      console.log(`🏷️ [Mapeador] Plataforma extraída do resumo: "${matchResumo[1]}" → ${plataforma}`)
    } else {
      // 3️⃣ Fallback: LLM decide a plataforma
      console.log(`⚠️ [Mapeador] Resumo sem indicador de plataforma — usando LLM`)

      const model = config.llm_model
      const useSchema = model.startsWith("gpt-4o")

      const response = await openai.chat.completions.create({
        model,
        temperature: config.temperature,
        messages: [
          { role: "system", content: config.prompt_sistema },
          {
            role: "user",
            content: `Título: ${demanda?.titulo || "N/A"}\nAnálise: ${textoTecnico.slice(0, 8000)}`,
          },
        ],
        ...(useSchema && {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "mapeamento",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  plataforma: { type: "string", enum: ["WEB", "DESKTOP"] },
                  habilidades: { type: "array", items: { type: "string" } },
                },
                required: ["plataforma", "habilidades"],
                additionalProperties: false,
              },
            },
          },
        }),
      })

      let info: { plataforma?: string; habilidades?: string[] }
      try {
        const raw = JSON.parse(response.choices[0].message.content || "{}")
        info = raw?.JSON ?? raw
      } catch {
        console.error("❌ JSON inválido")
        return
      }

      habilidades = Array.isArray(info.habilidades) ? info.habilidades : []

      if (!info.plataforma || !["WEB", "DESKTOP"].includes(info.plataforma)) {
        console.error("❌ Plataforma inválida:", info)
        return
      }

      plataforma = info.plataforma as Plataforma
    }

    if (!plataforma) {
      console.error("❌ Não foi possível determinar a plataforma")
      return
    }

    // 4️⃣ Membros — ✅ CORRIGIDO: !inner para filtro funcionar no join
    const setorJira = plataforma === "WEB" ? "DESENV WEB" : "DESENV DESKTOP"

    const { data: membros, error: membrosError } = await supabaseAdmin
      .from("jira_hos_agentes_mapeamento_membros")
      .select(`
        *,
        jira_members!inner (
          ativo,
          setor
        )
      `)
      .eq("jira_members.ativo", true)
      .eq("jira_members.setor", setorJira)

    if (membrosError) {
      console.error("❌ Membros:", membrosError.message)
      return
    }

    if (!membros?.length) {
      console.error("🚨 Sem devs ativos:", plataforma, setorJira)
      await supabaseAdmin
        .from("agentes_analises")
        .update({
          precisa_intervencao_humana: true,
          aguardando_processar: false,
        })
        .eq("id_issue", issueKey)
      return
    }

    const devEscolhido =
      membros.find((m: any) => m.habilidades?.some((h: string) => habilidades.includes(h))) ??
      membros[0]!

    // 5️⃣ Salva
    const { error: analiseUpdateError } = await supabaseAdmin
    .from("agentes_analises")
    .update({
        plataforma,
        desenvolvedor_jira_id: devEscolhido.jira_member_assigned_id,
        precisa_intervencao_humana: false,
        updated_at: new Date().toISOString(),
    })
    .eq("id_issue", issueKey)

    const { error: demandaUpdateError } = await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .update({
        aguardando_processar: true,
        update_at: new Date().toISOString(),
    })
    .eq("id_issue", issueKey)
    .order("created_at", { ascending: false })
    .limit(1)  // ← mais recente

    if (analiseUpdateError) {
    console.error("❌ Update analises:", analiseUpdateError.message)
    return
    }
    if (demandaUpdateError) {
    console.error("❌ Update demandas:", demandaUpdateError.message)
    return
    }

    console.log(
      `✅ [Mapeador] ${issueKey} → ${plataforma} | ${devEscolhido.nome_exibicao} (${habilidades.join(", ")})`
    )
    return { plataforma, devEscolhido }
  } catch (err: any) {
    console.error(`❌ [Mapeador] ${issueKey}:`, err)
  }
}