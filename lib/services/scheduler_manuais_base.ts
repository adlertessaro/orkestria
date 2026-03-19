// esse arquivo é apenas para rodar localemnte. Ele não é importado por nenhum outro lugar, então pode conter código de teste, cron jobs, ou o que for necessário para desenvolvimento local.
// Para rodar em deploy devemos inserir um cron no https://console.cron-job.org/ usando o arquivo pré fabricado app\(dashboard)\apis\cron\sync-trello\route.ts
import cron from 'node-cron';
import { sincronizarManuais } from '@/app/(dashboard)/base-conhecimento/action_search';

console.log("👷 Worker Local Iniciado...");

const MAX_TENTATIVAS = 3;
const DELAY_BASE_MS = 5000; // 5 segundos de espera inicial

function isErroConexao(err: unknown): boolean {
  const mensagem = err instanceof Error ? err.message : String(err);
  return (
    mensagem.includes("NJS-510") ||
    mensagem.includes("timed out") ||
    mensagem.includes("transportConnectTimeout") ||
    mensagem.includes("CONNECTION_ID")
  );
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarComRetry(): Promise<void> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      await sincronizarManuais();
      console.log("✅ Ciclo finalizado com sucesso.");
      return;
    } catch (err) {
      if (isErroConexao(err) && tentativa < MAX_TENTATIVAS) {
        const delayMs = DELAY_BASE_MS * Math.pow(2, tentativa - 1); // backoff exponencial: 5s, 10s, 20s...
        console.warn(
          `⚠️  Erro de conexão na tentativa ${tentativa}/${MAX_TENTATIVAS}. Tentando novamente em ${delayMs / 1000}s...`,
          err instanceof Error ? err.message : err
        );
        await esperar(delayMs);
      } else {
        if (isErroConexao(err)) {
          console.error(`❌ Erro de conexão após ${MAX_TENTATIVAS} tentativas. Abortando ciclo.`, err);
        } else {
          console.error("❌ Erro no ciclo automático (não é erro de conexão):", err);
        }
        return;
      }
    }
  }
}

// '*/15 * * * *' significa: a cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
  console.log(`⏰ [${new Date().toLocaleTimeString()}] Iniciando busca de manuais automática...`);
  await executarComRetry();
});