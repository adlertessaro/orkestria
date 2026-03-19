"use client"

import * as React from "react"
import { Eye, Loader2, Filter, ExternalLink, Search, Brain } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { buscarIssues, getIssueDetails, getMembros } from "@/app/(dashboard)/analises-avancadas/demandas/exibir-demandas/action"

// ─── MAPEAMENTO DE STATUS ─────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  "Backlog":                      { label: "Recebido",               emoji: "🟡", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "Aguardando Análise":           { label: "Recebido",               emoji: "🟡", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "Análise Aceita":               { label: "Em Análise",             emoji: "🔎", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Em Análise (Análise)":         { label: "Em Análise",             emoji: "🔎", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Em Revisão (Análise)":         { label: "Em Análise",             emoji: "🔎", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Análise Devolvida":            { label: "Em Análise",             emoji: "🔎", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Aguardando Desenv":            { label: "Em Desenvolvimento",     emoji: "⚙️", color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Em Progresso (Desenv)":        { label: "Em Desenvolvimento",     emoji: "⚙️", color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Code Review (Desenv)":         { label: "Em Desenvolvimento",     emoji: "⚙️", color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Em andamento (DBA)":           { label: "Em Desenvolvimento",     emoji: "⚙️", color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Aguardando DBA":               { label: "Em Desenvolvimento",     emoji: "⚙️", color: "bg-orange-100 text-orange-800 border-orange-200" },
  "Em Andamento (QA)":            { label: "Em Validação",           emoji: "🧪", color: "bg-purple-100 text-purple-800 border-purple-200" },
  "Aguardando QA":                { label: "Em Validação",           emoji: "🧪", color: "bg-purple-100 text-purple-800 border-purple-200" },
  "Não Aprovado":                 { label: "Em Ajuste",              emoji: "🔁", color: "bg-red-100 text-red-800 border-red-200" },
  "Esperando Terceiro (Desenv)":  { label: "Aguardando Terceiros",   emoji: "🔗", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  "Espera de Terceiros (QA)":     { label: "Aguardando Terceiros",   emoji: "🔗", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  "Em Espera de Terceiro (DBA)":  { label: "Aguardando Terceiros",   emoji: "🔗", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  "Em Pausa (Análise)":           { label: "Pausado",                emoji: "⏸️", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  "Em Pausa (DBA)":               { label: "Pausado",                emoji: "⏸️", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  "Pausado (QA)":                 { label: "Pausado",                emoji: "⏸️", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  "Pausado (Desenv)":             { label: "Pausado",                emoji: "⏸️", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  "Commit HOS FC":                { label: "Aguardando Publicação",  emoji: "📦", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Commit HOS Integrador":        { label: "Aguardando Publicação",  emoji: "📦", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Commit HOSFARMA":              { label: "Aguardando Publicação",  emoji: "📦", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Pronto para Commit":           { label: "Aguardando Publicação",  emoji: "📦", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Para Produção WEB":            { label: "Aguardando Publicação",  emoji: "📦", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Concluir":                     { label: "Finalizado",             emoji: "✅", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "Cancelar":                     { label: "Cancelado",              emoji: "❌", color: "bg-red-100 text-red-700 border-red-200" },
}

const STATUS_GRUPOS = [
  { label: "Recebido",              emoji: "🟡" },
  { label: "Em Análise",            emoji: "🔎" },
  { label: "Em Desenvolvimento",    emoji: "⚙️" },
  { label: "Em Validação",          emoji: "🧪" },
  { label: "Em Ajuste",             emoji: "🔁" },
  { label: "Aguardando Terceiros",  emoji: "🔗" },
  { label: "Pausado",               emoji: "⏸️" },
  { label: "Aguardando Publicação", emoji: "📦" },
  { label: "Finalizado",            emoji: "✅" },
  { label: "Cancelado",             emoji: "❌" },
]

const SETORES = ["ANÁLISE", "DBA", "DESENV WEB", "DESENV DESKTOP", "QA"]

function StatusBadge({ status }: { status: string }) {
  const mapped = STATUS_MAP[status]
  if (!mapped) return <Badge variant="outline">{status}</Badge>
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${mapped.color}`}>
      {mapped.emoji} {mapped.label}
    </span>
  )
}

// ─── MULTI SELECT ─────────────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-dashed h-10 max-w-[180px] justify-start truncate">
          <Filter className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o} onSelect={() => toggle(o)} className="cursor-pointer">
                  <Checkbox checked={selected.includes(o)} className="mr-2" />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const CAMPOS_NEGRITO = [
  "Contexto:",
  "Objetivo:",
  "Funcionamento:",
  "Risco fiscal/operacional avaliado:",
  "Critérios de Aceite:",
  "Cenários de QA:",
  "Classificação:",
  "Viabilidade:",
]

function RetornoAnalise({ texto }: { texto: string }) {
  const linhas = texto.split("\n")

  return (
    <div className="text-sm leading-relaxed text-zinc-600 space-y-1">
      {linhas.map((linha, i) => {
        const campo = CAMPOS_NEGRITO.find(c => linha.trimStart().startsWith(c))
        if (campo) {
          const resto = linha.trimStart().slice(campo.length)
          return (
            <p key={i} className="mt-3">
              <span className="font-black text-zinc-800">{campo}</span>
              {resto}
            </p>
          )
        }
        return <p key={i}>{linha || <>&nbsp;</>}</p>
      })}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function IssuesPage() {
  const [issues, setIssues] = React.useState<any[]>([])
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [isSemantic, setIsSemantic] = React.useState(false)
  const [total, setTotal] = React.useState<number | null>(null)
  const [membros, setMembros] = React.useState<string[]>([])

  // Campos de busca
  const [search, setSearch] = React.useState("")
  const [usarIA, setUsarIA] = React.useState(false)

  // Filtros
  const [statusFilters, setStatusFilters] = React.useState<string[]>([])
  const [clienteInput, setClienteInput] = React.useState("")
  const [clientes, setClientes] = React.useState<string[]>([])
  const [responsavelFilters, setResponsavelFilters] = React.useState<string[]>([])
  const [analistaFilters, setAnalistaFilters] = React.useState<string[]>([])
  const [developerFilters, setDeveloperFilters] = React.useState<string[]>([])
  const [qaFilters, setQaFilters] = React.useState<string[]>([])
  const [setorFilters, setSetorFilters] = React.useState<string[]>([])
 
  // Sheet de detalhes
  const [details, setDetails] = React.useState<any>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)

  const observerTarget = React.useRef(null)

  // Carrega membros uma vez
  React.useEffect(() => {
    getMembros().then(m => setMembros(m.map((x: any) => x.nome)))
  }, [])

  const filtros = React.useMemo(() => ({
    status: statusFilters,
    clientes,
    responsavel: responsavelFilters,
    analista: analistaFilters,
    developer: developerFilters,
    qa: qaFilters,
    setor: setorFilters,
  }), [statusFilters, clientes, responsavelFilters, analistaFilters, developerFilters ,qaFilters, setorFilters])

  // ── Função central de busca ──────────────────────────────────────────────
  const executarBusca = React.useCallback(async (
    p: number, s: string, ia: boolean, f: typeof filtros, append = false
  ) => {
    if (p === 0) setLoading(true)
    else setLoadingMore(true)

    const res = await buscarIssues(p, s, ia, f)
    setIsSemantic(res.semantica)
    setIssues(prev => append ? [...prev, ...res.issues] : res.issues)
    setHasMore(res.hasMore)
    if (p === 0) setTotal(res.total)
    setLoading(false)
    setLoadingMore(false)
  }, [])

  // ── Busca automática ao mudar filtros ou texto (sem IA) ──────────────────
  React.useEffect(() => {
    if (usarIA) return // IA só dispara no Enter
    setPage(0)
    const timer = setTimeout(() => executarBusca(0, search, false, filtros), 500)
    return () => clearTimeout(timer)
  }, [search, filtros]) // eslint-disable-line

  // ── Quando desativa IA, rebusca sem embedding ────────────────────────────
  React.useEffect(() => {
    if (!usarIA) {
      setPage(0)
      executarBusca(0, search, false, filtros)
    }
  }, [usarIA]) // eslint-disable-line

  // ── Infinite scroll ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prev => {
          const next = prev + 1
          executarBusca(next, search, usarIA, filtros, true)
          return next
        })
      }
    }, { threshold: 0.1 })
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, search, usarIA, filtros, executarBusca])

  // ── Enter no campo de busca ──────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPage(0)
      executarBusca(0, search, usarIA, filtros)
    }
  }

  const handleOpenSheet = async (issueKey: string) => {
    setLoadingDetails(true)
    setDetails(null)
    const res = await getIssueDetails(issueKey)
    setDetails(res)
    setLoadingDetails(false)
  }

  const adicionarCliente = () => {
    const valor = clienteInput.trim()
    if (valor && !clientes.includes(valor)) setClientes(prev => [...prev, valor])
    setClienteInput("")
  }

  const totalFiltrosAtivos =
    statusFilters.length + clientes.length +
    responsavelFilters.length + analistaFilters.length +
    qaFilters.length + setorFilters.length + developerFilters.length

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-zinc-800">Demandas Jira (Issues)</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Busca por demandas e histórico de issues</p>
        </div>

        {total !== null && (
          <div className="text-right">
            <p className="text-3xl font-black text-foreground">{total.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isSemantic ? "resultados por relevância" : "issues encontradas"}
            </p>
          </div>
        )}
      </div>

      {/* ─── BUSCA ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={usarIA
              ? "Busca inteligente... pressione Enter para buscar"
              : "Buscar por título, descrição ou chave..."}
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div
          className="flex items-center gap-2 bg-zinc-50 border rounded-lg px-3 py-2 cursor-pointer select-none hover:bg-zinc-100 transition-colors"
          onClick={() => setUsarIA(v => !v)}
        >
          <Checkbox checked={usarIA} />
          <Brain className={`w-4 h-4 ${usarIA ? "text-indigo-500" : "text-zinc-400"}`} />
          <span className={`text-sm font-medium ${usarIA ? "text-indigo-600" : "text-zinc-500"}`}>
            Pesquisa Inteligente
          </span>
        </div>
      </div>

      {isSemantic && (
        <p className="text-xs text-indigo-500 font-medium flex items-center gap-1 -mt-3">
          <Brain className="w-3 h-3" /> Resultados ordenados por similaridade
        </p>
      )}

      {/* ─── FILTROS ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        
        {/* Clientes múltiplos */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Cliente / CNPJ"
              className="w-44 h-10"
              value={clienteInput}
              onChange={e => setClienteInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && adicionarCliente()}
            />
            <Button variant="outline" size="sm" className="h-10 px-3" onClick={adicionarCliente}>+</Button>
          </div>
          {clientes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {clientes.map(c => (
                <span key={c} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                  {c}
                  <button onClick={() => setClientes(prev => prev.filter(x => x !== c))} className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <MultiSelect
          label="Status"
          options={STATUS_GRUPOS.map(s => `${s.emoji} ${s.label}`)}
          selected={statusFilters}
          onChange={setStatusFilters}
        />

        <MultiSelect label="Responsável" options={membros} selected={responsavelFilters} onChange={setResponsavelFilters} />
        <MultiSelect label="Analista" options={membros} selected={analistaFilters} onChange={setAnalistaFilters} />
        <MultiSelect label="Develolper" options={membros} selected={developerFilters} onChange={setDeveloperFilters} />
        <MultiSelect label="QA" options={membros} selected={qaFilters} onChange={setQaFilters} />
        <MultiSelect label="Setor" options={SETORES} selected={setorFilters} onChange={setSetorFilters} />

        {totalFiltrosAtivos > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-zinc-400 h-10"
            onClick={() => {
              setStatusFilters([])
              setClientes([])
              setClienteInput("")
              setResponsavelFilters([])
              setAnalistaFilters([])
              setDeveloperFilters([])
              setQaFilters([])
              setSetorFilters([])
            }}>
            Limpar ({totalFiltrosAtivos})
          </Button>
        )}
      </div>

      {/* ─── TABELA ─────────────────────────────────────────────────────── */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="w-20" />
              <TableHead className="font-bold text-[10px] uppercase">Issue</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Resumo</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Cliente</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Responsável</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Analista</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Developer</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Setor</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Atualização</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20">
                  <Loader2 className="animate-spin h-6 w-6 text-zinc-300 mx-auto" />
                </TableCell>
              </TableRow>
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20 text-xs text-zinc-400">
                  Nenhuma issue encontrada.
                </TableCell>
              </TableRow>
            ) : issues.map(issue => (
              <TableRow key={issue.issue_key} className="hover:bg-zinc-50/50">
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Sheet onOpenChange={(open) => open && handleOpenSheet(issue.issue_key)}>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4 text-zinc-400 hover:text-primary" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="sm:max-w-2xl overflow-y-auto">
                        <SheetHeader className="mb-6">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline">{issue.issue_key}</Badge>
                            <StatusBadge status={issue.status} />
                          </div>
                          <SheetTitle className="text-2xl font-black">{issue.resumo}</SheetTitle>
                        </SheetHeader>

                        {loadingDetails ? (
                          <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin h-6 w-6 text-zinc-300" />
                          </div>
                        ) : details && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 border-y py-6 border-zinc-100">
                              {[
                                { label: "Cliente", value: details.razao_social || details.cnpj_cliente },
                                { label: "Responsável", value: details.responsavel },
                                { label: "Analista", value: details.analista_responsavel },
                                { label: "Developer", value: details.developer },
                                { label: "Setor", value: details.setor_responsavel },
                                { label: "Criado em", value: details.data_criacao ? new Date(details.data_criacao).toLocaleString("pt-BR") : null },
                              ].map(({ label, value }) => value ? (
                                <div key={label} className="space-y-1">
                                  <span className="text-[10px] font-black uppercase text-zinc-400">{label}</span>
                                  <p className="text-sm font-bold text-zinc-800">{value}</p>
                                </div>
                              ) : null)}
                            </div>

                              <div className="p-4 bg-zinc-50 rounded-xl">
                                <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-2">Descrição</h4>
                                {details.description
                                  ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600">{details.description}</p>
                                  : <p className="text-sm italic text-zinc-400">Nenhuma descrição registrada.</p>
                                }
                              </div>

                            <div className="p-4 bg-zinc-50 rounded-xl">
                              <h4 className="text-[10px] font-black uppercase text-orange-400 mb-2">Análise Técnica</h4>
                              {details.analise_tecnica
                                ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-orange-600">{details.analise_tecnica}</p>
                                : <p className="text-sm italic text-orange-400">Nenhuma análise técnica registrada.</p>
                              }
                            </div>

                            <div className="p-4 bg-blue-50 rounded-xl">
                              <h4 className="text-[10px] font-black uppercase text-blue-400 mb-2">Retorno da Análise</h4>
                              {details.retorno_analise
                                ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-600">{details.retorno_analise}</p>
                                : <p className="text-sm italic text-blue-400">Nenhum retorno da análise registrado.</p>
                              }
                            </div>
                            
                            <div className="p-4 bg-emerald-50 rounded-xl">
                              <h4 className="text-[10px] font-black uppercase text-emerald-400 mb-2">Retorno QA</h4>
                              {details.retorno_qa
                                ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-emerald-600">{details.retorno_qa}</p>
                                : <p className="text-sm italic text-emerald-400">Nenhum retorno QA registrado.</p>
                              }
                            </div>
                            
                            {(details.categoria_embedding || details.subcategoria_embedding) && (
                              <div className="flex gap-2 flex-wrap">
                                {details.categoria_embedding && <Badge variant="outline">{details.categoria_embedding}</Badge>}
                                {details.subcategoria_embedding && <Badge variant="secondary">{details.subcategoria_embedding}</Badge>}
                              </div>
                            )}
                          </div>
                        )}
                      </SheetContent>
                    </Sheet>

                    <Button variant="ghost" size="icon"
                      onClick={() => window.open(`https://hossistemas.atlassian.net/browse/${issue.issue_key}`, "_blank")}
                      title="Abrir no Jira">
                      <ExternalLink className="w-4 h-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-500">{issue.issue_key}</TableCell>
                <TableCell className="font-bold text-zinc-900 max-w-xs truncate" title={issue.resumo}>{issue.resumo}</TableCell>
                <TableCell className="text-blue-600 font-bold text-xs">{issue.razao_social || issue.cnpj_cliente || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-xs">{issue.responsavel || "—"}</TableCell>
                <TableCell className="text-indigo-600 text-xs">{issue.analista_responsavel || "—"}</TableCell>
                <TableCell className="text-emerald-600 text-xs">{issue.developer || "—"}</TableCell>
                <TableCell className="text-zinc-500 text-xs">{issue.setor_responsavel || "—"}</TableCell>
                <TableCell className="text-zinc-400 text-xs">
                  {issue.ultima_atualizacao ? new Date(issue.ultima_atualizacao).toLocaleString("pt-BR") : "—"}
                </TableCell>
                <TableCell><StatusBadge status={issue.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div ref={observerTarget} className="p-8 flex justify-center items-center bg-zinc-50/50">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />}
          {!hasMore && !loading && issues.length > 0 && (
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Fim da listagem</p>
          )}
        </div>
      </div>
    </div>
  )
}
