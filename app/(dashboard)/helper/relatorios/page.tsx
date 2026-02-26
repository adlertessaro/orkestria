"use client"

import * as React from "react"
import { RefreshCw, BarChart3, Loader2, Database, AlertCircle, FileText, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { sincronizarTrelloAction, buscarLogsSincronizacao, buscarDadosRelatorioAction } from "./actions"
import { RelatorioModal } from "./RelatorioModal"

export default function RelatoriosPage() {
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [logs, setLogs] = React.useState<any[]>([])

  // Carrega os logs ao montar a tela
  const carregarLogs = async () => {
    const dados = await buscarLogsSincronizacao()
    setLogs(dados)
  }

  React.useEffect(() => {
    carregarLogs()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    const result = await sincronizarTrelloAction()
    setIsSyncing(false)
    if (result.success) {
      toast.success(`Sincronização concluída!`)
      carregarLogs() // Atualiza a lista de logs após sincronizar
    } else {
      toast.error(`Falha: ${result.error}`)
    }
  }

  const handleProcessarRelatorio = async (filtros: any) => {
    // Chamada para a nova action de filtragem
    const resultado = await buscarDadosRelatorioAction(filtros)
    
    if (resultado.length > 0) {
      toast.success(`${resultado.length} cards encontrados para o relatório!`)
      // Aqui, futuramente, disparamos o download do arquivo
      console.table(resultado) 
    } else {
      toast.error("Nenhum dado encontrado com esses filtros.")
    }
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* HEADER MANTIDO */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-zinc-700">Operações de Dados</h1>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border">
          <Database className="w-3 h-3" />
          <span>Sincronização: Ativa</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <Button onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          FORÇAR BUSCA
        </Button>

        {/* Aqui você chamará seu componente de Modal */}
        <RelatorioModal onGerar={buscarDadosRelatorioAction} />
      </div>

      {/* LISTAGEM DE LOGS (Substituindo a área vazia) */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Últimas Atividades</h2>
        <div className="grid gap-2">
          {logs.length > 0 ? logs.map((log, i) => (
            <Card key={i} className="p-4 flex items-center justify-between border-l-4" 
              style={{ borderLeftColor: log.Status === 'Sucesso' ? '#22c55e' : '#ef4444' }}>
              <div className="flex items-center gap-4">
                {log.Status === 'Sucesso' ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
                <div>
                  <p className="text-sm font-medium text-zinc-700">Sincronização {log.Status}</p>
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