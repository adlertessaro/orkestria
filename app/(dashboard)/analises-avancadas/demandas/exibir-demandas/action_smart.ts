"use server"

import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PAGE_SIZE = 30

interface FiltrosSmart {
  status: string[]    
  clientes: string[]
  responsavel: string[]
  analista: string[]
  developer: string[]
  setor: string[]
}

export async function buscarIssuesSmart(
  query: string,
  page: number,
  filtros: FiltrosSmart
) {
  if (!query || query.trim().length <= 3) {
    return { issues: [], hasMore: false, total: 0 }
  }

  // 1. Gera embedding da query
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query.trim(),
  })
  const embedding = embeddingRes.data[0].embedding

  // 2. Chama a função SQL de busca vetorial
  const { data, error } = await supabase.rpc("match_issues", {
    query_embedding: embedding,
    match_threshold: 0.515,
    match_count: PAGE_SIZE + 1,
    p_offset: page * PAGE_SIZE,
    p_status:      filtros.status.length > 0      ? filtros.status      : null,
    p_clientes:    filtros.clientes.length > 0     ? filtros.clientes    : null,
    p_responsavel: filtros.responsavel.length > 0  ? filtros.responsavel : null,
    p_analista:    filtros.analista.length > 0     ? filtros.analista    : null,
    p_setor:       filtros.setor.length > 0        ? filtros.setor       : null,
  })

  if (error) throw new Error(`Erro na busca semântica: ${error.message}`)

  const results = data ?? []

  return {
    issues: results.slice(0, PAGE_SIZE),
    hasMore: results.length > PAGE_SIZE,
    total: results.length,  // estimativa — a função retorna até match_count
  }
}
