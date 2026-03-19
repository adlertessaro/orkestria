import { supabaseAdmin } from "@/lib/supabase/supabase";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ID_AGENTE = "ab3fe242-86f0-44cf-8fcc-296344bb5321"

export async function processarDecisaoAgente() {
  // 1. Buscar demandas pendentes
  const { data: demandas, error: errD } = await supabaseAdmin
    .from("trello_helper_agente_demandas")
    .select("*")
    .is("membro_escolhido", null)
    .eq("processado", false);

  if (errD) {
    console.error("Erro ao buscar demandas:", errD);
    return;
  }

  if (!demandas || demandas.length === 0) {
    console.log("Nenhuma demanda pendente encontrada.");
    return;
  }

  console.log(`Processando ${demandas.length} demanda(s)...`);

  // 2. Buscar membros com setor e habilidades
  const { data: membros, error: errM } = await supabaseAdmin
    .from("trello_helper_agentes_mapeamento_membros")
    .select("trello_member_id, nome_exibicao, setor, habilidades");

  if (errM || !membros || membros.length === 0) {
    console.error("Erro ao buscar membros:", errM?.message);
    return;
  }

  // 3. Buscar prompt e modelo do banco
  const { data: agenteData, error: errA } = await supabaseAdmin
    .from("agentes")
    .select("prompt_sistema, llm_model")
    .eq("id", ID_AGENTE)
    .single();

  if (errA || !agenteData?.prompt_sistema) {
    console.error("Erro ao buscar agente/prompt:", errA?.message);
    return;
  }

  const modelo = agenteData.llm_model || "gpt-4o-mini";
  console.log(`Modelo LLM: ${modelo}`);

  // Monta lista de membros formatada para o LLM — inclui setor explicitamente
  const membrosFormatados = membros.map(m =>
    `ID: ${m.trello_member_id}\nNome: ${m.nome_exibicao}\nSetor: ${m.setor}\nHabilidades: ${m.habilidades}`
  ).join("\n\n")

  for (const demanda of demandas) {
    try {
      const userPrompt = `MEMBROS DISPONÍVEIS:\n\n${membrosFormatados}\n\nDEMANDA:\nTítulo: ${demanda.titulo}\nDescrição: ${demanda.descricao}\n\nResponda APENAS com o trello_member_id exato do membro escolhido.`

      const completion = await openai.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: agenteData.prompt_sistema },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 100,
      });

      const idEscolhido = completion.choices[0].message.content?.trim();

      if (!idEscolhido) {
        console.error(`LLM retornou vazio para "${demanda.titulo}"`);
        continue;
      }

      // Valida se o ID retornado existe na lista de membros
      const membroValido = membros.find(m => m.trello_member_id === idEscolhido);
      if (!membroValido) {
        console.error(`LLM retornou ID invalido "${idEscolhido}" para "${demanda.titulo}" - pulando`);
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("trello_helper_agente_demandas")
        .update({
          membro_escolhido: idEscolhido,
          processado: true,
        })
        .eq("id", demanda.id);

      if (updateError) {
        console.error(`Erro ao atualizar demanda "${demanda.titulo}":`, updateError.message);
      } else {
        console.log(`OK: "${demanda.titulo}" -> ${membroValido.nome_exibicao} (${membroValido.setor})`);
      }

      await sleep(300);

    } catch (err: any) {
      console.error(`Erro ao processar "${demanda.titulo}":`, err.message);
    }
  }
}