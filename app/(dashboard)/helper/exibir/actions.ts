"use server"

import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function getCardsPaginados(page: number, search: string = "", statusFilters: string[] = []) {
  const pageSize = 25
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabaseAdmin
    .from("trello_cards")
    .select(`
      *,
      membros:trello_card_members(name_member)
    `, { count: 'exact' })

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (statusFilters.length > 0 && !statusFilters.includes("todos")) {
    query = query.in("status", statusFilters)
  }

  const { data, count, error } = await query
    .order("ultima_atualizacao", { ascending: false })
    .order("id_trello", { ascending: true })
    .range(from, to)

  if (error) throw error
    return { cards: data || [], hasMore: count ? (to < count - 1) : false, totalCount: count || 0 }
  }

/**
 * BUSCA DETALHES DO BANCO (Membros e Comentários)
 */
export async function getCardDetailsFromDB(cardId: string) {
  // 1. Busca nomes dos membros na tabela trello_card_members
  const { data: members } = await supabaseAdmin
    .from("trello_card_members")
    .select("name_member")
    .eq("id_card", cardId)

  // 2. Busca comentários fazendo join com trello_members para pegar o full_name
  const { data: comments, error } = await supabaseAdmin
    .from("trello_comments")
    .select(`
      comment_text, 
      date_created,
      trello_members:id_member (
        full_name
      )
    `)
    .eq("id_card", cardId)
    .order("date_created", { ascending: false })

  if (error) console.error("Erro Supabase Join:", error)

  return {
    members: members?.map(m => m.name_member).join(", ") || "Nenhum",
    // Normalizamos o retorno para garantir que o front-end consiga ler
    comments: comments?.map((c: any) => ({
      text: c.comment_text,
      date: c.date_created,
      author: c.trello_members?.full_name || "Membro"
    })) || []
  }
}