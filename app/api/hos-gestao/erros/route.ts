import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabase"

export async function POST(request: Request) {
  try {
    // 1. O Porteiro checa o crachá
    const authHeader = request.headers.get("authorization")
    const chaveCorreta = process.env.API_KEY_GESTAO_HOSINTEGRADOR

    console.log("=== DEBUG DA FECHADURA ===")
    console.log("1. O que o Postman mandou: ", authHeader)
    console.log("2. O que o seu .env tem  : ", `Bearer ${chaveCorreta}`)
    console.log("==========================")

    // A integração deve enviar o cabeçalho assim: Authorization: Bearer SUA_CHAVE
    if (authHeader !== `Bearer ${chaveCorreta}`) {
      return NextResponse.json({ erro: "Acesso negado. Crachá inválido." }, { status: 401 })
    }

    // 2. O Porteiro pega o pacote
    const body = await request.json()

    // 3. Validação Básica: Não deixa entrar se faltar o essencial
    if (!body.guid_erro_origem || !body.cnpj || !body.erro_api) {
      return NextResponse.json(
        { erro: "Campos obrigatórios ausentes (guid_erro_origem, cnpj, erro_api)." }, 
        { status: 400 }
      )
    }

    // 4. Guarda tudo na tabela exata que criamos
    const { data, error } = await supabaseAdmin
      .from("api_gestao_erros")
      .insert([
        {
          guid_erro_origem: body.guid_erro_origem,
          crm: body.crm || null,
          cnpj: body.cnpj,
          razao_social: body.razao_social || null,
          fantasia: body.fantasia || null,
          uf: body.uf || null,
          erro_api: body.erro_api,
          data_hora_erro: body.data_hora_erro || new Date().toISOString(),
          payload_bruto: body // Guarda o objeto inteiro na nossa caixa preta JSONB
        }
      ])
      .select()

    // Se o banco reclamar (por exemplo, se mandarem um guid_erro_origem repetido)
    if (error) {
      console.error("Erro no Supabase:", error)
      
      // Se for o erro de duplicidade do Postgres (código 23505), avisamos com clareza
      if (error.code === '23505') {
        return NextResponse.json({ erro: "Este erro já foi registrado anteriormente." }, { status: 409 })
      }
      
      return NextResponse.json({ erro: "Falha ao gravar no banco de dados." }, { status: 500 })
    }

    // 5. Devolve o recibo de sucesso
    return NextResponse.json({ 
      mensagem: "Erro registrado com sucesso. Entrou na fila de processamento.", 
      id_registro: data[0].id 
    }, { status: 201 })

  } catch (error) {
    console.error("Erro catastrófico na API:", error)
    return NextResponse.json({ erro: "O pacote veio mal formatado." }, { status: 400 })
  }
}