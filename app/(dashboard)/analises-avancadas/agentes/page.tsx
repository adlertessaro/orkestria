"use client"

import * as React from "react"
import { Loader2, Pencil, Save, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { buscarAgentes, atualizarAgente } from "./actions"

export default function AgentesPage() {
  const [agentes, setAgentes] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editandoId, setEditandoId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<any>({})
  const [salvando, setSalvando] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await buscarAgentes()
      setAgentes(data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  const handleEditar = (agente: any) => {
    setEditandoId(agente.id)
    setForm({ ...agente })
  }

  const handleCancelar = () => {
    setEditandoId(null)
    setForm({})
  }

  const handleSalvar = async () => {
    setSalvando(true)
    const res = await atualizarAgente(editandoId!, {
      slug: form.slug,
      nome: form.nome,
      utilidade: form.utilidade,
      prompt_sistema: form.prompt_sistema,
      llm_provider: form.llm_provider,
      llm_model: form.llm_model,
      temperature: parseFloat(form.temperature),
      ativo: form.ativo,
    })

    if (res.success) {
      toast.success("Agente atualizado!")
      setEditandoId(null)
      setForm({})
      await loadData()
    } else {
      toast.error("Erro ao salvar: " + res.error)
    }

    setSalvando(false)
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">

      {/* HEADER */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <h1 className="text-xl font-bold">Agentes de Análise</h1>
      </div>

      {/* TABELA */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">  {/* ← adiciona scroll horizontal */}
          <table className="w-full text-sm min-w-[900px]">  {/* ← largura mínima */}
            <thead className="bg-muted/50 border-b border-border">
              <tr>
              <th className="p-4 text-left font-semibold">Nome</th>
              <th className="p-4 text-left font-semibold">Slug</th>
              <th className="p-4 text-left font-semibold">Utilidade</th>
              <th className="p-4 text-center font-semibold">Provider</th>
              <th className="p-4 text-center font-semibold">Modelo</th>
              <th className="p-4 text-center font-semibold">Temp.</th>
              <th className="p-4 text-center font-semibold">Status</th>
              <th className="p-4 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-12 text-center">
                  <Loader2 className="animate-spin mx-auto text-primary" />
                </td>
              </tr>
            ) : agentes.map((agente, index) => {
              const estaEditando = editandoId === agente.id
              const dados = estaEditando ? form : agente

              return (
                <React.Fragment key={agente.id}>
                  <tr className="hover:bg-muted/30 transition-colors">

                    <td className="p-4 font-medium text-foreground">
                      {estaEditando ? (
                        <Input
                          value={dados.nome}
                          onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))}
                          className="h-8 text-sm w-40"
                        />
                      ) : dados.nome}
                    </td>

                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      {estaEditando ? (
                        <Input
                          value={dados.slug}
                          onChange={e => setForm((f: any) => ({ ...f, slug: e.target.value }))}
                          className="h-8 text-sm font-mono w-36"
                        />
                      ) : dados.slug}
                    </td>

                    <td className="p-4 text-muted-foreground max-w-xs truncate">
                      {estaEditando ? (
                        <Input
                          value={dados.utilidade}
                          onChange={e => setForm((f: any) => ({ ...f, utilidade: e.target.value }))}
                          className="h-8 text-sm w-56"
                        />
                      ) : dados.utilidade}
                    </td>

                    <td className="p-4 text-center">
                      {estaEditando ? (
                        <Input
                          value={dados.llm_provider}
                          onChange={e => setForm((f: any) => ({ ...f, llm_provider: e.target.value }))}
                          className="h-8 text-sm text-center w-24 mx-auto"
                        />
                      ) : dados.llm_provider}
                    </td>

                    <td className="p-4 text-center font-mono text-xs">
                      {estaEditando ? (
                        <Input
                          value={dados.llm_model}
                          onChange={e => setForm((f: any) => ({ ...f, llm_model: e.target.value }))}
                          className="h-8 text-sm font-mono text-center w-44 mx-auto"
                        />
                      ) : dados.llm_model}
                    </td>

                    <td className="p-4 text-center">
                      {estaEditando ? (
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={dados.temperature}
                          onChange={e => setForm((f: any) => ({ ...f, temperature: e.target.value }))}
                          className="h-8 text-sm text-center w-16 mx-auto"
                        />
                      ) : dados.temperature}
                    </td>

                    <td className="p-4 text-center">
                      {estaEditando ? (
                        <select
                          value={dados.ativo ? "true" : "false"}
                          onChange={e => setForm((f: any) => ({ ...f, ativo: e.target.value === "true" }))}
                          className="h-8 text-xs border border-border rounded-md px-2 bg-background"
                        >
                          <option value="true">Ativo</option>
                          <option value="false">Inativo</option>
                        </select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={dados.ativo
                            ? "text-green-600 bg-green-50"
                            : "text-red-600 bg-red-50"
                          }
                        >
                          {dados.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {estaEditando ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelar}
                            disabled={salvando}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleSalvar}
                            disabled={salvando}
                          >
                            {salvando
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Save className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditar(agente)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>

                  {/* Linha expandida do prompt — só aparece ao editar */}
                  {estaEditando && (
                    <tr className="bg-muted/20">
                      <td colSpan={9} className="px-4 pb-4">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Prompt do Sistema</label>
                          <Textarea
                            value={dados.prompt_sistema}
                            onChange={e => setForm((f: any) => ({ ...f, prompt_sistema: e.target.value }))}
                            className="text-sm min-h-[100px] resize-y"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
