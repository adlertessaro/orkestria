import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Apenas repassa a bola para o seu controle de sessão
  return await updateSession(request)
}

export const config = {
  matcher: [
    // O portão principal ignora rotas de API e arquivos estáticos
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|riv)$).*)',
  ],
}