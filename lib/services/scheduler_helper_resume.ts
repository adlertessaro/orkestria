// app/api/cron/sync-trello/route.ts
import { NextResponse } from "next/server"
import { trelloSyncEngine } from "@/lib/trello_service"
import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function GET(request: Request) {
  // Verificação de segurança: Só permite se o Header de autorização bater
  // Isso evita que curiosos fiquem rodando sua sync toda hora
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Não autorizado, amigão!', { status: 401 })
  }

  try {
    const count = await trelloSyncEngine()
    
    // Logamos o sucesso no seu banco de telemetria
    await supabaseAdmin.from("trello_helper_sync_logs").insert({
      service_name: "Trello-Automated",
      status: "Sucesso",
      items_processed: count
    })

    return NextResponse.json({ success: true, processed: count })
  } catch (error: any) {
    // Logamos o erro para você saber por que a "máquina" parou
    await supabaseAdmin.from("trello_helper_sync_logs").insert({
      service_name: "Trello-Automated",
      status: "Erro",
      error_message: error.message
    })
    
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}