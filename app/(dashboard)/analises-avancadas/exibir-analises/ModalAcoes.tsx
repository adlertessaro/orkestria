"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Settings, CheckCircle2, AlertCircle } from "lucide-react"
import {
  aprovarManualmente,
  reprovarManualmente,
  salvarEdicaoEscritor,
  salvarObservacao,
  forcarReprocessamento,
} from "./actions"
import {
  buscarMembrosJira,
  atualizarResponsaveisJira,
  type JiraMember,
} from "./actions-atualizar-responsaveis"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Props {
  analise: any
  onSuccess?: () => void
}

type ReprocessarFrom = "triagem" | "pesquisador" | "escritor" | "juiz"

interface ResponsaveisState {
  responsavel:          string // accountId | NAO_ALTERAR
  analista_responsavel: string
  qa_responsavel:       string
  developer:            string
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const NAO_ALTERAR = "__nao_alterar__"

const CAMPOS_RESPONSAVEL: { key: keyof ResponsaveisState; label: string }[] = [
  { key: "responsavel",          label: "Responsável" },
  { key: "analista_responsavel", label: "Analista" },
  { key: "qa_responsavel",       label: "QA" },
  { key: "developer",            label: "Developer" },
]

const OPCOES_STATUS = [
  { value: null,          label: "Manter status" },
  { value: "aprovar",     label: "Aprovar" },
  { value: "reprovar",    label: "Reprovar" },
  { value: "reprocessar", label: "Reprocessar" },
]

const PONTOS_REPROCESSAMENTO: { value: ReprocessarFrom; label: string; desc: string }[] = [
  { value: "triagem",     label: "Triagem",     desc: "Limpa tudo" },
  { value: "pesquisador", label: "Pesquisador",  desc: "Pesquisador em diante" },
  { value: "escritor",    label: "Escritor",    desc: "Escritor em diante" },
  { value: "juiz",        label: "Juiz",        desc: "Somente juiz" },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function encontrarMembro(lista: JiraMember[], nome: string | null | undefined): string {
  if (!nome || nome.startsWith("Sem ")) return NAO_ALTERAR
  const found = lista.find((m) => m.displayName.toLowerCase() === nome.toLowerCase())
  return found ? found.accountId : NAO_ALTERAR
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

export function ModalAcoes({ analise, onSuccess }: Props) {
  const [open, setOpen]       = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const por                   = "Adler"

  // Campos de análise
  const [retornoAnalise, setRetornoAnalise] = React.useState(
    analise.escritor_resultado_editado || analise.escritor_resultado || ""
  )
  const [observacao, setObservacao]             = React.useState(analise.observacao_humana || "")
  const [statusAcao, setStatusAcao]             = React.useState<string | null>(null)
  const [motivo, setMotivo]                     = React.useState("")
  const [fromReprocessar, setFromReprocessar]   = React.useState<ReprocessarFrom>("pesquisador")

  // Responsáveis
  const [membros, setMembros]                       = React.useState<JiraMember[]>([])
  const [membrosLoading, setMembrosLoading]         = React.useState(false)
  const [responsaveisLoading, setResponsaveisLoading] = React.useState(false)
  const [responsaveisStatus, setResponsaveisStatus]   = React.useState<"idle" | "ok" | "erro">("idle")
  const [responsaveisErro, setResponsaveisErro]       = React.useState("")

  const [responsaveis, setResponsaveis] = React.useState<ResponsaveisState>({
    responsavel: NAO_ALTERAR, analista_responsavel: NAO_ALTERAR,
    qa_responsavel: NAO_ALTERAR, developer: NAO_ALTERAR,
  })

  // Estado salvo no Jira (referência para diff)
  const originais = React.useRef<ResponsaveisState>({
    responsavel: NAO_ALTERAR, analista_responsavel: NAO_ALTERAR,
    qa_responsavel: NAO_ALTERAR, developer: NAO_ALTERAR,
  })

  // Carrega membros ao abrir o modal
  React.useEffect(() => {
    if (!open) return
    setMembrosLoading(true)
    setResponsaveisStatus("idle")

    buscarMembrosJira().then((lista) => {
      setMembros(lista)
      const inicial: ResponsaveisState = {
        responsavel:          encontrarMembro(lista, analise.responsavel),
        analista_responsavel: encontrarMembro(lista, analise.analista_responsavel),
        qa_responsavel:       encontrarMembro(lista, analise.qa_responsavel),
        developer:            encontrarMembro(lista, analise.developer),
      }
      originais.current = { ...inicial }
      setResponsaveis(inicial)
      setMembrosLoading(false)
    })
  }, [open])

  // Só os campos que realmente mudaram em relação ao estado original
  const camposAlterados = React.useMemo(
    () => CAMPOS_RESPONSAVEL.filter((c) => responsaveis[c.key] !== originais.current[c.key]),
    [responsaveis]
  )

  const temAlteracao = camposAlterados.length > 0

  // Sincroniza motivo com retorno ao mudar status
  React.useEffect(() => {
    if (statusAcao === "aprovar" || statusAcao === "reprovar") setMotivo(retornoAnalise.trim())
    else setMotivo("")
  }, [statusAcao])

  // Salva só os campos alterados no Jira
  const handleSalvarResponsaveis = async () => {
    setResponsaveisLoading(true)
    setResponsaveisStatus("idle")

    const payload: Parameters<typeof atualizarResponsaveisJira>[1] = {}
    const nomes:   Parameters<typeof atualizarResponsaveisJira>[2] = {}

    for (const campo of camposAlterados) {
      const accountId = responsaveis[campo.key]
      // Se voltou para NAO_ALTERAR aqui, significa que o original era NAO_ALTERAR
      // também — não aparece em camposAlterados. Logo accountId sempre é um id real.
      const membro = membros.find((m) => m.accountId === accountId) ?? null
      ;(payload as any)[campo.key] = membro?.accountId ?? null
      ;(nomes   as any)[campo.key] = membro?.displayName ?? undefined
    }

    const result = await atualizarResponsaveisJira(
      analise.issue_key ?? analise.id_issue,
      payload,
      nomes
    )

    if (result.success) {
      originais.current = { ...responsaveis }
      setResponsaveisStatus("ok")
      setTimeout(() => setResponsaveisStatus("idle"), 3000)
    } else {
      setResponsaveisErro(result.error ?? "Erro desconhecido")
      setResponsaveisStatus("erro")
    }

    setResponsaveisLoading(false)
  }

  const handleSalvar = async () => {
    setLoading(true)
    try {
      const textoOriginal = analise.escritor_resultado_editado || analise.escritor_resultado || ""
      if (retornoAnalise.trim() !== textoOriginal.trim())
        await salvarEdicaoEscritor(analise.id_issue, retornoAnalise, por)

      if (observacao.trim() !== (analise.observacao_humana || "").trim())
        await salvarObservacao(analise.id_issue, observacao, por)

      if (statusAcao === "aprovar")     await aprovarManualmente(analise.id_issue, motivo, por)
      else if (statusAcao === "reprovar")    await reprovarManualmente(analise.id_issue, motivo, por)
      else if (statusAcao === "reprocessar") await forcarReprocessamento(analise.id_issue, fromReprocessar, por)

      setOpen(false)
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  const podeConfirmar = statusAcao !== "reprovar" || motivo.trim().length > 0

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Ações">
          <Settings className="w-4 h-4 text-zinc-400" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl">

        {/* HEADER */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-semibold text-zinc-800 leading-none">
              Intervenção Manual
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs text-zinc-400 border-zinc-200 font-normal">
              {analise.id_issue}
            </Badge>
          </div>
        </DialogHeader>

        {/* CORPO */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* RESPONSÁVEIS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between min-h-[24px]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Responsáveis
              </p>

              {membrosLoading && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
                </span>
              )}

              {!membrosLoading && responsaveisStatus === "idle" && temAlteracao && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSalvarResponsaveis}
                  disabled={responsaveisLoading}
                  className="h-7 px-3 text-xs border-zinc-300 text-zinc-700 hover:bg-zinc-50 gap-1.5"
                >
                  {responsaveisLoading
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Salvando…</>
                    : <>Salvar no Jira <span className="text-zinc-400">({camposAlterados.length})</span></>
                  }
                </Button>
              )}

              {responsaveisStatus === "ok" && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Salvo no Jira
                </span>
              )}

              {responsaveisStatus === "erro" && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" /> {responsaveisErro}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              {CAMPOS_RESPONSAVEL.map((campo) => {
                const alterado = responsaveis[campo.key] !== originais.current[campo.key]
                return (
                  <div key={campo.key} className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      {campo.label}
                      {alterado && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </label>
                    <Select
                      value={responsaveis[campo.key]}
                      onValueChange={(v) =>
                        setResponsaveis((p) => ({ ...p, [campo.key]: v }))
                      }
                      disabled={membrosLoading}
                    >
                      <SelectTrigger
                        className={`h-8 text-xs transition-colors ${
                          alterado
                            ? "border-amber-300 bg-amber-50/60 text-zinc-800"
                            : "border-zinc-200 text-zinc-600"
                        }`}
                      >
                        <SelectValue placeholder="Não alterar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NAO_ALTERAR} className="text-xs text-zinc-400 italic">
                          — Não alterar —
                        </SelectItem>
                        {membros.map((m) => (
                          <SelectItem key={m.accountId} value={m.accountId} className="text-xs">
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          </section>

          <Separator className="bg-zinc-100" />

          {/* RETORNO DA ANÁLISE */}
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Retorno da Análise
            </p>
            <p className="text-xs text-zinc-400">
              Edite o conteúdo que será exibido como análise final.
            </p>
            <Textarea
              value={retornoAnalise}
              onChange={(e) => setRetornoAnalise(e.target.value)}
              rows={9}
              className="font-mono text-xs resize-y border-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-0"
            />
          </section>

          {/* OBSERVAÇÃO */}
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Observação Interna
            </p>
            <p className="text-xs text-zinc-400">
              Anotação interna — não interfere na análise do agente.
            </p>
            <Textarea
              placeholder="Ex: Aprovado pois o erro fiscal foi confirmado manualmente…"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="resize-none text-sm border-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-0"
            />
          </section>

          {/* STATUS */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Alterar Status
            </p>
            <div className="grid grid-cols-4 gap-2">
              {OPCOES_STATUS.map((op) => (
                <button
                  key={String(op.value)}
                  onClick={() => setStatusAcao(op.value)}
                  className={`h-9 rounded-lg border text-xs font-medium transition-all ${
                    statusAcao === op.value
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </section>

          {/* MOTIVO */}
          {(statusAcao === "aprovar" || statusAcao === "reprovar") && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Motivo
                {statusAcao === "reprovar" && (
                  <span className="ml-1.5 text-red-400 text-[10px] normal-case font-normal tracking-normal">
                    * obrigatório
                  </span>
                )}
              </p>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={5}
                className="resize-y text-sm border-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-0"
              />
            </section>
          )}

          {/* PONTO DE REPROCESSAMENTO */}
          {statusAcao === "reprocessar" && (
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Reprocessar a partir de
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PONTOS_REPROCESSAMENTO.map((op) => (
                  <button
                    key={op.value}
                    onClick={() => setFromReprocessar(op.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      fromReprocessar === op.value
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-xs font-semibold">{op.label}</p>
                    <p className="text-[10px] opacity-50 mt-0.5 leading-tight">{op.desc}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2 shrink-0 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="text-zinc-500 hover:text-zinc-700"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={loading || !podeConfirmar}
            className="min-w-[96px] bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
            Salvar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}