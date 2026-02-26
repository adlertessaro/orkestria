"use server"

const BASE_URL = process.env.HOS_V2_BASE_URL
const API_KEY = process.env.HOS_V2_API_KEY

async function hosFetch(endpoint: string, method: string, body?: any, params?: Record<string, string>) {
  try {
    const url = new URL(`${BASE_URL}${endpoint}`)
    if (params) Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY! //
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()
    if (!response.ok) return { success: false, error: data.message || `Erro ${response.status}` }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: "Falha de comunicação com o servidor HOS." }
  }
}

export async function buscarEmpresa(cnpj: string) {
  const limpo = cnpj.replace(/\D/g, "") // Limpeza de CNPJ
  return hosFetch("/empresa", "GET", undefined, { cnpj: limpo })
}

export async function cadastrarEmpresa(formData: FormData) {
  const payload = {
    cnpj: (formData.get("cnpj") as string).replace(/\D/g, ""),
    razaoSocial: formData.get("razaoSocial"), // API usa CamelCase no envio
    fantasia: formData.get("fantasia"),
    cnpjEcommerce: (formData.get("cnpjEcommerce") as string).replace(/\D/g, ""),
  }
  return hosFetch("/empresa", "POST", payload)
}

export async function editarEmpresa(formData: FormData) {
  const payload = {
    cnpj: (formData.get("cnpj") as string).replace(/\D/g, ""),
    razaoSocial: formData.get("razaoSocial"),
    fantasia: formData.get("fantasia"),
    cnpjEcommerce: (formData.get("cnpjEcommerce") as string).replace(/\D/g, ""),
    chaveAcesso: formData.get("chaveAcesso"),
  }
  return hosFetch("/empresa", "PATCH", payload)
}