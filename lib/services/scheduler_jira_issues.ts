import cron from "node-cron"
import { supabaseAdmin } from "../supabase/supabase"
import { sincronizarComentariosJiraAction} from "@/app/(dashboard)/analises-avancadas/demandas/relatorios/actions/actions-comentarios"
import { criarLogSincronizacaoAction, atualizarLogSincronizacaoAction, finalizarLogSincronizacaoAction } from "@/app/(dashboard)/analises-avancadas/demandas/relatorios/actions/actions-logs"
import { sincronizarMembrosAction } from "@/app/(dashboard)/analises-avancadas/demandas/relatorios/actions/actions-membros"
import { agenteColetor } from "@/lib/agents/analise/01-coletor"
import { agenteNormalizador } from "@/lib/agents/analise/02-normalizador"
import { sincronizarPaginaAction } from "@/app/(dashboard)/analises-avancadas/demandas/relatorios/actions"

console.log("👷 Worker Local Iniciado...")

async function buscarIssueKeysParaNormalizar(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("jira_issues_agente_demandas")
    .select("id_issue")
    .is("categoria_embedding", null)

  if (error) {
    console.error("❌ Erro ao buscar issues para normalizar:", error.message)
    return []
  }

  return (data || []).map(row => row.id_issue)
}

async function sincronizarIssuesCompletas(logIdExterno?: number): Promise<boolean> {
  let logId = logIdExterno || null
  let totalProcessados = 0
  let tentativas = 0
  const MAX_TENTATIVAS = 50

  try {

     let token: string | undefined = undefined

    while (tentativas < MAX_TENTATIVAS) {
      const res = await sincronizarPaginaAction(token)
      totalProcessados += res.processados

      await atualizarLogSincronizacaoAction(
        logId!, 
        totalProcessados, 
        res.total || 0, 
        'issues', 
        totalProcessados, 
        res.total || 0
      )

      console.log(`📦 Página ${tentativas + 1}: ${res.processados} issues (total: ${totalProcessados})`)

      if (res.fim) {
        console.log(`✅ Sincronização completa! Total: ${totalProcessados} issues.`)
        return true
      }

      token = res.nextPageToken || undefined
      tentativas++
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    throw new Error(`Sincronização interrompida após ${MAX_TENTATIVAS} páginas`)
  } catch (err: any) {
    console.error("❌ Erro na sincronização:", err)
    if (logId) {
      // ✅ FINALIZA LOG COM ERRO
      await finalizarLogSincronizacaoAction("Erro", err.message)
    }
    return false
  }
}

async function ciclo() {
  console.log(`⏰ [${new Date().toLocaleTimeString()}] Iniciando ciclo automático...`)
  
  // ✅ CRIA LOG ÚNICO pro ciclo todo
  const logId = await criarLogSincronizacaoAction()
  if (!logId) {
    console.error("❌ Falha ao criar log")
    return
  }
  console.log(`📝 Log ciclo: #${logId}`)

  try {
    // 1. Issues
    await atualizarLogSincronizacaoAction(logId, 0, 0, 'issues', 0, 0)
    console.log("📦 Sincronizando Issues...")
    const issuesOk = await sincronizarIssuesCompletas(logId)
    if (!issuesOk) {
      console.warn("⚠️ Sincronização de issues falhou ou foi interrompida. Continuando ciclo mesmo assim...")
    }

    await atualizarLogSincronizacaoAction(logId, 100, 100, 'issues', 100, 100)

    await new Promise(r => setTimeout(r, 5000))

    // 2. Comentários
    await atualizarLogSincronizacaoAction(logId, 0, 0, 'comentarios', 0, 0)
    console.log("🔄 Sincronizando Comentários...")
    await sincronizarComentariosJiraAction()
    await atualizarLogSincronizacaoAction(logId, 100, 100, 'comentarios', 100, 100)

    await new Promise(r => setTimeout(r, 5000))

    // 3. Membros
    await atualizarLogSincronizacaoAction(logId, 0, 0, 'membros', 0, 0)
    console.log("🔄 Sincronizando Membros...")
    await sincronizarMembrosAction()
    await atualizarLogSincronizacaoAction(logId, 100, 100, 'membros', 100, 100)

    await new Promise(r => setTimeout(r, 5000))

    // 4. Coletor (loop até 2000)
    await atualizarLogSincronizacaoAction(logId, 0, 0, 'coletor', 0, 0)
      let coletadas = 0
      const novas = await agenteColetor()
      coletadas = novas.length
      await atualizarLogSincronizacaoAction(logId, coletadas, coletadas, 'coletor', coletadas, coletadas)
      console.log(`📦 Coletadas: ${coletadas}`)
      await atualizarLogSincronizacaoAction(logId, 100, 100, 'coletor', 100, 100)

    await new Promise(r => setTimeout(r, 3000))

    // // 5. Normalizador
    const issueKeys = await buscarIssueKeysParaNormalizar()
    const totalPendentes = issueKeys.length
    await atualizarLogSincronizacaoAction(logId, 0, totalPendentes, 'normalizador', 0, totalPendentes)
    console.log(`📦 ${totalPendentes} pendentes normalização`)
    if (totalPendentes > 0) {
      const normalizadas = await agenteNormalizador(issueKeys)
      await atualizarLogSincronizacaoAction(logId, normalizadas.length, totalPendentes, 'normalizador', normalizadas.length, totalPendentes)
    }
    await atualizarLogSincronizacaoAction(logId, 100, 100, 'normalizador', 100, 100)

    await finalizarLogSincronizacaoAction('Sucesso')
    console.log("✅ Ciclo concluído com sucesso!")
  } catch (err: any) {
    console.error("❌ Erro no ciclo:", err)
    await finalizarLogSincronizacaoAction('Erro', err.message)
  }
}
// roda a cada 4h
cron.schedule("0 */4 * * *", ciclo)

ciclo()