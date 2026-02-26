"use client"

import * as React from "react"
import { CheckCheck, History, Trash2, MoreVertical, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

// --- BOTÕES DE MASSA ---
interface BulkActionsProps {
  selectedCount: number
  onAction: (type: 'approve' | 'deactivate' | 'delete') => void
  disabled?: boolean
}

export function BulkActionsBar({ selectedCount, onAction, disabled }: BulkActionsProps) {
  if (selectedCount < 2) return null // Lógica len(s) >= 2

  return (
    <div className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
      <Button 
        size="sm" variant="outline" className="text-green-600 border-green-200 bg-green-50"
        onClick={() => onAction('approve')} disabled={disabled}
      >
        <CheckCheck className="mr-2 h-4 w-4" /> Aprovar
      </Button>
      <Button 
        size="sm" variant="outline" className="text-orange-600 border-orange-200 bg-orange-50"
        onClick={() => onAction('deactivate')} disabled={disabled}
      >
        <History className="mr-2 h-4 w-4" /> Inativar
      </Button>
      <Button 
        size="sm" variant="outline" className="text-red-600 border-red-200 bg-red-50"
        onClick={() => onAction('delete')} disabled={disabled}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Excluir
      </Button>
    </div>
  )
}

// --- MENU INDIVIDUAL (Conversão do body-cell-acoes) ---
interface UserActionMenuProps {
  user: any
  onToggleStatus: (id: string, current: boolean) => void
  onDelete: (id: string) => void
}

export function UserActionMenu({ user, onToggleStatus, onDelete }: UserActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onToggleStatus(user.id_auth, user.aprovado)}>
          {user.aprovado ? (
            <div className="flex items-center text-orange-600">
              <History className="mr-2 h-4 w-4" /> Inativar
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCheck className="mr-2 h-4 w-4" /> Aprovar
            </div>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onDelete(user.id_auth)}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}