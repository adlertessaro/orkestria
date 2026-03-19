"use server"

import { sincronizarPaginaAction, sincronizarComentariosJiraAction } from "./actions"

export async function dispararSincronizacaoJiraBackground() {
  try {
    sincronizarPaginaAction().then(() => {
      sincronizarComentariosJiraAction()
    })
    return { success: true }
  } catch (error) {
    console.error("Erro ao disparar action:", error)
    return { success: false }
  }
}
