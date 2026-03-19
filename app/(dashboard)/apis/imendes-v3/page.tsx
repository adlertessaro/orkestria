"use client"

import * as React from "react"
import { ReceiptText, Percent, Gavel, Loader2, Terminal, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { consultarTributosImendes } from "./actions"
import { Label } from "@/components/ui/label"

export default function ImendesV3Page() {
  const [loading, setLoading] = React.useState(false)
  const [resultados, setResultados] = React.useState<any[]>([])

  // Helper de formatação de percentual
  const formatPercent = (val: any) => (val !== null && val !== undefined) ? `${val}%` : "---"

  // Helper para navegar no "labirinto" de ICMS da Imendes
  const obterDadoIcms = (grupo: any) => {
    const caracTrib = grupo.Regras?.[0]?.uFs?.[0]?.CFOP?.CaracTrib?.[0]
    return caracTrib || grupo // Fallback para a raiz se não encontrar
  }

  const handleConsulta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await consultarTributosImendes(formData)
    
    setLoading(false)
    if (res.success) {
      setResultados(res.data.Grupos || [])
      toast.success("Consulta tributária finalizada!")
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <h1 className="text-xl font-bold text-zinc-800">Consulta de Tributação Imendes</h1>
      <h3 className="text-xs text-zinc-400 mt-0.5">Consultar integração Imendes v3</h3>

      {/* 1. FORMULÁRIO DE ENTRADA */}
      <Card className="shadow-sm border-zinc-200">
        <form onSubmit={handleConsulta} className="p-8 space-y-8">
          <div>
            <p className="text-xs font-bold text-primary mb-4 tracking-widest">1. DADOS DO EMITENTE</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 uppercase">
              <Input name="cnpj_emit" placeholder="CNPJ Emitente" required />
              <Input name="uf_emit" placeholder="UF Emitente (EX: GO)" maxLength={2} required />
              <Select name="regime" defaultValue="LR">
                <SelectTrigger><SelectValue placeholder="Regime Tributário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LR">Lucro Real</SelectItem>
                  <SelectItem value="LP">Lucro Presumido</SelectItem>
                  <SelectItem value="SN">Simples Nacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-primary mb-4 tracking-widest">2. PERFIL DA OPERAÇÃO E PRODUTO</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 uppercase">
              <Input name="gtin" placeholder="GTIN/EAN do Produto" />
              <Input name="uf_dest" placeholder="UF Destino (EX: GO, SP)" />
              <Input name="cfop" placeholder="CFOP (EX: 2102)" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type= "submit" disabled={loading} className="h-12 px-6">
              {loading ? <Loader2 className="animate-spin" /> : "CONSULTAR TRIBUTOS"}
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. RESULTADOS */}
      <div className="space-y-6">
        {resultados.map((grupo, idx) => {
          const icms = obterDadoIcms(grupo);
          const pc = grupo.pisCofins || {};

          return (
            <Card key={idx} className="border-l-8 border-blue-500 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="bg-zinc-50 p-6 border-b">
                <h3 className="text-xl font-black text-zinc-800 uppercase">{grupo.descricao}</h3>
                <p className="text-sm text-zinc-500 font-medium">NCM: {grupo.nCM} | CEST: {grupo.cEST || "---"}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                {/* PIS / COFINS (Estilo Azul) */}
                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <p className="font-bold text-blue-600 text-[10px] mb-3 uppercase tracking-wider">PIS / COFINS</p>
                  <InfoItem label="CST Saída" value={pc.cstSai} icon={Label} />
                  <InfoItem label="Alíq. PIS" value={formatPercent(pc.aliqPis)} icon={Percent} />
                  <InfoItem label="Alíq. COFINS" value={formatPercent(pc.aliqCofins)} icon={Percent} />
                </div>

                {/* ICMS REGRA (Estilo Esmeralda) */}
                <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <p className="font-bold text-emerald-700 text-[10px] mb-3 uppercase tracking-wider">ICMS – REGRA</p>
                  <InfoItem label="CST" value={icms.cST || icms.cst} icon={Label} />
                  <InfoItem label="Alíq. Interna" value={formatPercent(icms.aliqIcmsInterna)} icon={Percent} />
                  <InfoItem label="Redução BC" value={formatPercent(icms.reducaoBcIcms)} icon={Percent} />
                </div>

                {/* ICMS AJUSTES (Estilo Roxo) */}
                <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                  <p className="font-bold text-purple-700 text-[10px] mb-3 uppercase tracking-wider">ICMS – AJUSTES / ST</p>
                  <InfoItem label="IVA (%)" value={formatPercent(icms.iVA)} icon={Percent} />
                  <InfoItem label="IVA Ajust. (%)" value={formatPercent(icms.iVAAjust)} icon={Percent} />
                  <InfoItem label="FCP ST (%)" value={formatPercent(icms.fcpSt)} icon={Percent} />
                </div>
              </div>

              <Accordion type="single" collapsible className="mt-8 border-t">
                <AccordionItem value="json">
                  <AccordionTrigger className="text-xs text-muted-foreground"><Terminal className="w-4 h-4 mr-2"/> VER DADOS BRUTOS (JSON)</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-xs overflow-auto">
                      {JSON.stringify(grupo, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          );
        })}
      </div>
    </div>
  )
}

function InfoItem({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-[10px] font-bold text-zinc-400 uppercase">{label}:</span>
      <span className="text-sm font-semibold text-zinc-700">{value ?? "---"}</span>
    </div>
  )
}