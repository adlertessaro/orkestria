import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function agenteColetor(): Promise<string[]> {
  console.log("🔍 [Coletor] Buscando demandas não processadas...")

  const { data: issues } = await supabaseAdmin
    .from("jira_issues")
    .select("issue_key, resumo, description")
    .eq("coletado", false)
    .not("description", "is", null)

  if (!issues || issues.length === 0) {
    console.log("✅ [Coletor] Nenhuma demanda nova.")
    return []
  }

  // Marca como coletadas na jira_issues ANTES de inserir
  const issueKeys = issues.map(i => i.issue_key);
  await supabaseAdmin
    .from("jira_issues")
    .update({ coletado: true })
    .in("issue_key", issueKeys);

  let inseridas = 0;
  for (const issue of issues) {
    try {
      await supabaseAdmin
        .from("jira_issues_agente_demandas")
        .upsert(
          { 
            id_issue: issue.issue_key, 
            titulo: issue.resumo, 
            descricao: issue.description, 
            processado: false
          },  // ← Remove coletado_em (não existe mais)
          { onConflict: "id_issue", ignoreDuplicates: true }
        );
      inseridas++;  // Assume sucesso com ignoreDuplicates
    } catch (err: any) {
      console.error(`❌ [Coletor] Erro ao inserir ${issue.issue_key}:`, err.message)
    }
  }

  console.log(`✅ [Coletor] ${inseridas} demandas inseridas (de ${issues.length} encontradas)`)
  return issues.slice(0, inseridas).map(issue => issue.issue_key)
}
