"use client"

import * as React from "react"
import { RefreshCw, Loader2, Database, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { buscarLogsJira, buscarTotalIssuesAction, cancelarSincronizacaoJiraAction, sincronizarPaginaAction, criarLogSincronizacaoAction, finalizarLogSincronizacaoAction, atualizarLogSincronizacaoAction } from "./actions"

export default function JiraRelatoriosPage() {
  const [logs, setLogs] = React.useState<any[]>([])
  const [mounted, setMounted] = React.useState(false)
  const [sincronizando, setSincronizando] = React.useState(false)
  const [progresso, setProgresso] = React.useState({ atual: 0, total: 0 })

  const carregarLogs = async () => {
    const dados = await buscarLogsJira()
    setLogs(dados)
    return dados
  }

React.useEffect(() => {
  setMounted(true)
  carregarLogs().then((dados) => {
    const temAtivo = dados?.find((l: any) => l.SincronizaComplete === false)
    if (temAtivo) setSincronizando(true)
  })
}, [])

  React.useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      carregarLogs()
    }, 3000)
    return () => clearInterval(interval)
  }, [mounted])

  const handleForcaBusca = async () => {
  setSincronizando(true)
  setProgresso({ atual: 0, total: 0 })

  const logId = await criarLogSincronizacaoAction()

  // Busca o total real antes de começar
  const totalReal = await buscarTotalIssuesAction()
  setProgresso({ atual: 0, total: totalReal })

  try {
    let nextPageToken: string | undefined = undefined
    let totalProcessados = 0

    while (true) {
      const resultado = await sincronizarPaginaAction(nextPageToken)
      totalProcessados += resultado.processados
      setProgresso({ atual: totalProcessados, total: totalReal })

      if (logId) {
        await atualizarLogSincronizacaoAction(logId, totalProcessados, totalReal, 'issues', totalProcessados, totalReal)
      }

      if (resultado.fim) break
      nextPageToken = resultado.nextPageToken!
    }

    toast.success("Sincronização concluída!")
    await finalizarLogSincronizacaoAction('Sucesso')
    await carregarLogs()
  } catch (err: any) {
    await finalizarLogSincronizacaoAction('Erro', err.message)
    toast.error("Erro: " + err.message)
  } finally {
    setSincronizando(false)
    setProgresso({ atual: 0, total: 0 })
  }
}

  const handleCancelar = async () => {
    setSincronizando(false)
    setProgresso({ atual: 0, total: 0 })
    toast.info("Interrompendo busca no Jira...")
    try {
      const res = await cancelarSincronizacaoJiraAction()
      if (res?.success) {
        toast.warning("Sincronização interrompida com sucesso!")
        await carregarLogs()
      } else {
        toast.error("Erro ao tentar cancelar: " + res?.error)
      }
    } catch (e) {
      toast.error("Erro de comunicação ao cancelar.")
    }
  }

  if (!mounted) return null

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-zinc-700">Relatórios Jira (HOS)</h1>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border">
          <Database className="w-3 h-3" />
          <span>
            Sincronização: {logs[0]?.SincronizaComplete === false 
              ? `${logs[0]?.EtapaAtual?.toUpperCase() || 'issues'} (${logs[0]?.ProgressoEtapa}/${logs[0]?.TotalEtapa})`
              : sincronizando 
                ? progresso.atual > 0 ? `${progresso.atual} demandas salvas` : "Iniciando..."
                : "Parada"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <Button
          onClick={sincronizando ? handleCancelar : handleForcaBusca}
          variant={sincronizando ? "destructive" : "default"}
        >
          {sincronizando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {sincronizando
            ? progresso.atual > 0
              ? `CANCELAR`
              : "CANCELAR"
            : "FORÇAR BUSCA JIRA"}
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Últimas Atividades</h2>
        <div className="grid gap-2">
          {logs.length > 0 ? logs.map((log, i) => (
            <Card key={log.id || i} className="p-4 flex items-center justify-between border-l-4"
              style={{
                borderLeftColor: !log.SincronizaComplete ? '#3b82f6' :
                                 log.Status === 'Sucesso' ? '#22c55e' :
                                 log.Status === 'Interrompido' ? '#f59e0b' : '#ef4444'
              }}>
              <div className="flex items-center gap-4">
                {!log.SincronizaComplete ? (
                  <Loader2 className="text-blue-500 w-5 h-5 animate-spin" />
                ) : log.Status === 'Sucesso' ? (
                  <CheckCircle2 className="text-green-500 w-5 h-5" />
                ) : log.Status === 'Interrompido' ? (
                  <AlertCircle className="text-amber-500 w-5 h-5" />
                ) : (
                  <XCircle className="text-red-500 w-5 h-5" />
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    Sincronização {log.Status} {!log.SincronizaComplete && "(Rodando)"}
                  </p>
                  <p className="text-xs text-zinc-400">{log.DataCriacao}</p>
                  <p className="text-xs text-zinc-500">
                    {log.EtapaAtual && `(${log.EtapaAtual.toUpperCase()} ${log.ProgressoEtapa}/${log.TotalEtapa})`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-600">{log.ItemsProcessados} demandas</p>
                {log.MensagemErro && (
                  <p className="text-[10px] text-red-400 max-w-[200px] truncate">{log.MensagemErro}</p>
                )}
              </div>
            </Card>
          )) : (
            <Card className="p-10 flex flex-col items-center justify-center border-dashed">
              <p className="text-zinc-400 text-sm">Nenhum log encontrado...</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
