import os
import re
import json
import time
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI
from groq import Groq

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../.env.local"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["NEXT_PUBLIC_SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
GROQ_API_KEY = os.environ["AGENT_AUTH_HELPER_GROQ"]

EMBEDDING_MODEL = "text-embedding-3-small"
GROQ_MODELS = [
    "llama-3.3-70b-versatile",              # melhor qualidade
    "meta-llama/llama-4-scout-17b-16e-instruct",  # fallback 1 — Llama 4
    "qwen/qwen3-32b",                       # fallback 2
    "gemma2-9b-it",                         # fallback 3
    "llama-3.1-8b-instant",                 # fallback 4 (último recurso)
]

CATEGORIAS = [
    "Financeiro - Contas a Pagar",
    "Financeiro - Contas a Receber",
    "Financeiro - Conciliação Bancária",
    "Financeiro - Fluxo de Caixa",
    "Financeiro - Transferência entre Contas",
    "Financeiro - Baixa de Títulos",
    "Financeiro - Renegociação de Dívida",
    "Financeiro - Crediário",
    "Financeiro - Limite de Crédito",
    "Financeiro - Comissão",
    "Financeiro - Fechamento de Caixa",
    "Financeiro - Sangria / Suprimento",
    "Financeiro - Relatórios Financeiros",
    "Fiscal - Emissão de NF-e",
    "Fiscal - Emissão de NFC-e",
    "Fiscal - Cancelamento de Nota",
    "Fiscal - Carta de Correção",
    "Fiscal - CFOP",
    "Fiscal - CST / Tributação",
    "Fiscal - ICMS / ST",
    "Fiscal - PIS / COFINS",
    "Fiscal - Geração de SPED",
    "Fiscal - SPED Fiscal",
    "Fiscal - SPED Contribuições",
    "Fiscal - Integração Contábil",
    "Fiscal - Sintegra",
    "Vendas - Frente de Caixa",
    "Vendas - Cancelamento de Venda",
    "Vendas - Devolução",
    "Vendas - Troca de Produto",
    "Vendas - Desconto",
    "Vendas - Promoções",
    "Vendas - Multiplos / Leve Pague",
    "Vendas - Farmácia Popular",
    "Vendas - Convênios",
    "Vendas - TEF",
    "Vendas - Cartão Crédito",
    "Vendas - Cartão Débito",
    "Vendas - PIX",
    "Vendas - Boleto",
    "Vendas - Relatórios de Vendas",
    "Estoque - Cadastro de Produto",
    "Estoque - Código de Barras",
    "Estoque - Controle de Lote",
    "Estoque - Validade",
    "Estoque - Inventário",
    "Estoque - Ajuste de Estoque",
    "Estoque - Transferência entre Filiais",
    "Estoque - Entrada de Mercadoria",
    "Estoque - Conferência de Nota",
    "Compras - Pedido de Compra",
    "Compras - Sugestão de Compra",
    "Compras - Cotação",
    "Compras - Recebimento de Mercadoria",
    "Compras - Bonificação de Fornecedor",
    "Compras - Crédito de Fornecedor",
    "Clientes - Cadastro",
    "Clientes - Limite de Crédito",
    "Clientes - Histórico de Compras",
    "Clientes - Análise de Crédito",
    "Clientes - Convênios",
    "Integração - API",
    "Integração - ERP",
    "Integração - E-commerce",
    "Integração - Ifood",
    "Integração - Scanntech",
    "Integração - PBM",
    "Integração - Contábil",
    "Integração - Marketplace",
    "Integração - iFood",
    "Integração - My Pharma",
    "Integração - Gestão",
    "Integração - Ecommerce",
    "Integração - Pharma Link",
    "Integração - Farmacias APP",
    "Integração - IQVIA",
    "Integração - MARKA",
    "Integração - SystemFarma",
    "Integração - Amplacard",
    "Integração - NAPP",
    "Integração - Agafarma",
    "Relatórios - Vendas",
    "Relatórios - Financeiro",
    "Relatórios - Fiscal",
    "Relatórios - Estoque",
    "Relatórios - Gerenciais",
    "Relatórios - Comissões",
    "Configuração - Parâmetros do Sistema",
    "Configuração - Permissões",
    "Configuração - Perfil de Usuário",
    "Configuração - Filiais",
    "Configuração - Integrações",
    "Bug / Correção",
    "Nova Funcionalidade",
    "Melhoria / Refatoração",
    "Documentação",
    "Infraestrutura / DevOps",
]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)


# ─── LIMPEZA ──────────────────────────────────────────────────────────────────

def normalizar_titulo(titulo: str) -> str:
    if not titulo:
        return ""

    if re.match(r'^an[aá]lise de ideia', titulo, re.IGNORECASE):
        partes = titulo.split(" - ")

        # Palavras que indicam que o segmento é metadado (tipo ou prioridade)
        METADADOS = {"melhoria", "bug", "nova funcionalidade", "importante", "crítico",
                     "urgente", "baixa", "média", "alta", "normal"}

        # Remove do final enquanto o último segmento for metadado conhecido
        while len(partes) > 3 and partes[-1].strip().lower() in METADADOS:
            partes.pop()

        # Agora pega tudo a partir do 3º segmento (índice 2)
        titulo = " - ".join(partes[2:]).strip()

    return titulo[0].upper() + titulo[1:]


def extrair_descricao(texto: str) -> str:
    if not texto:
        return ""
    # Prioridade 1: tudo após "Descrição:"
    match = re.search(r'Descri[çc][aã]o:[ \t]*\r?\n?([\s\S]+)', texto, re.IGNORECASE)
    if match:
        conteudo = match.group(1).strip()
        conteudo = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', conteudo)
        return conteudo
    # Prioridade 2: tudo após "Objetivo:"
    match = re.search(r'Objetivo:[ \t]*(.+)', texto, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Prioridade 3: remove linhas de metadados conhecidos
    METADADOS = re.compile(
        r'^(Uma nova solicitação|Criado em|Nº da Ideia|Prazo de retorno|'
        r'Tipo|Prioridade|Atribuição|Solicitado por|E-mail|Cliente|CRM|Produto)[:\s]',
        re.IGNORECASE
    )
    linhas_uteis = [l for l in texto.split("\n") if not METADADOS.match(l.strip())]
    return "\n".join(linhas_uteis).strip() or texto


def limpar_texto(texto: str) -> str:
    if not texto:
        return ""
    texto = re.sub(
        r'^(olá|oi|bom dia|boa tarde|boa noite|prezados?|att|atenciosamente|obrigad[oa]|grato|grata)[,.\s!]*',
        '', texto, flags=re.IGNORECASE | re.MULTILINE
    )
    texto = re.sub(r'^[-_*=]{3,}\s*$', '', texto, flags=re.MULTILINE)
    texto = re.sub(r'https?://\S+', '', texto)
    texto = re.sub(r'[\U00010000-\U0010FFFF]', '', texto)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    texto = "\n".join(line.strip() for line in texto.split("\n"))
    texto = re.sub(r' {2,}', ' ', texto)
    return texto.strip()


def preparar_texto(titulo: str, descricao: str) -> tuple[str, str, str]:
    """Retorna (titulo_limpo, descricao_limpa, texto_completo)."""
    titulo_limpo = normalizar_titulo(limpar_texto(titulo))
    descricao_limpa = limpar_texto(extrair_descricao(descricao))
    texto_completo = f"{titulo_limpo}\n{descricao_limpa}".strip()
    return titulo_limpo, descricao_limpa, texto_completo


# ─── EMBEDDING ────────────────────────────────────────────────────────────────

def gerar_embedding(texto: str) -> list[float]:
    response = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=texto)
    return response.data[0].embedding


def salvar_embedding(id_issue: str, embedding: list[float]) -> bool:
    """Upsert na jira_issues_embeddings. Respeita no_update=true."""
    existing = (
        supabase.table("jira_issues_embeddings")
        .select("id, no_update")
        .eq("id_issue", id_issue)
        .execute()
    )
    if existing.data:
        if existing.data[0].get("no_update") is True:
            print("bloqueado (no_update=true)", end=" ")
            return False
        supabase.table("jira_issues_embeddings").update(
            {"embedding": embedding}
        ).eq("id_issue", id_issue).execute()
    else:
        supabase.table("jira_issues_embeddings").insert(
            {"id_issue": id_issue, "embedding": embedding}
        ).execute()
    return True


# ─── CLASSIFICAÇÃO ────────────────────────────────────────────────────────────

def classificar(titulo: str, descricao: str) -> tuple[str, str]:
    categorias_str = "\n".join(f"- {c}" for c in CATEGORIAS)

    system_prompt = """Você é um classificador especialista em sistemas ERP para farmácias e varejo.
Sua única função é classificar issues de suporte técnico em categorias pré-definidas.
Você NUNCA explica, NUNCA comenta, NUNCA pede mais informações.
Responda SOMENTE com o JSON solicitado."""

    user_prompt = f"""Classifique a issue abaixo escolhendo EXATAMENTE UMA categoria da lista.

REGRAS:
1. Use APENAS categorias da lista fornecida
2. Se a issue menciona um módulo específico (ex: NF-e, PIX, My Pharma), prefira a categoria desse módulo
3. Use "Bug / Correção" apenas se não se encaixar em nenhuma categoria de módulo
4. Responda SOMENTE com JSON válido, sem texto adicional

LISTA DE CATEGORIAS:
{categorias_str}

ISSUE:
Título: {titulo or "Sem título"}
Descrição: {descricao or "Sem descrição"}

RESPOSTA (JSON):
{{"categoria_completa": "<categoria exata da lista>"}}"""

    modelos_disponiveis = list(GROQ_MODELS) 

    while modelos_disponiveis:
        modelo_atual = modelos_disponiveis[0]
        try:
            response = groq_client.chat.completions.create(
                model=modelo_atual,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0,
                max_tokens=60,
                response_format={"type": "json_object"},
            )

            conteudo = response.choices[0].message.content.strip()
            if not conteudo:
                return "Bug / Correção", "Bug / Correção"

            try:
                resultado = json.loads(conteudo)
                categoria_completa = resultado.get("categoria_completa", "Bug / Correção")
            except json.JSONDecodeError:
                # Tenta extrair a categoria diretamente do texto se o JSON veio quebrado
                categoria_completa = "Bug / Correção"
                for c in CATEGORIAS:
                    if c.lower() in conteudo.lower():
                        categoria_completa = c
                        break

            if categoria_completa not in CATEGORIAS:
                for c in CATEGORIAS:
                    if c.lower() in categoria_completa.lower():
                        categoria_completa = c
                        break
                else:
                    categoria_completa = "Bug / Correção"

            if " - " in categoria_completa:
                categoria, subcategoria = categoria_completa.split(" - ", 1)
            else:
                categoria = categoria_completa
                subcategoria = categoria_completa

            return categoria, subcategoria

        except Exception as e:
            erro_str = str(e)
            if "rate_limit_exceeded" in erro_str or "model_decommissioned" in erro_str or "json_validate_failed" in erro_str:
                modelos_disponiveis.pop(0)
                if modelos_disponiveis:
                    print(f"\n   ⚠️  '{modelo_atual}' indisponível → trocando para '{modelos_disponiveis[0]}'...")
                else:
                    print(f"\n   ⏳ Todos os modelos indisponíveis. Aguardando 60s...")
                    time.sleep(60)
                    modelos_disponiveis = list(GROQ_MODELS)
                    print(f"   🔄 Reiniciando com '{modelos_disponiveis[0]}'...")
            else:
                raise


# ─── EXECUÇÃO EM MASSA ────────────────────────────────────────────────────────

def processar_em_massa():
    while True:
        print("🔍 Buscando issues não processadas...")

        # Busca processado=False OU processado=NULL
        result = (
            supabase.table("jira_issues_agente_demandas")
            .select("id, id_issue, titulo, descricao")
            .or_("processado.eq.false,processado.is.null")
            .execute()
        )

        issues = result.data
        total = len(issues)

        if total == 0:
            print("✅ Todas as issues foram processadas!")
            break

        print(f"📋 {total} issue(s) pendente(s). Processando...\n")

        for i, issue in enumerate(issues, 1):
            id_issue = issue["id_issue"]
            print(f"[{i}/{total}] {id_issue}", end=" → ")

            try:
                titulo_limpo, descricao_limpa, texto_completo = preparar_texto(
                    issue.get("titulo") or "",
                    issue.get("descricao") or ""
                )

                if not texto_completo:
                    print("⚠️  Sem conteúdo, pulando.")
                    # Marca como processado para não ficar em loop eterno
                    supabase.table("jira_issues_agente_demandas").update({
                        "processado": True,
                    }).eq("id", issue["id"]).execute()
                    continue

                embedding = gerar_embedding(texto_completo)
                categoria, subcategoria = classificar(titulo_limpo, descricao_limpa)

                salvar_embedding(id_issue, embedding)

                supabase.table("jira_issues_agente_demandas").update({
                    "titulo": titulo_limpo,
                    "descricao": descricao_limpa,
                    "categoria_embedding": categoria,
                    "subcategoria_embedding": subcategoria,
                    "processado": True,
                }).eq("id", issue["id"]).execute()

                print(f"✅ {categoria} / {subcategoria}")

            except Exception as e:
                # Loga o erro mas NUNCA para o script
                print(f"❌ Erro: {e}")
                continue

        print(f"\n🔁 Rodada concluída. Verificando se ainda há pendentes...\n")


processar_em_massa()