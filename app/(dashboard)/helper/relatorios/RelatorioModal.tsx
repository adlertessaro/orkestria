"use client"

import * as React from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, FileSpreadsheet } from "lucide-react"
import { saveAs } from "file-saver"
import { RelatorioSuportePDF } from "./RelatorioSuportePDF"
import { pdf } from "@react-pdf/renderer"
import { toast } from "sonner"

interface RelatorioModalProps {
  onGerar: (filtros: any) => Promise<any[]>;
}

export function RelatorioModal({ onGerar }: RelatorioModalProps) {
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);
  
  const formData = new FormData(e.currentTarget);
  const filtros = {
    dataInicio: formData.get("dataInicio") as string,
    dataFim: formData.get("dataFim") as string,
    helperId: formData.get("helperId") as string,
    status: formData.get("status") as string,
    solicitante: formData.get("solicitante") as string,
    setor: formData.get("setor") as string
  };

  const dados = await onGerar(filtros); 
  
  if (dados && dados.length > 0) {
    const doc = <RelatorioSuportePDF dados={dados} filtros={filtros} />;
    const blob = await pdf(doc).toBlob();
    saveAs(blob, `relatorio-suporte.pdf`);
    toast.success(`${dados.length} registros exportados!`);
  } else {
    toast.error("A busca não retornou dados. Verifique os filtros ou se há cards sincronizados.");
  }
  setLoading(false);
}

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
          <BarChart3 className="w-4 h-4" />
          GERAR RELATÓRIO
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Configurações do Relatório
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input id="dataInicio" name="dataInicio" type="date" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input id="dataFim" name="dataFim" type="date" required />
            </div>
            </div>

          <div className="space-y-2">
            <Label htmlFor="solicitante">Solicitante</Label>
            <Input id="solicitante" name="solicitante" placeholder="Nome do membro" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="todos">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor Destino</Label>
              <Select name="setor" defaultValue="suporte">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? "PROCESSANDO..." : "GERAR RELATÓRIO DE SUPORTE"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}