import oracledb from "oracledb";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { config } from "dotenv";

config({ path: ".env.local" });

oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchAsBuffer = [oracledb.BLOB];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── CONEXÃO ORACLE ───────────────────────────────────────────────────────────

let conn: oracledb.Connection | null = null;

async function getConn(): Promise<oracledb.Connection> {
  if (conn) {
    try {
      await conn.ping();
      return conn;
    } catch {
      conn = null;
    }
  }
  conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.ORACLE_HOST})(PORT=${process.env.ORACLE_PORT}))(CONNECT_DATA=(SERVICE_NAME=${process.env.ORACLE_SERVICE_NAME})))`,
  });
  console.log("✅ Conexão Oracle (re)aberta.");
  return conn;
}

async function closeConnection(): Promise<void> {
  if (conn) {
    await conn.close();
    conn = null;
    console.log("🔌 Conexão Oracle fechada.");
  }
}

// ─── AUXÍLIOS ─────────────────────────────────────────────────────────────────

async function decodeConteudo(encoded: string | oracledb.Lob): Promise<any[]> {
  const raw = typeof encoded === "string" ? encoded : String(encoded);
  const decoded = Buffer.from(raw, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

function processarConteudo(jsonData: any[]): string {
  const partes: string[] = [];
  for (const item of jsonData) {
    const tipo: string = item.tipo;
    const conteudo: string = item.conteudo ?? "";
    if (["TEXTO", "SUBTITULO", "CARD_TITULO", "CARD"].includes(tipo)) {
      const $ = cheerio.load(conteudo);
      partes.push($.text());
    } else if (tipo === "VIDEO") {
      partes.push(` linkVideo: ${conteudo}`);
    }
  }
  return partes.join("");
}

async function gerarLink(nivelAcessoId: number, paginaId: number): Promise<string> {
  const linktype = [3, 4].includes(nivelAcessoId) ? 1 : 2;
  const c = await getConn();
  const result = await c.execute<string>(
    `BEGIN :result := ERP.BD_LINK_REDIRECIONAMENTO.GERAR_LINK_REDIRECIONAMENTO(:p1,:p2,:p3,:p4,:p5); END;`,
    {
      result: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
      p1: linktype,
      p2: "220",
      p3: 12,
      p4: "P12_PAGINA_MOSTRAR",
      p5: String(paginaId),
    }
  );
  return (result.outBinds as any).result ?? "";
}

async function gerarEmbedding(titulo: string, conteudo: string): Promise<number[]> {
  const input = `${titulo}\n\n${conteudo}`.replace(/\n/g, " ").slice(0, 8000);
  const result = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
    encoding_format: "float",
  });
  return result.data[0].embedding;
}

async function marcarSincronizado(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const c = await getConn();
  await c.execute(
    `UPDATE ERP.BASE_CONHECIMENTO_FILA_ANALISE a
     SET a.SINCRONIZADO = 1
     WHERE a.PAGINA_BASE_ID IN (${ids.join(",")}) AND a.SINCRONIZADO = 0`
  );
  await c.commit();
  console.log(`   ✅ ${ids.length} registro(s) marcado(s) como sincronizado no Oracle.`);
}

// ─── BUSCA ORACLE ─────────────────────────────────────────────────────────────

async function buscarDocumentos() {
  const c = await getConn();
  const result = await c.execute<any[]>(
    `SELECT
       PB.PAGINA_BASE_ID,
       PB.TITULO,
       PB.JSON_CONTEUDO,
       PB.BASE_ENTRADA_MENU_ID,
       PB.PAGINA_BASE_NIVEL_ACESSO_ID,
       PBN.DESCRICAO
     FROM ERP.PAGINA_BASE PB
     JOIN ERP.PAGINA_BASE_NIVEL_ACESSO PBN
       ON PB.PAGINA_BASE_NIVEL_ACESSO_ID = PBN.PAGINA_BASE_NIVEL_ACESSO_ID
     WHERE EXISTS (
       SELECT 1 FROM ERP.BASE_CONHECIMENTO_FILA_ANALISE a
       WHERE a.PAGINA_BASE_ID = PB.PAGINA_BASE_ID AND a.SINCRONIZADO = 0
     )`,
    [],
    { fetchArraySize: 100 }
  );
  return result.rows ?? [];
}

// ─── SALVA NO SUPABASE ────────────────────────────────────────────────────────

async function salvarNoSupabase(documento: {
  documento_id: number;
  menu_id: number;
  titulo: string;
  conteudo: string;
  nivel_acesso: string;
  url: string;
  sincronizado_em: string;
  embedding: number[];
}): Promise<void> {
  const { error } = await supabase
    .from("base_conhecimento")
    .upsert(documento, { onConflict: "documento_id" });
  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
}

// ─── EXECUÇÃO PRINCIPAL ───────────────────────────────────────────────────────

async function init(): Promise<void> {
  await getConn();

  try {
    const rows = await buscarDocumentos();

    if (rows.length === 0) {
      console.log("✅ Nenhum documento pendente.");
      return;
    }

    console.log(`📋 ${rows.length} documento(s) encontrado(s). Processando...\n`);

    const idsSincronizados: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const [paginaId, titulo, jsonConteudo, menuId, nivelAcessoId, nivelAcessoDesc] = row;

      console.log(`[${i + 1}/${rows.length}] 🔄 #${paginaId} ${titulo}`);

      try {
        const jsonData = await decodeConteudo(jsonConteudo);
        const conteudo = processarConteudo(jsonData);
        const url = await gerarLink(nivelAcessoId, paginaId);
        const embedding = await gerarEmbedding(titulo, conteudo);

        await salvarNoSupabase({
          documento_id: paginaId,
          menu_id: menuId,
          titulo,
          conteudo,
          nivel_acesso: nivelAcessoDesc,
          url,
          sincronizado_em: new Date().toISOString(),
          embedding,
        });

        idsSincronizados.push(paginaId);
        console.log(`   ✅ Salvo no Supabase com embedding.`);
      } catch (err) {
        console.error(`   ❌ Erro no documento #${paginaId}: ${err}`);
      }
    }

    await marcarSincronizado(idsSincronizados);

  } finally {
    await closeConnection();
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

export async function sincronizarManuais(): Promise<void> {
  console.log(`\n🚀 Iniciando sincronização de manuais — ${new Date().toLocaleString("pt-BR")}`);
  try {
    await init();
  } catch (err) {
    console.error(`❌ Erro geral: ${err}`);
    throw err;
  }
}

export async function schedulerManuais(): Promise<void> {
  const intervaloMs = parseInt(process.env.TIME_SLEEP_SEC ?? "300") * 1000;
  while (true) {
    await sincronizarManuais();
    console.log(`⏳ Aguardando ${intervaloMs / 1000}s para próxima execução...`);
    await new Promise((resolve) => setTimeout(resolve, intervaloMs));
  }
}
