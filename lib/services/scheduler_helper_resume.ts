// esse arquivo é apenas para rodar localemnte. Ele não é importado por nenhum outro lugar, então pode conter código de teste, cron jobs, ou o que for necessário para desenvolvimento local.
// Para rodar em deploy devemos inserir um cron no https://console.cron-job.org/ usando o arquivo pré fabricado app\(dashboard)\apis\cron\sync-trello\route.ts
import cron from 'node-cron';
import { sincronizarTrelloAction } from "@/app/(dashboard)/helper/relatorios/actions";

console.log("👷 Worker Local Iniciado...");

// '*/15 * * * *' significa: a cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
  console.log(`⏰ [${new Date().toLocaleTimeString()}] Iniciando ciclo automático...`);
  try {
    await sincronizarTrelloAction({});
    console.log("✅ Ciclo finalizado com sucesso.");
  } catch (err) {
    console.error("❌ Erro no ciclo automático:", err);
  }
});