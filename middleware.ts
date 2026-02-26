import { type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // 1. Chama a lógica que você organizou na pasta lib
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Aplica o filtro em todas as rotas, EXCETO:
     * - api (rotas internas de dados)
     * - _next/static (arquivos do site)
     * - _next/image (imagens otimizadas)
     * - favicon.ico (ícone da aba)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|riv)$).*)',
  ],
}