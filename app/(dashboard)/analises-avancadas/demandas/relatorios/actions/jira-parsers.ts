export function extrairTextoADF(content: any[]): string {
  if (!content || !Array.isArray(content)) return ""
  return content.map(block => {
    if (block.type === "paragraph" || block.type === "heading") {
      return block.content?.map((c: any) => c.text || "").join("") || ""
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      return block.content?.map((item: any) =>
        "- " + (item.content?.map((p: any) =>
          p.content?.map((c: any) => c.text || "").join("")
        ).join("") || "")
      ).join("\n") || ""
    }
    if (block.type === "blockquote" || block.type === "panel") {
      return extrairTextoADF(block.content || [])
    }
    return ""
  }).filter(Boolean).join("\n")
}

export function extrairCampo(valor: any): string | null {
  if (!valor) return null
  if (typeof valor === "string") return valor
  if (typeof valor === "object" && valor.value) return valor.value
  if (typeof valor === "object" && valor.displayName) return valor.displayName
  if (Array.isArray(valor)) return valor.map((v: any) => v.value || v.name || v).join(", ")
  return String(valor)
}
