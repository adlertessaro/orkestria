"use client"

import * as React from "react"
import { RefreshCw, BarChart3, Loader2, Database, AlertCircle, FileText, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { sincronizarTrelloAction, buscarLogsSincronizacao, buscarDadosRelatorioAction, cancelarSincronizacaoAction } from "./actions"
import { RelatorioModal } from "./RelatorioModal"
import { dispararSincronizacaoBackground } from "./actionBackgroud"

export default function RelatoriosPage() {
  const [logs, setLogs] = React.useState<any[]>([])
  const [mounted, setMounted] = React.useState(false)

  const carregarLogs = async () => {
    const dados = await buscarLogsSincronizacao()
    setLogs(dados)
  }

  // 1. Montagem inicial
  React.useEffect(() => {
    setMounted(true)
    carregarLogs()
  }, [])

  // 2. POLLING: Bate no banco a cada 3s e atualiza a UI automaticamente
  React.useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      carregarLogs()
    }, 3000)

    return () => clearInterval(interval)
  }, [mounted])

  // Identifica se há sincronização rodando pelo banco (não por estado local)
  const logAtivo = logs.find(l => l.SincronizaComplete === false)
  const temSincronizacaoRodando = !!logAtivo

  // o polling assume o controle
  const handleForcaBusca = async () => {
    toast.info("Iniciando busca por novos cards...")
    await dispararSincronizacaoBackground() // dispara a ação que inicia a sincronização
    // O polling vai detectar a nova entrada no banco e atualizar a UI automaticamente
  }

  // cancela e força uma atualização imediata (sem esperar o próximo tick do interval)
  const handleCancelar = async () => {
    toast.info("Interrompendo busca...")
    await cancelarSincronizacaoAction(logAtivo.id)
    carregarLogs() // Atualiza imediatamente após cancelar
  }

  const handleBotaoPrincipal = () => {
    if (temSincronizacaoRodando) {
      handleCancelar()
    } else {
      handleForcaBusca()
    }
  }

  if (!mounted) return null

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-zinc-700">Operações de Dados</h1>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border">
          <Database className="w-3 h-3" />
          <span>Sincronização: {temSincronizacaoRodando ? "Em andamento" : "Ativa"}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <Button
          onClick={handleBotaoPrincipal}
          variant={temSincronizacaoRodando ? "destructive" : "default"}
        >
          {temSincronizacaoRodando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {temSincronizacaoRodando ? "CANCELAR BUSCA" : "FORÇAR BUSCA"}
        </Button>

        <RelatorioModal onGerar={buscarDadosRelatorioAction} />
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
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-600">{log.ItemsProcessados} cards</p>
                {log.MensagemErro && <p className="text-[10px] text-red-400 max-w-[200px] truncate">{log.MensagemErro}</p>}
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
