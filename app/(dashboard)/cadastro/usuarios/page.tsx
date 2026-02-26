"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { BulkActionsBar, UserActionMenu } from "./UserActions"
import { UserCreateModal } from "./UserCreateModal"
import { getUsers, toggleUserStatus, bulkAction, deleteUserAction } from "./actions"

export default function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* HEADER: Ações em Massa e Novo Usuário */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Gestão de Usuários</h1>
          
          <BulkActionsBar 
            selectedCount={selectedIds.length} 
            onAction={async (type) => {
              setIsProcessing(true)
              await bulkAction(selectedIds, type)
              setSelectedIds([])
              await loadData()
              setIsProcessing(false)
              toast.success("Ação em massa concluída!")
            }}
            disabled={isProcessing}
          />
        </div>

        {/* BOTÃO NOVO USUÁRIO (Agora funcionando com Modal) */}
        <UserCreateModal onSuccess={loadData} />
      </div>

      {/* TABELA */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="p-4 w-12 text-center">
                <Checkbox 
                  checked={selectedIds.length === users.length && users.length > 0} 
                  onCheckedChange={(c) => setSelectedIds(c ? users.map(u => u.id_auth) : [])} 
                />
              </th>
              <th className="p-4 text-left font-semibold">Username</th>
              <th className="p-4 text-center font-semibold">Status</th>
              <th className="p-4 text-center font-semibold">E-mail</th>
              <th className="p-4 text-center font-semibold">Permissão</th>
              <th className="p-4 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : users.map(user => (
              <tr key={user.id_auth} className="hover:bg-muted/30 transition-colors">
                <td className="p-4 text-center">
                  <Checkbox 
                    checked={selectedIds.includes(user.id_auth)}
                    onCheckedChange={(c) => setSelectedIds(prev => c ? [...prev, user.id_auth] : prev.filter(i => i !== user.id_auth))}
                  />
                </td>
                <td className="p-4 font-medium text-foreground">{user.username}</td>
                <td className="p-4 text-center">
                  <Badge variant="secondary" className={user.aprovado ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50"}>
                    {user.aprovado ? "Ativo" : "Pendente"}
                  </Badge>
                </td>
                <td className="p-4 text-center">{user.email_real}</td>
                <td className="p-4 text-center">{user.role}</td>
                <td className="p-4 text-right">
                  <UserActionMenu 
                    user={user} 
                    onToggleStatus={(id, cur) => toggleUserStatus(id, cur).then(loadData)}
                    onDelete={(id) => {
                      if(confirm("Deletar usuário?")) deleteUserAction(id).then(loadData)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}