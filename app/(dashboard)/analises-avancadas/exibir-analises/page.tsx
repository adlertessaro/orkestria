// app/(dashboard)/analises/page.tsx
"use client"

import * as React from "react"
import { Eye, Loader2, Filter, Search, AlertTriangle, CheckCircle2, XCircle, Clock, Brain } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { buscarAnalises } from "./actions"
import { ModalAcoes } from "./ModalAcoes"

// ─── MAPAS ────────────────────────────────────────────────────────────────────

const STATUS_GERAL_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  "em_andamento":  { label: "Em Andamento",  color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Clock className="w-3 h-3" /> },
  "Revisar":       { label: "Revisar",        color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Brain className="w-3 h-3" /> },
  "Reprocessando": { label: "Reprocessando",  color: "bg-orange-100 text-orange-800 border-orange-200", icon: <Loader2 className="w-3 h-3" /> },
  "Aprovado":      { label: "Aprovado",       color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  "Bloqueado":     { label: "Bloqueado",      color: "bg-red-100 text-red-800 border-red-200",          icon: <XCircle className="w-3 h-3" /> },
}

const TRIAGEM_MAP: Record<string, { label: string; color: string }> = {
  "aprovado":  { label: "Aprovado",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "reprovado": { label: "Reprovado", color: "bg-red-100 text-red-700 border-red-200" },
  "erro":      { label: "Erro",      color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
}

const ESCRITOR_MAP: Record<string, { label: string; color: string }> = {
  "gerado": { label: "Gerado", color: "bg-blue-100 text-blue-700 border-blue-200" },
  "erro":   { label: "Erro",   color: "bg-red-100 text-red-700 border-red-200" },
}

const JUIZ_MAP: Record<string, { label: string; color: string }> = {
  "aprovado":          { label: "Aprovado",          color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "reprovado":         { label: "Reprovado",          color: "bg-red-100 text-red-700 border-red-200" },
  "limite_tentativas": { label: "Limite atingido",    color: "bg-orange-100 text-orange-700 border-orange-200" },
  "erro":              { label: "Erro",               color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  "aprovado_manual":   { label: "✋ Aprovado Manual",  color: "bg-teal-100 text-teal-700 border-teal-200" },
  "reprovado_manual":  { label: "✋ Reprovado Manual", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
}

const MATURIDADE_MAP: Record<string, string> = {
  "Alta":  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Média": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Baixa": "bg-red-100 text-red-700 border-red-200",
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function StatusBadge({ map, value }: { map: Record<string, { label: string; color: string }>; value?: string | null }) {
  if (!value) return <span className="text-zinc-300 text-xs">—</span>
  const m = map[value]
  if (!m) return <Badge variant="outline">{value}</Badge>
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${m.color}`}>{m.label}</span>
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-zinc-300 text-xs">—</span>
  const color = score >= 75 ? "text-emerald-600" : score >= 60 ? "text-yellow-600" : "text-red-600"
  return <span className={`font-black text-sm ${color}`}>{score}<span className="text-zinc-400 font-normal text-xs">/100</span></span>
}

const CAMPOS_NEGRITO = [
  "Contexto:", "Objetivo:", "Funcionamento:",
  "Risco fiscal/operacional avaliado:", "Critérios de Aceite:",
  "Cenários de QA:", "Classificação:", "Viabilidade:",
]

function TextoFormatado({ texto }: { texto: string }) {
  return (
    <div className="text-sm leading-relaxed text-zinc-600 space-y-1">
      {texto.split("\n").map((linha, i) => {
        const campo = CAMPOS_NEGRITO.find(c => linha.trimStart().startsWith(c))
        if (campo) {
          const resto = linha.trimStart().slice(campo.length)
          return <p key={i} className="mt-3"><span className="font-black text-zinc-800">{campo}</span>{resto}</p>
        }
        return <p key={i}>{linha || <>&nbsp;</>}</p>
      })}
    </div>
  )
}

function InfoVazia({ texto }: { texto: string }) {
  return <p className="text-sm italic text-zinc-400">{texto}</p>
}

function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`p-4 rounded-xl border ${color}`}>
      <h4 className="text-[10px] font-black uppercase tracking-wider mb-3 opacity-60">{title}</h4>
      {children}
    </div>
  )
}

// ─── MULTI SELECT ─────────────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void
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
                  <Checkbox checked={selected.includes(o)} className="mr-2" />{o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function AnalisesPage() {
  const [analises, setAnalises] = React.useState<any[]>([])
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [total, setTotal] = React.useState<number | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilters, setStatusFilters] = React.useState<string[]>([])
  const [triagemFilters, setTriagemFilters] = React.useState<string[]>([])
  const [juizFilters, setJuizFilters] = React.useState<string[]>([])
  const [intervencaoOnly, setIntervencaoOnly] = React.useState(false)
  const observerTarget = React.useRef(null)

  const filtros = React.useMemo(() => ({
    status: statusFilters,
    triagem: triagemFilters,
    juiz: juizFilters,
    intervencao: intervencaoOnly,
  }), [statusFilters, triagemFilters, juizFilters, intervencaoOnly])

  const buscar = React.useCallback(async (p: number, append = false) => {
    if (p === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const res = await buscarAnalises(p, search, filtros)
      setAnalises(prev => append ? [...prev, ...res.analises] : res.analises)
      setHasMore(res.hasMore)
      if (p === 0) setTotal(res.total)
    } catch (err) {
      console.error("Erro ao buscar análises:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, filtros])

  React.useEffect(() => {
    setPage(0)
    const t = setTimeout(() => buscar(0), 400)
    return () => clearTimeout(t)
  }, [buscar])

  React.useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prev => { buscar(prev + 1, true); return prev + 1 })
      }
    }, { threshold: 0.1 })
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, buscar])

  const totalFiltros = statusFilters.length + triagemFilters.length + juizFilters.length + (intervencaoOnly ? 1 : 0)

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800">Análises Automáticas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Acompanhamento das análises geradas pelos agentes</p>
        </div>
        {total !== null && (
          <div className="text-right">
            <p className="text-3xl font-black text-zinc-800">{total.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">análises encontradas</p>
          </div>
        )}
      </div>

      {/* BUSCA */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar por issue (ex: HOS-828)..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3">
        <MultiSelect label="Status Geral" options={Object.keys(STATUS_GERAL_MAP)} selected={statusFilters} onChange={setStatusFilters} />
        <MultiSelect label="Triagem" options={Object.keys(TRIAGEM_MAP)} selected={triagemFilters} onChange={setTriagemFilters} />
        <MultiSelect label="Juiz" options={Object.keys(JUIZ_MAP)} selected={juizFilters} onChange={setJuizFilters} />
        <div
          className="flex items-center gap-2 bg-zinc-50 border rounded-lg px-3 py-2 cursor-pointer select-none hover:bg-zinc-100 transition-colors"
          onClick={() => setIntervencaoOnly(v => !v)}
        >
          <Checkbox checked={intervencaoOnly} />
          <AlertTriangle className={`w-4 h-4 ${intervencaoOnly ? "text-red-500" : "text-zinc-400"}`} />
          <span className={`text-sm font-medium ${intervencaoOnly ? "text-red-600" : "text-zinc-500"}`}>
            Requer Intervenção
          </span>
        </div>
        {totalFiltros > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-zinc-400 h-10"
            onClick={() => { setStatusFilters([]); setTriagemFilters([]); setJuizFilters([]); setIntervencaoOnly(false) }}>
            Limpar ({totalFiltros})
          </Button>
        )}
      </div>

      {/* TABELA */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="w-20" />
              <TableHead className="font-bold text-[10px] uppercase">Issue</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Título</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Status Geral</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Triagem</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Maturidade</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Escritor</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Juiz</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Score</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Intervenção</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-20">
                  <Loader2 className="animate-spin h-6 w-6 text-zinc-300 mx-auto" />
                </TableCell>
              </TableRow>
            ) : analises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-20 text-xs text-zinc-400">
                  Nenhuma análise encontrada.
                </TableCell>
              </TableRow>
            ) : analises.map(a => (
              <TableRow key={a.id} className="hover:bg-zinc-50/50">

                {/* ── AÇÕES ── */}
                <TableCell>
                  <div className="flex items-center gap-1">

                    {/* Sheet de detalhes */}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4 text-zinc-400 hover:text-primary" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="sm:max-w-3xl overflow-y-auto">
                        <SheetHeader className="mb-6">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant="outline">{a.id_issue}</Badge>
                            {(() => {
                              const s = STATUS_GERAL_MAP[a.status_geral]
                              return s ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.color}`}>
                                  {s.icon}{s.label}
                                </span>
                              ) : null
                            })()}
                            {a.precisa_intervencao_humana && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Requer Intervenção
                              </span>
                            )}
                            {a.intervencao_humana_status && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-teal-100 text-teal-700 border-teal-200">
                                ✋ Intervenção por {a.intervencao_humana_por || "humano"}
                              </span>
                            )}
                          </div>
                          <SheetTitle className="text-xl font-black">
                            {a.jira_issues_agente_demandas?.titulo || a.id_issue}
                          </SheetTitle>
                        </SheetHeader>

                        <div className="space-y-4">

                          {/* Descrição */}
                          {a.jira_issues_agente_demandas?.descricao && (
                            <SectionCard title="Descrição da Demanda" color="bg-zinc-50 border-zinc-200">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600">
                                {a.jira_issues_agente_demandas.descricao}
                              </p>
                            </SectionCard>
                          )}

                          {/* TRIAGEM */}
                          <SectionCard title="Triagem" color="bg-zinc-50 border-zinc-200">
                            <div className="flex flex-wrap gap-3 mb-3">
                              <StatusBadge map={TRIAGEM_MAP} value={a.triagem_status} />
                              {a.triagem_maturidade && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${MATURIDADE_MAP[a.triagem_maturidade] || ""}`}>
                                  {a.triagem_maturidade}
                                </span>
                              )}
                            </div>
                            {a.triagem_motivo && <p className="text-sm text-zinc-600 mb-2">{a.triagem_motivo}</p>}
                            {a.triagem_elementos_presentes?.length > 0 && (
                              <p className="text-xs text-emerald-600 mb-1">✅ Presentes: {a.triagem_elementos_presentes.join(", ")}</p>
                            )}
                            {a.triagem_elementos_ausentes?.length > 0 && (
                              <p className="text-xs text-red-500 mb-1">⚠️ Ausentes: {a.triagem_elementos_ausentes.join(", ")}</p>
                            )}
                            {a.triagem_similares?.length > 0 && (
                              <p className="text-xs text-zinc-500">🔗 Similares consolidadas: {a.triagem_similares.map((s: any) => s.issueKey).join(", ")}</p>
                            )}
                            {a.triagem_at && <p className="text-[10px] text-zinc-400 mt-2">{new Date(a.triagem_at).toLocaleString("pt-BR")}</p>}
                          </SectionCard>

                          {/* PESQUISADOR */}
                          <SectionCard title="Pesquisador" color="bg-indigo-50 border-indigo-100">
                            {a.pesquisador_intencoes_busca?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Intenções de Busca</p>
                                <div className="flex flex-wrap gap-1">
                                  {a.pesquisador_intencoes_busca.map((i: string, idx: number) => (
                                    <span key={idx} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">{i}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-3">
                              {a.pesquisador_conhecimento_sistema
                                ? <div>
                                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Base de Conhecimento</p>
                                    <p className="text-xs text-zinc-600 line-clamp-3">{a.pesquisador_conhecimento_sistema}</p>
                                  </div>
                                : <InfoVazia texto="Nenhuma informação da base de conhecimento." />
                              }
                              {a.pesquisador_referencias_legais
                                ? <div>
                                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Referências Legais</p>
                                    <p className="text-xs text-zinc-600 line-clamp-3">{a.pesquisador_referencias_legais}</p>
                                  </div>
                                : <InfoVazia texto="Nenhuma referência legal encontrada." />
                              }
                            </div>
                            {a.pesquisador_at && <p className="text-[10px] text-zinc-400 mt-2">{new Date(a.pesquisador_at).toLocaleString("pt-BR")}</p>}
                          </SectionCard>

                          {/* ESCRITOR */}
                          <SectionCard title="Escritor" color="bg-blue-50 border-blue-100">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <StatusBadge map={ESCRITOR_MAP} value={a.escritor_status} />
                              {a.escritor_modelo && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-mono">
                                  {a.escritor_modelo}
                                </span>
                              )}
                              {a.escritor_resultado_editado && (
                                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                                  ✋ Editado manualmente
                                </span>
                              )}
                            </div>
                            {(a.escritor_resultado_editado || a.escritor_resultado)
                              ? <TextoFormatado texto={a.escritor_resultado_editado || a.escritor_resultado} />
                              : <InfoVazia texto="Nenhuma análise gerada ainda." />
                            }
                            {a.escritor_at && <p className="text-[10px] text-zinc-400 mt-2">{new Date(a.escritor_at).toLocaleString("pt-BR")}</p>}
                          </SectionCard>

                          {/* JUIZ */}
                          <SectionCard title="Juiz" color="bg-amber-50 border-amber-100">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <StatusBadge map={JUIZ_MAP} value={a.juiz_status} />
                              <ScoreBadge score={a.juiz_score} />
                            </div>
                            {a.juiz_devolutiva
                              ? <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{a.juiz_devolutiva}</p>
                              : <InfoVazia texto="Nenhuma devolutiva do juiz ainda." />
                            }
                            {a.juiz_pontos_criticos && (
                              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-[10px] font-black uppercase text-red-400 mb-1">Pontos Críticos</p>
                                <p className="text-xs text-red-700 whitespace-pre-wrap">{a.juiz_pontos_criticos}</p>
                              </div>
                            )}
                            {a.juiz_at && <p className="text-[10px] text-zinc-400 mt-2">{new Date(a.juiz_at).toLocaleString("pt-BR")}</p>}
                          </SectionCard>

                          {/* OBSERVAÇÃO HUMANA */}
                          {a.observacao_humana && (
                            <SectionCard title="💬 Observação Humana" color="bg-teal-50 border-teal-200">
                              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{a.observacao_humana}</p>
                              {a.intervencao_humana_por && (
                                <p className="text-[10px] text-zinc-400 mt-2">por {a.intervencao_humana_por} · {a.intervencao_humana_at ? new Date(a.intervencao_humana_at).toLocaleString("pt-BR") : ""}</p>
                              )}
                            </SectionCard>
                          )}

                          {/* INTERVENÇÃO */}
                          {a.precisa_intervencao_humana && (
                            <SectionCard title="⚠️ Requer Intervenção" color="bg-red-50 border-red-200">
                              <p className="text-sm text-red-700">{a.intervencao_motivo || "Motivo não especificado."}</p>
                            </SectionCard>
                          )}

                        </div>
                      </SheetContent>
                    </Sheet>

                    {/* Modal de ações */}
                    <ModalAcoes analise={a} onSuccess={() => buscar(0)} />

                  </div>
                </TableCell>

                <TableCell className="font-mono text-xs text-zinc-500">{a.id_issue}</TableCell>
                <TableCell className="font-bold text-zinc-900 max-w-xs truncate text-sm" title={a.jira_issues_agente_demandas?.titulo}>
                  {a.jira_issues_agente_demandas?.titulo || "—"}
                </TableCell>
                <TableCell>
                  {(() => {
                    const s = STATUS_GERAL_MAP[a.status_geral]
                    return s ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.color}`}>
                        {s.icon}{s.label}
                      </span>
                    ) : <Badge variant="outline">{a.status_geral}</Badge>
                  })()}
                </TableCell>
                <TableCell><StatusBadge map={TRIAGEM_MAP} value={a.triagem_status} /></TableCell>
                <TableCell>
                  {a.triagem_maturidade
                    ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${MATURIDADE_MAP[a.triagem_maturidade] || ""}`}>{a.triagem_maturidade}</span>
                    : <span className="text-zinc-300 text-xs">—</span>
                  }
                </TableCell>
                <TableCell><StatusBadge map={ESCRITOR_MAP} value={a.escritor_status} /></TableCell>
                <TableCell><StatusBadge map={JUIZ_MAP} value={a.juiz_status} /></TableCell>
                <TableCell><ScoreBadge score={a.juiz_score} /></TableCell>
                <TableCell>
                  {a.precisa_intervencao_humana
                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="w-3 h-3" /> Sim
                      </span>
                    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300">
                        <CheckCircle2 className="w-3 h-3" /> Não
                      </span>
                  }
                </TableCell>
                <TableCell className="text-zinc-400 text-xs">
                  {a.updated_at ? new Date(a.updated_at).toLocaleString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div ref={observerTarget} className="p-8 flex justify-center items-center bg-zinc-50/50">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />}
          {!hasMore && !loading && analises.length > 0 && (
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Fim da listagem</p>
          )}
        </div>
      </div>
    </div>
  )
}
