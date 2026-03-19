"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function buscarAgentes() {
  const { data, error } = await supabaseAdmin
    .from("agentes")
    .select("id, slug, nome, utilidade, prompt_sistema, llm_provider, llm_model, temperature, ativo")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("❌ Erro ao buscar agentes:", error.message)
    return []
  }

  return data
}

export async function atualizarAgente(id: string, payload: {
  slug?: string
  nome?: string
  utilidade?: string
  prompt_sistema?: string
  llm_provider?: string
  llm_model?: string
  temperature?: number
  ativo?: boolean
}) {
  const { error } = await supabaseAdmin
    .from("agentes")
    .update(payload)
    .eq("id", id)

  if (error) {
    console.error("❌ Erro ao atualizar agente:", error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
}
