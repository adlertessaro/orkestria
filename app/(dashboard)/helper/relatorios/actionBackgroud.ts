"use server"

import { sincronizarTrelloAction } from "./actions"

export async function dispararSincronizacaoBackground() {
  // Não await — dispara e retorna imediatamente
  sincronizarTrelloAction({})
  return { ok: true }
}
