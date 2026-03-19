"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function criarLogSincronizacaoAction(): Promise<number | null> {
  // Fecha logs antigos em aberto
  await supabaseAdmin
    .from("jira_issues_sync_logs")
    .update({ sincroniza_complete: true, status: 'Interrompido' })
    .eq('service_name', 'Jira')
    .eq('sincroniza_complete', false)

  // Cria novo log e retorna o ID
  const { data, error } = await supabaseAdmin
    .from("jira_issues_sync_logs")
    .insert({ status: 'Processando', sincroniza_complete: false, service_name: 'Jira' })
    .select("id")
    .single()

  if (error) {
    console.error("❌ Erro ao criar log:", error.message)
    return null
  }

  return data.id
}

export async function atualizarLogSincronizacaoAction(
  logId: number | null, 
  itemsProcessed: number, 
  totalItems: number, 
  etapaAtual: string = 'issues',
  progressoEtapa: number = 0, 
  totalEtapa: number = 0
) {
  if (!logId) return // null = ignora (pro agendador antigo)

  const { error } = await supabaseAdmin
    .from('jira_issues_sync_logs')
    .update({ 
      items_processed: itemsProcessed,
      total_etapa: totalEtapa,  // ← NOVO
      etapa_atual: etapaAtual,  // ← NOVO  
      progresso_etapa: progressoEtapa  // ← NOVO
    })
    .eq('id', logId)

  if (error) console.error('❌ Update log erro:', error)
}

export async function finalizarLogSincronizacaoAction(status: string, erro?: string) {
  await supabaseAdmin
    .from("jira_issues_sync_logs")
    .update({
      status,
      sincroniza_complete: true,
      ...(erro ? { error_message: erro } : {})
    })
    .eq('service_name', 'Jira')
    .eq('sincroniza_complete', false)
}

export async function cancelarSincronizacaoJiraAction() {
  try {
    const { error } = await supabaseAdmin
      .from("jira_issues_sync_logs")
      .update({
        status: 'Interrompido',
        sincroniza_complete: true,
        error_message: "Sincronização não concluída. Interrompido pelo Usuário",
      })
      .eq('service_name', 'Jira')
      .eq('sincroniza_complete', false)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function buscarLogsJira() {
  const { data, error } = await supabaseAdmin
    .from("jira_issues_sync_logs")
    .select("id, status, items_processed, etapa_atual, progresso_etapa, total_etapa, error_message, created_at, sincroniza_complete")
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) return []

  return data?.map(log => ({
    id: log.id,
    Status: log.status,
    SincronizaComplete: log.sincroniza_complete,
    ItemsProcessados: log.items_processed,
    EtapaAtual: log.etapa_atual,
    ProgressoEtapa: log.progresso_etapa,
    TotalEtapa: log.total_etapa,
    MensagemErro: log.error_message,
    DataCriacao: new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }))
}
