import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Quem é o usuário?
  // Usamos getUser() por segurança máxima, validando o token direto no banco.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // 3. LÓGICA DE REDIRECIONAMENTO (O "Guarda")
  
  // REGRA A: Se não está logado e tenta entrar no sistema (ex: dashboard ou cadastro de usuários)
  if (
      !user && 
      !url.pathname.startsWith('/login') && 
      !url.pathname.startsWith('/auth') &&
      !url.pathname.startsWith('/api')
    ) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

  return supabaseResponse
}