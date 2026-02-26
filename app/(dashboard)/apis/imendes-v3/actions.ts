"use server"

const BASE_URL = process.env.IMENDES_BASE_URL;
const LOGIN = process.env.IMENDES_LOGIN;
const PASS = process.env.IMENDES_PASS;

export async function consultarTributosImendes(formData: FormData) {
  const cnpjEmit = (formData.get("cnpj_emit") as string).replace(/\D/g, "");
  const ufEmit = (formData.get("uf_emit") as string).toUpperCase();
  const regime = formData.get("regime") as string || "LR";
  const gtin = formData.get("gtin") as string || "08710103984801";
  const ufDest = (formData.get("uf_dest") as string || "GO").split(",").map(u => u.trim().toUpperCase());
  const cfop = formData.get("cfop") as string || "2102";

  // Montagem do Payload idêntica ao Python
  const payload = {
    emit: {
      cnpj: cnpjEmit,
      uf: ufEmit,
      cnae: "",
      crt: 3,
      regimeTrib: regime,
      substICMS: "N",
      amb: 2
    },
    perfil: {
      Uf: ufDest,
      cfop: cfop,
      caracTrib: [1],
      finalidade: 0,
      simplesN: "N",
      substICMS: "S",
      origem: "0"
    },
    produtos: [{
      codigo: gtin,
      descricao: "",
      codInterno: "N"
    }]
  };

  try {
    const response = await fetch(`${BASE_URL}/SaneamentoGrades`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "login": LOGIN!,
        "senha": PASS!
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Erro API Imendes: ${response.status}`);
    
    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}