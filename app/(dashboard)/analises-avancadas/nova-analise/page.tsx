"use client"

import * as React from "react"
import {
  Bot, Search, Play, CheckCircle2, XCircle, Clock, Loader2,
  SkipForward, ChevronRight, ExternalLink, AlertTriangle,
  FlaskConical, PenLine, Gavel, MapPin, Send, RotateCcw,
  History, RefreshCw, ChevronDown, Terminal, DatabaseZap
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { type AnaliseManualResult, type EtapaLog, type EtapaStatus } from "./action_analise_manual"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface LogEntry {
  message: string
  level: 'info' | 'error' | 'warn'
  timestamp: Date
}

interface AnaliseHistorico {
  id: string
  issue: string
  dataHora: Date
  sucesso: boolean
  duracao: number
  status?: string
  etapas?: EtapaLog[]
}

interface ResultadoLocal {
  sucesso: boolean
  bloqueado?: boolean
  mensagem: string
}

// ─── CONFIG DAS ETAPAS ────────────────────────────────────────────────────────

const ETAPAS_CONFIG = [
  { slug: "triagem",    nome: "Triagem",           desc: "Verifica duplicatas e maturidade", icon: FlaskConical, color: "text-violet-600", bg: "bg-violet-50" },
  { slug: "pesquisador",nome: "Pesquisador",        desc: "Busca técnica e legislação",       icon: Search,       color: "text-indigo-600", bg: "bg-indigo-50" },
  { slug: "escritor",   nome: "Escritor / Analista",desc: "Gera o documento técnico",         icon: PenLine,      color: "text-blue-600",   bg: "bg-blue-50"   },
  { slug: "juiz",       nome: "Revisor / Juiz",     desc: "Avalia e pontua",                  icon: Gavel,        color: "text-amber-600",  bg: "bg-amber-50"  },
  { slug: "mapeador",   nome: "Mapeador de Dev",    desc: "Classifica e escolhe dev",         icon: MapPin,       color: "text-rose-600",   bg: "bg-rose-50"   },
  { slug: "postagem",   nome: "Postagem no Jira",   desc: "Executa transição no Jira",        icon: Send,         color: "text-emerald-600",bg: "bg-emerald-50"},
]

// ─── BADGE DE STATUS ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<EtapaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Aguardando",   color: "bg-zinc-100 text-zinc-500 border-zinc-200",       icon: <Clock className="w-3 h-3" /> },
  rodando:  { label: "Processando",  color: "bg-blue-100 text-blue-700 border-blue-200",        icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  sucesso:  { label: "Concluído",    color: "bg-emerald-100 text-emerald-700 border-emerald-200",icon: <CheckCircle2 className="w-3 h-3" /> },
  erro:     { label: "Erro",         color: "bg-red-100 text-red-700 border-red-200",            icon: <XCircle className="w-3 h-3" /> },
  pulado:   { label: "Pulado",       color: "bg-yellow-100 text-yellow-700 border-yellow-200",  icon: <SkipForward className="w-3 h-3" /> },
}

function EtapaStatusBadge({ status }: { status: EtapaStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

// ─── COMPONENTES DE DADOS ─────────────────────────────────────────────────────

function TagList({ items, color = "zinc" }: { items: string[]; color?: string }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map((item, i) => (
        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded bg-${color}-100 text-${color}-700 font-medium`}>{item}</span>
      ))}
    </div>
  )
}

function DadosTriagem({ d }: { d: Record<string, any> }) {
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {d.triagem_maturidade && (
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400 w-20 shrink-0">Maturidade</span>
          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${d.triagem_maturidade === "alta" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{d.triagem_maturidade}</span>
        </div>
      )}
      {d.triagem_motivo && <p className="text-zinc-600 leading-relaxed">{d.triagem_motivo}</p>}
      <TagList items={d.triagem_elementos_presentes} color="emerald" />
      <TagList items={d.triagem_elementos_ausentes} color="red" />
    </div>
  )
}

function DadosPesquisador({ d }: { d: Record<string, any> }) {
  return <div className="mt-2 text-xs"><TagList items={d.pesquisador_intencoes_busca} color="indigo" /></div>
}

function DadosEscritor({ d }: { d: Record<string, any> }) {
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {d.escritor_modelo && <div className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded w-fit">{d.escritor_modelo}</div>}
      <p className="text-zinc-600 line-clamp-2 bg-white rounded p-2 border border-zinc-100">{d.escritor_resultado_editado || d.escritor_resultado}</p>
    </div>
  )
}

function DadosJuiz({ d }: { d: Record<string, any> }) {
  const score = d.juiz_score
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {score != null && <div className="font-bold text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit">{score}/100</div>}
      {d.juiz_motivo && <p className="text-zinc-600 italic">&quot;{d.juiz_motivo}&quot;</p>}
    </div>
  )
}

function DadosMapeador({ d }: { d: Record<string, any> }) {
  return <div className="mt-2 text-[10px] font-mono font-bold text-rose-600">{d.plataforma}{d.desenvolvedor_jira_id && ` (${d.desenvolvedor_jira_id})`}</div>
}

function DadosEtapaDetalhe({ slug, dados }: { slug: string; dados?: Record<string, any> }) {
  if (!dados) return null
  const hasContent = Object.values(dados).some(v => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
  if (!hasContent) return null
  switch (slug) {
    case "triagem":    return <DadosTriagem d={dados} />
    case "pesquisador":return <DadosPesquisador d={dados} />
    case "escritor":   return <DadosEscritor d={dados} />
    case "juiz":       return <DadosJuiz d={dados} />
    case "mapeador":   return <DadosMapeador d={dados} />
    default:           return null
  }
}

// ─── PIPELINE LIVE ────────────────────────────────────────────────────────────

function PipelineLive({ etapas, isPending }: { etapas: EtapaLog[]; isPending: boolean }) {
  const concluidas = etapas.filter(e => ["sucesso", "erro", "pulado"].includes(e.status)).length
  const progresso = Math.round((concluidas / ETAPAS_CONFIG.length) * 100)

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-bold text-zinc-600">Pipeline em execução</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">{progresso}%</span>
          {isPending && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {ETAPAS_CONFIG.map(config => {
          const etapa = etapas.find(e => e.slug === config.slug)
          const status: EtapaStatus = etapa?.status ?? "pendente"
          const Icon = config.icon
          const duracao = etapa?.inicio && etapa?.fim
            ? `${((new Date(etapa.fim).getTime() - new Date(etapa.inicio).getTime()) / 1000).toFixed(1)}s`
            : null

          return (
            <div key={config.slug} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${status === "rodando" ? `${config.bg}` : "bg-transparent"}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                status === "sucesso" ? "bg-emerald-100" : status === "erro" ? "bg-red-100" :
                status === "pulado" ? "bg-yellow-100" : status === "rodando" ? config.bg : "bg-zinc-100"
              }`}>
                <Icon className={`w-3.5 h-3.5 ${
                  status === "sucesso" ? "text-emerald-600" : status === "erro" ? "text-red-600" :
                  status === "pulado" ? "text-yellow-600" : status === "rodando" ? config.color : "text-zinc-400"
                }`} />
              </div>
              <span className={`text-xs font-semibold flex-1 ${status === "pendente" ? "text-zinc-400" : "text-zinc-700"}`}>{config.nome}</span>
              {etapa?.mensagem && <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">{etapa.mensagem}</span>}
              <div className="flex items-center gap-1.5 shrink-0">
                {duracao && <span className="text-[10px] text-zinc-400 font-mono">{duracao}</span>}
                <EtapaStatusBadge status={status} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── ITEM DO HISTÓRICO ────────────────────────────────────────────────────────

function ItemHistorico({ item }: { item: AnaliseHistorico }) {
  const [expandido, setExpandido] = React.useState(false)
  const [etapas, setEtapas] = React.useState<EtapaLog[] | null>(null)
  const [carregando, setCarregando] = React.useState(false)

  const toggleExpandir = async () => {
    const abrindo = !expandido
    setExpandido(abrindo)
    if (abrindo && etapas === null) {
      setCarregando(true)
      try {
        const res = await fetch(`/analises-avancadas/nova-analise/api/historico?sessionId=${encodeURIComponent(item.id)}`)
        if (res.ok) setEtapas(await res.json())
        else setEtapas([])
      } catch { setEtapas([]) }
      finally { setCarregando(false) }
    }
  }

  const borderColor = item.sucesso ? '#22c55e' : item.status === 'em_andamento' ? '#3b82f6' : '#ef4444'

  return (
    <Card className="p-4 border-l-4 transition-all cursor-pointer hover:bg-zinc-50/50" style={{ borderLeftColor: borderColor }} onClick={toggleExpandir}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {item.status === 'em_andamento' ? <Loader2 className="text-blue-500 w-4 h-4 animate-spin" /> : item.sucesso ? <CheckCircle2 className="text-emerald-500 w-4 h-4" /> : <XCircle className="text-red-500 w-4 h-4" />}
          <div>
            <p className="text-sm font-semibold text-zinc-700">{item.issue}</p>
            <p className="text-xs text-zinc-400">{item.dataHora.toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {item.duracao > 0 && <span className="text-xs text-zinc-400 font-mono">{item.duracao}s</span>}
          <ChevronDown className={`w-4 h-4 text-zinc-300 transition-transform ${expandido ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expandido && (
        <div className="mt-4 pt-4 border-t space-y-2" onClick={e => e.stopPropagation()}>
          {carregando ? (
            <div className="text-xs text-zinc-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carregando etapas...</div>
          ) : etapas && etapas.length > 0 ? (
            ETAPAS_CONFIG.map(config => {
              const etapa = etapas.find(e => e.slug === config.slug)
              if (!etapa) return null
              return (
                <div key={config.slug} className="flex gap-3 items-start pb-2 border-b border-zinc-50 last:border-0">
                  <div className={`mt-0.5 p-1 rounded ${etapa.status === 'sucesso' ? 'bg-emerald-50 text-emerald-600' : etapa.status === 'erro' ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-400'}`}>
                    <config.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-tight">{config.nome}</span>
                      <EtapaStatusBadge status={etapa.status as EtapaStatus} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{etapa.mensagem || config.desc}</p>
                    <DadosEtapaDetalhe slug={config.slug} dados={etapa.dados} />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-xs text-zinc-400 italic">Nenhuma etapa registrada.</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function AnaliseManualPage() {
  const [numeroInput, setNumeroInput] = React.useState("")
  const [issueAtiva, setIssueAtiva] = React.useState<string | null>(null)
  const [isPending, setIsPending] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [etapasLive, setEtapasLive] = React.useState<EtapaLog[]>([])
  const [resultado, setResultado] = React.useState<ResultadoLocal | null>(null)
  const [historico, setHistorico] = React.useState<AnaliseHistorico[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = React.useState(false)

  const carregarHistorico = React.useCallback(async () => {
    setCarregandoHistorico(true)
    try {
      const res = await fetch('/analises-avancadas/nova-analise/api/historico')
      const data = await res.json()
      if (res.ok) setHistorico(data.map((item: any) => ({ ...item, dataHora: new Date(item.dataHora) })))
    } catch { console.error("Erro histórico") }
    finally { setCarregandoHistorico(false) }
  }, [])

  React.useEffect(() => { carregarHistorico() }, [carregarHistorico])

  const handleSubmit = async () => {
    const num = numeroInput.trim()
    if (!num || isPending) return
    const key = `HOS-${num}`
    setIssueAtiva(key)
    setIsPending(true)
    setLogs([])
    setEtapasLive([])
    setResultado(null)

    const es = new EventSource(`/analises-avancadas/nova-analise/api/stream?issueKey=${encodeURIComponent(key)}`)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.type === 'log') {
        setLogs(p => [...p, { message: data.message, level: data.level || 'info', timestamp: new Date() }])
      } else if (data.type === 'etapa') {
        setEtapasLive(prev => {
          const idx = prev.findIndex(e => e.slug === data.etapa.slug)
          if (idx >= 0) { const next = [...prev]; next[idx] = data.etapa; return next }
          return [...prev, data.etapa]
        })
      } else if (data.type === 'result') {
        const r: AnaliseManualResult = data.data
        setResultado({ sucesso: r.success, mensagem: r.success ? "Análise concluída e postada no Jira." : r.error || "Falhou." })
        setEtapasLive(r.etapas || [])
      } else if (data.type === 'blocked') {
        setResultado({ sucesso: false, bloqueado: true, mensagem: data.message })
      } else if (data.type === 'error') {
        setResultado({ sucesso: false, mensagem: data.message })
        setLogs(p => [...p, { message: `❌ ${data.message}`, level: 'error', timestamp: new Date() }])
      }

      if (['done', 'error', 'blocked'].includes(data.type)) {
        es.close()
        setIsPending(false)
        carregarHistorico()
      }
    }

    es.onerror = () => {
      setResultado({ sucesso: false, mensagem: "Erro de conexão com o servidor." })
      es.close()
      setIsPending(false)
    }
  }

  const handleReset = () => {
    setNumeroInput("")
    setIssueAtiva(null)
    setLogs([])
    setEtapasLive([])
    setResultado(null)
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800">Análise Manual Com Agente</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Força uma análise de uma issue fora da fila do agendamento</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 px-3 py-1.5 rounded-full border">
          <DatabaseZap className="w-3 h-3" />
          <span>{isPending ? "Em andamento..." : "Pronto"}</span>
        </div>
      </div>

      {/* INPUT */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] max-w-xs space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Número da Issue</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono text-xs font-bold text-zinc-400">HOS-</span>
              <Input
                placeholder="1234"
                className="pl-12 h-9 text-sm font-mono"
                value={numeroInput}
                onChange={e => setNumeroInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                disabled={isPending}
              />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isPending || !numeroInput.trim()} className="h-9 px-5 text-xs font-bold gap-2">
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...</> : <><Play className="w-3.5 h-3.5" /> Iniciar Análise</>}
          </Button>
          {issueAtiva && !isPending && resultado && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 text-xs gap-1.5 text-zinc-400">
              <RotateCcw className="w-3.5 h-3.5" /> Nova análise
            </Button>
          )}
        </div>

        {/* Resultado / Bloqueio */}
        {resultado && (
          <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-xs ${
            resultado.bloqueado ? "bg-amber-50 border border-amber-100 text-amber-700" :
            resultado.sucesso   ? "bg-emerald-50 border border-emerald-100 text-emerald-700" :
                                  "bg-red-50 border border-red-100 text-red-700"
          }`}>
            {resultado.bloqueado ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> :
             resultado.sucesso   ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> :
                                   <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="font-medium">{resultado.mensagem}</span>
          </div>
        )}
      </Card>

      {/* CONSOLE */}
      {logs.length > 0 && (
        <div className="rounded-lg bg-zinc-950 p-4 font-mono text-[10px] max-h-36 overflow-y-auto border border-zinc-800 space-y-0.5">
          {logs.map((log, i) => (
            <div key={i} className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-zinc-400'}>
              <span className="text-zinc-700 mr-2">[{log.timestamp.toLocaleTimeString()}]</span>
              {log.message}
            </div>
          ))}
        </div>
      )}

      {/* PIPELINE LIVE */}
      {(isPending || etapasLive.length > 0) && (
        <PipelineLive etapas={etapasLive} isPending={isPending} />
      )}

      {/* HISTÓRICO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Histórico de Análises</h2>
          <Button variant="ghost" size="sm" onClick={carregarHistorico} className="h-7 text-[10px] text-zinc-400 gap-1.5">
            <RefreshCw className={`w-3 h-3 ${carregandoHistorico ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
        <div className="space-y-2">
          {carregandoHistorico ? (
            <Card className="p-8 flex items-center justify-center gap-2 text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </Card>
          ) : historico.length > 0 ? (
            historico.map(item => <ItemHistorico key={item.id} item={item} />)
          ) : (
            <Card className="p-10 text-center text-zinc-400 text-sm">Nenhum log encontrado...</Card>
          )}
        </div>
      </div>

    </div>
  )
}