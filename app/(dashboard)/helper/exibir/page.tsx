"use client"

import * as React from "react"
import { Eye, Search, Loader2, Clock, User, Building2, Package, MessageSquare, Users, FileText, Filter, ExternalLink } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { getCardsPaginados, getCardDetailsFromDB } from "./actions"

export default function ExibirPage() {
  const [cards, setCards] = React.useState<any[]>([])
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilters, setStatusFilters] = React.useState<string[]>(["Pendente", "Em andamento"])
  const [totalCount, setTotalCount] = React.useState(0)
  
  // Estado único para detalhes e loading lateral
  const [details, setDetails] = React.useState({ members: "", comments: [] as any[] })
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  
  const observerTarget = React.useRef(null)

  const parseDesc = (desc: string) => {
  // Função para campos simples (uma única linha)
  const extractLine = (key: string) => desc?.split(`${key}:`)[1]?.split("\n")[0]?.trim() || "---"
  
  // Função para a descrição (pega tudo após o rótulo até o fim do texto)
  const extractFull = (key: string) => {
    const parts = desc?.split(`${key}:`)
    return parts && parts.length > 1 ? parts[1].trim() : "---"
  }

  return {
    cliente: extractLine("**Cliente**"),
    produto: extractLine("**Tipo da Ajuda**"),
    solicitante: extractLine("**Solicitado por**"),
    data: extractLine("**Data Solicitação**"),
    descricao: extractFull("**Descrição**")
  }
}

  const loadData = React.useCallback(async (p: number, s: string, status: string[], append = false) => {
    if (p === 0) setLoading(true)
    else setLoadingMore(true)
    
    const res = await getCardsPaginados(p, s, status)
    
    setCards(prev => {
      // Se for a Página 0 (append = false), simplesmente substitui tudo
      if (!append) return res.cards
      
      // Filtra os novos cards garantindo que nenhum id_trello já exista na tela
      const novosCards = res.cards.filter(novo => 
        !prev.some(antigo => antigo.id_trello === novo.id_trello)
      )
      
      return [...prev, ...novosCards]
    })
    
    setHasMore(res.hasMore)
    setTotalCount(res.totalCount)
    setLoading(false); setLoadingMore(false)
  }, [])

  React.useEffect(() => {
    setPage(0)
    const timer = setTimeout(() => loadData(0, search, statusFilters), 400)
    return () => clearTimeout(timer)
  }, [search, statusFilters, loadData])

  React.useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prev => {
          const nextPage = prev + 1
          loadData(nextPage, search, statusFilters, true)
          return nextPage
        })
      }
    }, { threshold: 0.1 })
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, search, statusFilters, loadData])

  // Ação ao clicar no olho
  const handleOpenSheet = async (cardId: string) => {
    setLoadingDetails(true)
    setDetails({ members: "", comments: [] }) // Limpa o anterior
    const res = await getCardDetailsFromDB(cardId)
    setDetails(res)
    setLoadingDetails(false)
  }

  const corDoStatus = (status: string) => {
    switch(status.trim().toLowerCase()) {
      case 'pendente': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'em andamento': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'concluído': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col gap-1">
        {/* Usamos flex e justify-between para jogar o total para a direita */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-zinc-800">HOS Helper</h1>
            <h3 className="text-xs text-zinc-400 mt-0.5">Auxílios para suporte e implantação | Comunicação Interna</h3>
          </div>
          {totalCount !== null && (
          <div className="text-right">
            <p className="text-3xl font-black text-zinc-800">{totalCount.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">Helpers encontrados</p>
          </div>
        )}
        </div>
        
        <div className="flex items-center gap-3 mt-4">
          <Input placeholder="Filtrar demandas..." className="max-w-xs" onChange={e => setSearch(e.target.value)} />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-dashed h-10">
                <Filter className="mr-2 h-4 w-4" /> Status ({statusFilters.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              {["Pendente", "Em andamento", "Concluído"].map(s => (
                <div key={s} className="flex items-center space-x-2 p-2 hover:bg-zinc-100 rounded-md cursor-pointer"
                     onClick={() => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                  <Checkbox checked={statusFilters.includes(s)} />
                  <span className="text-sm">{s}</span>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="w-20"></TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Título</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Cliente</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Produto</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Solicitante</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Responsável</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Abertura</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Ult. Atualização</TableHead>
              <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map(card => {
              const info = parseDesc(card.description)
              return (
                <TableRow key={card.id_trello} className="hover:bg-zinc-50/50">
                  <TableCell>
                    {/* A div flex garante o alinhamento horizontal perfeito */}
                    <div className="flex items-center gap-1">
                      
                      {/* O Sheet precisa envolver o Trigger e o Content para funcionar */}
                      <Sheet onOpenChange={(open) => open && handleOpenSheet(card.id_trello)}>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4 text-zinc-400 hover:text-primary" />
                          </Button>
                        </SheetTrigger>
                        
                        <SheetContent className="sm:max-w-xl overflow-y-auto">
                          <SheetHeader className="mb-6">
                            <Badge className="w-fit mb-2">{card.status}</Badge>
                            <SheetTitle className="text-2xl font-black">{card.title}</SheetTitle>
                          </SheetHeader>

                          <div className="grid grid-cols-2 gap-6 border-y py-6 border-zinc-100 mb-8">
                            <div className="space-y-1">
                              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-zinc-400">
                                <Users className="w-3 h-3" /> Responsável
                              </span>
                              <p className="text-sm font-bold text-zinc-800 break-words">
                                {loadingDetails ? "Carregando..." : details.members}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-zinc-400">
                                <User className="w-3 h-3" /> Solicitante
                              </span>
                              <p className="text-sm font-bold text-zinc-800 break-words">{info.solicitante}</p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="p-4 bg-zinc-50 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-600">
                              <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-2">Descrição</h4>
                              {info.descricao !== "---" ? info.descricao : card.description}
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" /> Histórico de Comentários
                              </h4>

                              {loadingDetails ? (
                                <div className="flex justify-center py-10">
                                  <Loader2 className="animate-spin h-6 w-6 text-zinc-200" />
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {details.comments.map((c, i) => (
                                    <div key={i} className="p-3 border rounded-xl border-zinc-100 bg-white shadow-sm">
                                      <div className="flex justify-between items-center mb-1 border-b border-zinc-50 pb-1">
                                        <span className="text-[10px] font-black uppercase text-primary">{c.author}</span>
                                        <span className="text-[9px] text-zinc-400 font-bold">{new Date(c.date).toLocaleString()}</span>
                                      </div>
                                      <p className="text-zinc-600 leading-snug break-words whitespace-pre-wrap">{c.text}</p>
                                    </div>
                                  ))}
                                  {details.comments.length === 0 && (
                                    <p className="text-xs text-zinc-400 italic text-center py-4">Sem comentários.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>

                      {/* BOTÃO DO TRELLO: Fica fora do Sheet, mas dentro da TableCell.
                          Isso impede que o clique nele tente abrir a barra lateral por engano.
                      */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => card.url_card && window.open(card.url_card, '_blank')}
                        disabled={!card.url_card}
                        title="Abrir no Trello"
                      >
                        <ExternalLink className="w-4 h-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-zinc-900">{card.title}</TableCell>
                  <TableCell className="text-blue-600 font-bold text-xs">{info.cliente}</TableCell>
                  <TableCell className="text-emerald-600 font-bold text-xs">{info.produto}</TableCell>
                  <TableCell className="text-indigo-600 font-bold text-xs">{info.solicitante}</TableCell>
                  <TableCell className="text-zinc-600 text-xs font-medium">{card.membros && card.membros.length > 0 ? card.membros.map((m: any) => m.name_member).join(", ") : "Não atribuído"}</TableCell>
                  <TableCell className="text-orange-600 font-bold text-xs">{info.data}</TableCell>
                  <TableCell className="text-zinc-500 text-xs">
                    {card.ultima_atualizacao ? new Date(card.ultima_atualizacao).toLocaleString() : "---"}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={corDoStatus(card.status)}>{card.status}</Badge></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div ref={observerTarget} className="p-8 flex justify-center items-center bg-zinc-50/50">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />}
          {!hasMore && !loading && <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Fim da listagem</p>}
        </div>
      </div>
    </div>
  )
}