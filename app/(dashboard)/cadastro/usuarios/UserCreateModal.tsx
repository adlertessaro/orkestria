"use client"

import * as React from "react"
import { UserPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { createUserAction } from "@/app/(dashboard)/cadastro/usuarios/actions"

interface UserCreateModalProps {
  onSuccess: () => void
}

export function UserCreateModal({ onSuccess }: UserCreateModalProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const result = await createUserAction(formData) // Usa a Server Action

    setIsSubmitting(false)

    if (result.success) {
      toast.success("Utilizador criado com sucesso!")
      setIsOpen(false)
      onSuccess() // Recarrega a tabela
    } else {
      toast.error(result.error || "Erro ao criar utilizador")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:opacity-90 transition-opacity">
          <UserPlus className="mr-2 h-4 w-4" /> NOVO USUÁRIO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <Input name="username" placeholder="Nome de usuário" required />
          <Input name="email" type="email" placeholder="E-mail" required />
          <Input name="password" type="password" placeholder="Senha" required />
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "CADASTRAR"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}