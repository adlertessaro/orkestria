// import { sincronizarTrelloAction } from "@/app/(dashboard)/helper/relatorios/actions";
// import { NextResponse } from "next/server";

// export const dynamic = 'force-dynamic'; // Garante que a rota não seja cacheada

// export async function GET(request: Request) {
//   // Opcional: Validação de segurança simples via Token no Header
//   const { searchParams } = new URL(request.url);
//   const authHeader = request.headers.get('authorization');
  
//   // Se quiser proteger a rota, verifique um CRON_SECRET no seu .env
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//     return new NextResponse('Não autorizado', { status: 401 });
//   }

//   try {
//     console.log("⏰ Cron Job: Iniciando sincronização automática...");
    
//     // Dispara o fluxo completo: Trello -> Banco -> IA -> Trello
//     await sincronizarTrelloAction({});
    
//     return NextResponse.json({ success: true, message: "Fluxo concluído" });
//   } catch (error: any) {
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
//   }
// }