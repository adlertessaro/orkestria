import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabase"
import { agenteNormalizador } from "@/lib/agents/analise/02-normalizador"
import { agenteTriagem } from "@/lib/agents/analise/03-triagem"
import { agentePesquisador } from "@/lib/agents/analise/04-pesquisador"
import { agenteAnalistaEscritor } from "@/lib/agents/analise/05-analista-escritor"
import { agenteRevisorJuiz } from "@/lib/agents/analise/06-revisor-juiz"

const TEST_KEY = "HOS-507"

export async function GET() {
  try {
    console.log(`🧪 Preparando issue ${TEST_KEY} para teste...`)

    // Busca a issue original
    const { data: issue } = await supabaseAdmin
      .from("jira_issues")
      .select("issue_key, resumo, description")
      .eq("issue_key", TEST_KEY)
      .single()

    if (!issue) {
      return NextResponse.json({ error: `Issue ${TEST_KEY} não encontrada.` }, { status: 404 })
    }

    // Garante que ela está na tabela do agente
    await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .upsert({
        id_issue: issue.issue_key,
        titulo: issue.resumo,
        descricao: issue.description,
        processado: false,
      }, { onConflict: "id_issue" })

    console.log(`✅ ${TEST_KEY} injetada. Iniciando pipeline a partir do Normalizador...`)

    // Pula o Coletor — força a HOS-507 direto no pipeline
    const normalizadas = await agenteNormalizador([TEST_KEY])
    const aprovadas = await agenteTriagem(normalizadas)
    const pesquisadas = await agentePesquisador(aprovadas)
    const escritas = await agenteAnalistaEscritor(pesquisadas)
    await agenteRevisorJuiz(escritas)

    return NextResponse.json({ success: true, message: `Pipeline finalizado para ${TEST_KEY}` })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
