import { supabaseAdmin } from "@/lib/supabase/supabase"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const JIRA_BASE_URL = "https://hossistemas.atlassian.net/browse"

function linkIssue(issueKey: string): string {
  return `[${issueKey}](${JIRA_BASE_URL}/${issueKey})`
}

function extrairNumero(issueKey: string): number {
  return parseInt(issueKey.replace("HOS-", ""), 10)
}

// ─── HELPERS DE GRAVAÇÃO ──────────────────────────────────────────────────────

async function buscarIdIssue(issueKey: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("jira_issues")
    .select("id")
    .eq("issue_key", issueKey)
    .single()
  return data?.id || null
}

async function cancelarIssue(
  issueKey: string,
  referenciaKey: string,
  score: number,
  isDuplicata: boolean
) {
  const mensagem = isDuplicata
    ? `⛔⛔
    A ideia não está sendo aceita e está sendo cancelada por se tratar de uma solicitação em duplicidade.
Durante a análise, identificamos que já existe outra ideia registrada com o mesmo objetivo ou relato, o que pode gerar duplicidade no processo de avaliação e acompanhamento pela equipe de Análise.
Para evitar retrabalho e manter a organização das solicitações, a análise seguirá apenas pela ideia já existente relacionada ao mesmo tema.
Caso existam novas informações ou evidências que não estejam registradas na solicitação original, orientamos a abertura de uma nova ideia com os detalhes para nova verificação.
Ideia referência: ${referenciaKey}.`
    : `⛔⛔
    A ideia não está sendo aceita e está sendo cancelada pois trata de um assunto com elevada similaridade a outra solicitação já existente.
Durante a análise, identificamos que o tema apresentado segue a mesma linha de necessidade ou objetivo de outra ideia já registrada, o que pode gerar sobreposição na avaliação e no acompanhamento das demandas.
Para manter a organização e evitar análises paralelas sobre o mesmo contexto, a tratativa seguirá pela solicitação já existente que aborda esse tema.
Caso existam novos cenários, evidências ou detalhes diferentes do que já foi registrado, orientamos a abertura de uma nova ideia para que a equipe de Análise possa avaliar novamente. 
Demanda com (${(score * 100).toFixed(0)}%) de similaridade em relação a demanda ${referenciaKey}.`

  // Atualiza retorno_analise na jira_issues
  await supabaseAdmin
    .from("jira_issues")
    .update({ retorno_analise: mensagem })
    .eq("issue_key", issueKey)

  // Comentário visível no Jira da issue cancelada
  const issueId = await buscarIdIssue(issueKey)
  if (issueId) {
    await supabaseAdmin.from("jira_comments").insert({
      issue_id: issueId,
      autor: "Agente de Triagem",
      corpo_comentario: mensagem,
      aguardando_processar: true,
      sincronizado_jira: false,
    })
  }

  // Marca aguardando_processar na jira_issues_agente_demandas
  await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .update({ aguardando_processar: true })
    .eq("id_issue", issueKey)

  // Atualiza agentes_analises
  await supabaseAdmin
    .from("agentes_analises")
    .upsert({
      id_issue: issueKey,
      triagem_status: "reprovado",
      triagem_motivo: isDuplicata
        ? `Duplicata de ${referenciaKey}`
        : `Muito similar a ${referenciaKey} (${(score * 100).toFixed(0)}%)`,
      triagem_at: new Date().toISOString(),
      requer_intervencao: false,
      status_geral: "Bloqueado",
      escritor_resultado: mensagem,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id_issue" })

  // Log técnico
  await supabaseAdmin.from("agentes_execucoes").insert({
    id_issue: issueKey,
    agente_slug: "triagem",
    status: "cancelado",
    resultado: {
      motivo: isDuplicata ? "duplicata" : "muito_similar",
      referencia: referenciaKey,
      similaridade: score,
    }
  })

  console.log(`🚫 [Triagem] ${issueKey} cancelado → referência ${referenciaKey} (${(score * 100).toFixed(0)}%)`)
}

async function inserirComentarioReferencia(
  referenciaKey: string,
  canceladas: { issueKey: string; score: number; isDuplicata: boolean }[]
) {
  const issueId = await buscarIdIssue(referenciaKey)
  if (!issueId) return

  const linhas = canceladas.map(c => {
    const tipo = c.isDuplicata
      ? "duplicata consolidada aqui"
      : `similar (${(c.score * 100).toFixed(0)}%) consolidada aqui`
    return `- ${linkIssue(c.issueKey)} — ${tipo}`
  }).join("\n")

  const corpo = `Ao analisar esta demanda, considerar também:\n${linhas}`

  await supabaseAdmin.from("jira_comments").insert({
    issue_id: issueId,
    autor: "Agente de Triagem",
    corpo_comentario: corpo,
    aguardando_processar: true,
    sincronizado_jira: false,
  })

  console.log(`💬 [Triagem] Comentário inserido na referência ${referenciaKey}`)
}

// ─── AVALIAÇÃO DE MATURIDADE VIA LLM ─────────────────────────────────────────

async function avaliarMaturidade(
  issueKey: string,
  titulo: string,
  descricao: string,
  promptSistema: string,
  llmModel: string
): Promise<{ aprovado: boolean; resultado: any }> {
  const resposta = await openai.chat.completions.create({
    model: llmModel || "gpt-4o-mini",
    messages: [
      { role: "system", content: promptSistema },
      {
        role: "user", content:
          `Título: ${titulo}\nDescrição: ${descricao?.slice(0, 500)}`
      }
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: "json_object" },
  })

  const resultado = JSON.parse(resposta.choices[0]?.message?.content || "{}")
  const aprovado = resultado.DECISAO === "APROVADO"
  return { aprovado, resultado }
}

// ─── AGENTE PRINCIPAL ─────────────────────────────────────────────────────────

export async function agenteTriagem(issueKeys: string[]): Promise<string[]> {
  console.log(`🔬 [Triagem] Analisando ${issueKeys.length} demandas...`)

  const { data: agente } = await supabaseAdmin
    .from("agentes")
    .select("prompt_sistema, llm_model")
    .eq("slug", "triagem")
    .single()

  if (!agente) {
    console.error("❌ [Triagem] Agente não encontrado no banco")
    return []
  }

  const aprovadas: string[] = []

  const STATUS_PERMITIDOS = ["Backlog", "Aguardando Análise"]

  for (const issueKey of issueKeys) {
  // Guard fora do try — não custa nada, só leitura

  // Verifica se o status da issue permite processamento
  const { data: issueStatus } = await supabaseAdmin
    .from("jira_issues")
    .select("status, resumo")
    .eq("issue_key", issueKey)
    .single()

  if (!issueStatus || !STATUS_PERMITIDOS.includes(issueStatus.status)) {
    console.log(`⏭️ [Triagem] ${issueKey} ignorada — status "${issueStatus?.status ?? "desconhecido"}" não permitido`)
    continue
  }

  if (/^manual:/i.test(issueStatus.resumo?.trim() || "")) {
    console.log(`⏭️ [Triagem] ${issueKey} ignorada — é um manual (resumo: "${issueStatus.resumo?.slice(0, 50)}")`)
    continue
  }

  const { data: analiseExistente } = await supabaseAdmin
    .from("agentes_analises")
    .select("triagem_status")
    .eq("id_issue", issueKey)
    .single()

  if (analiseExistente?.triagem_status) {
    console.log(`⏭️ [Triagem] ${issueKey} já triada (${analiseExistente.triagem_status}), pulando`)
    continue
  }

  try {
    // Busca demanda
    const { data: demanda } = await supabaseAdmin
      .from("jira_issues_agente_demandas")
      .select("titulo, descricao")
      .eq("id_issue", issueKey)
      .single()

    if (!demanda) continue

    // Busca embedding
    const { data: embeddingAtual } = await supabaseAdmin
      .from("jira_issues_embeddings")
      .select("embedding")
      .eq("id_issue", issueKey)
      .single()

    if (!embeddingAtual) {
      console.warn(`⚠️ [Triagem] ${issueKey} sem embedding, pulando`)
      continue
    }

      // Busca similares via pgvector
      const { data: similares } = await supabaseAdmin.rpc("buscar_demandas_similares", {
        embedding_input: embeddingAtual.embedding,
        id_issue_ignorar: issueKey,
        limite: 5
      })

      console.log(`🔍 [Triagem] ${issueKey} — similares: ${similares?.length ?? 0}`)

      // ─── Classifica similares por score ────────────────────────────────────
      const duplicatas = (similares || []).filter((s: any) => s.similaridade>= 0.96)
      const muitoSimilares = (similares || []).filter((s: any) => s.similaridade>= 0.90 && s.similaridade< 0.96)
      const relevantes = [...duplicatas, ...muitoSimilares]

      if (relevantes.length > 0) {
        // Verifica se alguma similar está em andamento (não cancelada/pendente)
        const keysRelevantes = relevantes.map((s: any) => s.id_issue)

        const { data: issuesRelevantes } = await supabaseAdmin
          .from("jira_issues")
          .select("issue_key, status")
          .in("issue_key", keysRelevantes)

        const emAndamento = issuesRelevantes?.find(i =>
          !["Cancelado", "Cancelada", "Pendente", "Backlog"].includes(i.status)
        )

        // Define a referência
        const todasKeys = [issueKey, ...keysRelevantes]
        const referencia = emAndamento
          ? emAndamento.issue_key
          : todasKeys.sort((a, b) => extrairNumero(b) - extrairNumero(a))[0] // mais nova

        const canceladas: { issueKey: string; score: number; isDuplicata: boolean }[] = []

        // Cancela todas exceto a referência
        for (const similar of relevantes as any[]) {
          if (similar.id_issue === referencia) continue
          const isDuplicata = similar.similaridade>= 0.96
          await cancelarIssue(similar.id_issue, referencia, similar.similaridade, isDuplicata)
          canceladas.push({ issueKey: similar.id_issue, score: similar.similaridade, isDuplicata })
        }

        // Se a demanda atual não é a referência, cancela ela também
        if (issueKey !== referencia) {
          const scoreAtual = relevantes.find((s: any) => s.id_issue === referencia)?.similaridade|| 0.96
          const isDuplicata = scoreAtual >= 0.96
          await cancelarIssue(issueKey, referencia, scoreAtual, isDuplicata)
          canceladas.push({ issueKey, score: scoreAtual, isDuplicata })

          // Insere comentário na referência
          if (canceladas.length > 0) {
            await inserirComentarioReferencia(referencia, canceladas)
          }

          // Atualiza agentes_analises da referência se não estava na lista original
          if (!issueKeys.includes(referencia)) {
            await supabaseAdmin
              .from("agentes_analises")
              .upsert({
                id_issue: referencia,
                triagem_status: "aprovado",
                triagem_motivo: "Referência de demandas consolidadas",
                triagem_at: new Date().toISOString(),
                triagem_similares: canceladas,
                requer_intervencao: false,
                status_geral: emAndamento ? "em_andamento" : "em_andamento",
                updated_at: new Date().toISOString(),
              }, { onConflict: "id_issue" })
          }

          // Se há em andamento, não segue pro pesquisador
          if (emAndamento) {
            console.log(`🔁 [Triagem] ${issueKey} consolidado em ${referencia} (em andamento) — não segue`)
          } else {
            console.log(`🔁 [Triagem] ${issueKey} consolidado em ${referencia} (mais nova) — ${referencia} deve seguir`)
          }
          continue
        }

        // issueKey É a referência — insere comentário e segue pro pesquisador (se não há em andamento externo)
        if (canceladas.length > 0) {
          await inserirComentarioReferencia(referencia, canceladas)
        }

        await supabaseAdmin
          .from("agentes_analises")
          .upsert({
            id_issue: issueKey,
            triagem_status: "aprovado",
            triagem_motivo: "Referência — demandas similares consolidadas aqui",
            triagem_similares: canceladas,
            triagem_at: new Date().toISOString(),
            requer_intervencao: false,
            status_geral: "em_andamento",
            updated_at: new Date().toISOString(),
          }, { onConflict: "id_issue" })

        await supabaseAdmin.from("agentes_execucoes").insert({
          id_issue: issueKey,
          agente_slug: "triagem",
          status: "aprovado",
          resultado: { motivo: "referencia", canceladas }
        })

        aprovadas.push(issueKey)
        console.log(`✅ [Triagem] ${issueKey} aprovado como referência`)
        continue
      }

      // ─── Nenhum similar relevante — avalia maturidade via LLM ──────────────
      const { aprovado, resultado } = await avaliarMaturidade(
        issueKey,
        demanda.titulo,
        demanda.descricao,
        agente.prompt_sistema,
        agente.llm_model
      )

      console.log(`🔍 [Triagem] LLM ${issueKey}:`, resultado)

      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "triagem",
        status: aprovado ? "aprovado" : "cancelado",
        resultado
      })

      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          triagem_status: aprovado ? "aprovado" : "reprovado",
          triagem_motivo: resultado.MOTIVO_PRINCIPAL || "",
          triagem_maturidade: resultado.MATURIDADE_DA_DEMANDA || null,
          triagem_elementos_presentes: resultado.ELEMENTOS_PRESENTES || [],
          triagem_elementos_ausentes: resultado.ELEMENTOS_AUSENTES || [],
          triagem_recomendacao: resultado.RECOMENDACAO || null,
          triagem_similares: [],
          triagem_at: new Date().toISOString(),
          requer_intervencao: !aprovado,
          intervencao_motivo: !aprovado ? `Triagem reprovada: ${resultado.MOTIVO_PRINCIPAL}` : null,
          status_geral: aprovado ? "em_andamento" : "Bloqueado",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })

      if (aprovado) {
        aprovadas.push(issueKey)
        console.log(`✅ [Triagem] ${issueKey} aprovado`)
      } else {
        console.log(`🚫 [Triagem] ${issueKey} reprovado — ${resultado.MOTIVO_PRINCIPAL}`)

        const mensagemCancelamento = `⛔⛔
A ideia não está sendo aceita, pois a solicitação apresentada possui descrição insuficiente e imaturidade na definição do que realmente se deseja alterar ou implementar.
Durante a análise, não foram identificadas informações claras sobre o cenário, regra de negócio impactada ou comportamento esperado do sistema, o que impede a validação técnica e a realização de testes consistentes.
Para que a equipe consiga avaliar corretamente, é importante detalhar melhor o contexto, exemplos práticos e o resultado esperado.
Caso novas informações ou evidências sejam reunidas, orientamos que uma nova ideia seja aberta com a descrição mais completa para uma nova análise.`

        // Salva retorno_analise em jira_issues para o postador encontrar
        await supabaseAdmin
          .from("jira_issues")
          .update({ retorno_analise: mensagemCancelamento })
          .eq("issue_key", issueKey)

        // Insere comentário na fila de postagem
        const issueId = await buscarIdIssue(issueKey)
        if (issueId) {
          await supabaseAdmin.from("jira_comments").insert({
            issue_id: issueId,
            autor: "Agente de Triagem",
            corpo_comentario: mensagemCancelamento,
            aguardando_processar: true,
            sincronizado_jira: false,
          })
        }

        // Marca aguardando_processar para o scheduler postar
        await supabaseAdmin
          .from("jira_issues_agente_demandas")
          .update({ aguardando_processar: true })
          .eq("id_issue", issueKey)

        // Salva mensagem em agentes_analises também
        await supabaseAdmin
          .from("agentes_analises")
          .upsert({
            id_issue: issueKey,
            escritor_resultado: mensagemCancelamento,
            updated_at: new Date().toISOString(),
          }, { onConflict: "id_issue" })
      }

    } catch (err: any) {
      console.error(`❌ [Triagem] Erro em ${issueKey}:`, err.message)

      await supabaseAdmin.from("agentes_execucoes").insert({
        id_issue: issueKey,
        agente_slug: "triagem",
        status: "erro",
        erro: err.message
      })

      await supabaseAdmin
        .from("agentes_analises")
        .upsert({
          id_issue: issueKey,
          triagem_status: "erro",
          triagem_motivo: err.message,
          triagem_at: new Date().toISOString(),
          requer_intervencao: true,
          intervencao_motivo: `Erro na triagem: ${err.message}`,
          status_geral: "Bloqueado",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id_issue" })
    }
  }

  console.log(`✅ [Triagem] ${aprovadas.length} aprovadas`)
  return aprovadas
}