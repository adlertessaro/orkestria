'use server'

import { createClient } from '@/lib/supabase/server'
import router from 'next/router'

export async function loginAction(formData: FormData) {
try {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: "Email e senha são obrigatórios." }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: "Acesso negado. Credenciais inválidas." }
  }

  return { success: true }
} catch (err) {
  console.error("Erro no loginAction:", err)
  return { success: false, error: "Erro de conexão com o servidor. Verifique sua internet." }
}
}