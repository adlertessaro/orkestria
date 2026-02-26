import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function trelloSyncEngine() {
  const TRELLO_API_KEY = process.env.TRELLO_API_KEY
  const TRELLO_TOKEN = process.env.TRELLO_TOKEN
  const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID

  let totalProcessed = 0
  
  // 1. Busca as listas para saber o nome das colunas
  const resListas = await fetch(
    `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  )
  const listas = await resListas.json()
  const mapaListas = Object.fromEntries(listas.map((l: any) => [l.id, l.name]))

  // 2. Busca os membros (importante para o vínculo de quem fez o quê)
  const resMembros = await fetch(
    `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  )
  const membrosBoard = await resMembros.json()
  for (const m of membrosBoard) {
    await supabaseAdmin.from("trello_members").upsert({
      id_trello: m.id,
      full_name: m.fullName,
      username: m.username
    }, { onConflict: 'id_trello' })
  }

  // 3. Pega a lista simplificada de cards
  const resCards = await fetch(
    `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  )
  const todosCards = await resCards.json()
  
  // 4. Processamento em lotes para não "fritar" o servidor
  for (let i = 0; i < todosCards.length; i += 100) {
    const lote = todosCards.slice(i, i + 100)
    
    const promessas = lote.map(async (c: any) => {
      const url = `https://api.trello.com/1/cards/${c.id}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&members=true&actions=commentCard`
      const detalheRes = await fetch(url)
      return detalheRes.ok ? detalheRes.json() : null
    })

    const cardsDetalhados = await Promise.all(promessas)

    for (const card of cardsDetalhados) {
      if (!card) continue

      // Atualiza ou insere o card
      await supabaseAdmin.from("trello_cards").upsert({
        id_trello: card.id,
        id_board: card.idBoard,
        title: card.name,
        status: mapaListas[card.idList] || "Desconhecida",
        last_sync: new Date().toISOString(),
        ultima_atualizacao: card.dateLastActivity,
        description: card.desc,
        created_at: new Date(parseInt(card.id.substring(0, 8), 16) * 1000).toISOString()
      }, { onConflict: 'id_trello' })

      totalProcessed++
    }
  }

  return totalProcessed
}