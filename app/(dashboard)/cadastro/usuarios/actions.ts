"use server"

import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/supabase"
import { revalidatePath } from "next/cache"

// 1. Listar todos os usuários
export async function getUsers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .order('username')
  
  if (error) throw new Error(error.message)
  return data
}

// 2. Atualizar Status
export async function toggleUserStatus(id: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('perfis')
    .update({ aprovado: !currentStatus })
    .eq('id_auth', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

// 3. Excluir Usuário
export async function deleteUserAction(id: string) {
  const supabase = await createClient()
  // No Next.js, para deletar no Auth, você precisará usar o cliente Admin (Service Role)
  const { error } = await supabase.from('perfis').delete().eq('id_auth', id)
  
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

// 4. Ação em Massa
export async function bulkAction(ids: string[], type: 'approve' | 'deactivate' | 'delete') {
  const supabase = await createClient()
  
  if (type === 'delete') {
    await supabase.from('perfis').delete().in('id_auth', ids)
  } else {
    const isApprove = type === 'approve'
    await supabase.from('perfis').update({ aprovado: isApprove }).in('id_auth', ids)
  }
  
  revalidatePath('/admin/users')
}

export async function createUserAction(formData: FormData) {
  const username = formData.get("username") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    // 1. Criar no Auth (Ignora confirmação de e-mail)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username }
    })

    if (authError) return { success: false, error: authError.message }

    // 2. Inserir na tabela de perfis
    const { error: profileError } = await supabaseAdmin.from("perfis").insert({
      id_auth: authData.user.id,
      username,
      email_real: email,
      aprovado: true, // Já nasce aprovado como no Python
      role: "user"
    })

    if (profileError) return { success: false, error: profileError.message }

    revalidatePath("/admin/users")
    return { success: true }
  } catch (err) {
    return { success: false, error: "Erro interno no servidor." }
  }
}