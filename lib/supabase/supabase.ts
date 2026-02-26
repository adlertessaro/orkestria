import { createClient } from '@supabase/supabase-js'

// 1. Verificação de Segurança (Norma ISO de "não adivinhar")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Erro Crítico: Chaves do banco de dados não encontradas no arquivo .env. O sistema não pode decolar!")
}

// Este cliente NUNCA deve ser usado em componentes que rodam no navegador!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})