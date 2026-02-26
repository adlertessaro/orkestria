"use client"

import * as React from "react"
import { Search, PlusCircle, Building2, ShoppingCart, Key, Fingerprint, Loader2, Terminal, Edit, RotateCcw, Save } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { buscarEmpresa, cadastrarEmpresa, editarEmpresa } from "./actions"

export default function HosEcommercePage() {
  const [loading, setLoading] = React.useState(false)
  const [resultado, setResultado] = React.useState<any>(null)
  const [activeTab, setActiveTab] = React.useState("buscar")

  const [dadosParaEditar, setDadosParaEditar] = React.useState<any>(null)

  // Função central de limpeza
  const resetForm = (tab: string) => {
    setResultado(null)
    setActiveTab(tab)
  }

  const normalizarDados = (dados: any) => {
    if (!dados) return null
    const item = Array.isArray(dados) ? dados[0] : dados
    return {
      razao: item.razao_Social || item.razaoSocial || "N/A",
      fantasia: item.nome_Fantasia || item.fantasia || "N/A",
      cnpj: item.cnpj || "N/A",
      status: String(item.status || "ATIVO").toUpperCase(),
      codigo: item.codigo || "N/A",
      cnpjEcom: item.cnpJ_Ecommerce || item.cnpjEcommerce || "N/A",
      nomeEcom: item.nome_Ecommerce || item.nomeEcommerce || "N/A",
      chave: item.chave_Acesso || "**********"
    }
  }

  // PASSO 1 DA EDIÇÃO: Localizar para carregar
  const handleCarregarEdicao = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const res = await buscarEmpresa(formData.get("cnpj") as string)
      
      if (res.success) {
        setDadosParaEditar(normalizarDados(res.data))
        // Feedback visual de sucesso ao encontrar a empresa
        toast.success("Dados carregados para edição!")
      } else {
        // Feedback de erro se a empresa não existir
        toast.error(res.error || "Empresa não encontrada para editar")
      }
    } catch (err) {
      toast.error("Erro de conexão ao buscar dados")
    } finally {
      setLoading(false)
    }
  }

  const handleSalvarEdicao = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const res = await editarEmpresa(formData)

      if (res.success) {
        // Alerta de sucesso vibrante para o usuário
        toast.success("Alterações gravadas com sucesso!")
        setDadosParaEditar(null) 
      } else {
        // Alerta de erro com a mensagem específica do backend
        toast.error(res.error || "Falha ao salvar as alterações")
      }
    } catch (err) {
      toast.error("Erro crítico ao tentar salvar")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, action: Function, successMsg: string) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await action(action === buscarEmpresa ? formData.get("cnpj") : formData)
      if (res.success) {
        setResultado(normalizarDados(res.data))
        // Exibe a mensagem de sucesso que passamos por argumento
        toast.success(successMsg)
      } else {
        // Exibe o erro retornado pela action
        toast.error(res.error || "Ocorreu um erro na operação")
      }
    } catch (err) {
      toast.error("Erro na comunicação com o servidor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">HOS E-Commerce 2.0</h1>
        <h3 className="text-sm text-muted-foreground">Gerencie as integrações e-commerce vinculadas às empresas</h3>
      </div>

      {/* LÓGICA DE RESET: onValueChange limpa o resultado ao trocar de aba */}
      <Tabs value={activeTab} onValueChange={resetForm} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
          <TabsTrigger value="buscar"><Search className="w-4 h-4 mr-2" /> BUSCAR</TabsTrigger>
          <TabsTrigger value="cadastrar"><PlusCircle className="w-4 h-4 mr-2" /> CADASTRAR</TabsTrigger>
          <TabsTrigger value="editar"><Edit className="w-4 h-4 mr-2" /> EDITAR</TabsTrigger>
        </TabsList>

        {/* BUSCA */}
        <TabsContent value="buscar">
          <Card className="shadow-sm border-zinc-200">
            <CardContent className="pt-6">
              <form onSubmit={(e) => handleSubmit(e, buscarEmpresa, "Dados carregados")} className="flex gap-4">
                <Input name="cnpj" placeholder="Digite o CNPJ para localizar" required className="h-12" />
                <Button type="submit" disabled={loading} className="h-12 px-8">
                  {loading ? <Loader2 className="animate-spin" /> : "BUSCAR"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CADASTRAR */}
        <TabsContent value="cadastrar">
          <Card className="shadow-sm border-zinc-200">
            <CardContent className="pt-6">
              <form onSubmit={(e) => handleSubmit(e, cadastrarEmpresa, "Empresa cadastrada!")} className="grid grid-cols-2 gap-4">
                <Input name="cnpj" placeholder="Digite o CNPJ da empresa" required className="h-12" />
                <Input name="razaoSocial" placeholder="Razão Social" required className="h-12" />
                <Input name="fantasia" placeholder="Nome Fantasia" required className="h-12" />
                <Input name="cnpjEcommerce" placeholder="CNPJ do E-commerce" required className="h-12" />
                <Button type="submit" disabled={loading} className="h-12 col-span-2">
                  {loading ? <Loader2 className="animate-spin" /> : "Cadastrar Empresa"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editar" className="space-y-6">
          {/* PASSO 1: BUSCA PARA LOCALIZAR */}
          {!dadosParaEditar ? (
            <Card className="bg-blue-50/50 border-blue-200 shadow-none">
              <CardContent className="pt-6">
                <form onSubmit={handleCarregarEdicao} className="flex gap-4">
                  <Input name="cnpj" placeholder="Digite o CNPJ para localizar" required className="h-12 bg-white" />
                  <Button type="submit" disabled={loading} className="h-12 px-6">
                    {loading ? <Loader2 className="animate-spin" /> : <Search className="mr-2 h-4 w-4" />} CARREGAR DADOS
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* PASSO 2: FORMULÁRIO DE EDIÇÃO COM DADOS PRÉ-CARREGADOS */
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-blue-500 uppercase tracking-widest">Editando: {dadosParaEditar.razao}</h4>
                <Button variant="ghost" size="sm" onClick={() => setDadosParaEditar(null)} className="text-zinc-400">
                  <RotateCcw className="w-4 h-4 mr-2" /> Trocar Empresa
                </Button>
              </div>

              <Card className="border-orange-200 shadow-sm">
                <CardContent className="pt-8">
                  <form onSubmit={handleSalvarEdicao} className="grid grid-cols-2 gap-6">
                    {/* O CNPJ é o ID, deve ser enviado mas pode ficar desabilitado visualmente */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">CNPJ Identificador</label>
                      <Input name="cnpj" value={dadosParaEditar.cnpj} readOnly className="h-12 bg-zinc-50 font-mono" />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Nova Razão Social</label>
                      <Input name="razaoSocial" defaultValue={dadosParaEditar.razao} required className="h-12" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Novo Nome Fantasia</label>
                      <Input name="fantasia" defaultValue={dadosParaEditar.fantasia} required className="h-12" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Novo CNPJ E-commerce</label>
                      <Input name="cnpjEcommerce" defaultValue={dadosParaEditar.cnpjEcom} required className="h-12" />
                    </div>

                    <Button type="submit" disabled={loading} className="h-14 col-span-2 bg-orange-600 hover:bg-orange-700 text-lg font-bold">
                      {loading ? <Loader2 className="animate-spin" /> : <Save className="mr-3 h-5 w-5" />} SALVAR ALTERAÇÕES
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* EXIBIÇÃO ÚNICA DE RESULTADO: Aparece abaixo de qualquer formulário preenchido */}
        {resultado && (
          <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-l-8 border-primary shadow-lg overflow-hidden">
              <CardHeader className="bg-zinc-50/50 flex flex-row items-center justify-between border-b border-zinc-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                    {activeTab === "buscar" ? "Consulta de Unidade" : activeTab === "cadastrar" ? "Nova Unidade" : "Unidade Atualizada"}
                  </p>
                  <CardTitle className="text-2xl font-black text-zinc-900">{resultado.razao}</CardTitle>
                </div>
                <Badge className={resultado.status === 'ATIVO' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                  {resultado.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <InfoRow icon={Building2} label="CNPJ" value={resultado.cnpj} />
                    <InfoRow icon={Building2} label="Nome Fantasia" value={resultado.fantasia} />
                  </div>
                  <div className="space-y-6">
                    <InfoRow icon={ShoppingCart} label="E-commerce (Nome/CNPJ)" value={`${resultado.nomeEcom} / ${resultado.cnpjEcom}`} />
                    <InfoRow icon={Key} label="Token" value={resultado.chave} />
                  </div>
                </div>
                <Accordion type="single" collapsible className="mt-8 border-t">
                  <AccordionItem value="json">
                    <AccordionTrigger className="text-xs text-muted-foreground"><Terminal className="w-4 h-4 mr-2"/> VER DADOS BRUTOS (JSON)</AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-xs overflow-auto">
                        {JSON.stringify(resultado, null, 2)}
                      </pre>
                    </AccordionContent>
                 </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  )
}

// Subcomponente de auxílio visual
function InfoRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-zinc-400" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{label}</span>
        <span className="text-sm font-medium text-zinc-700">{value}</span>
      </div>
    </div>
  )
}
