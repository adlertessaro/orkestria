import { executarAnaliseManual, verificarBloqueio, type EtapaLog } from "@/app/(dashboard)/analises-avancadas/nova-analise/pipeline_analise_manual"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutos

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const issueKey = searchParams.get("issueKey")

  if (!issueKey) {
    return new Response("issueKey é obrigatório", { status: 400 })
  }

  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array>
  let streamClosed = false

  const send = (data: object) => {
    if (streamClosed) return
    try {
      streamController?.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      // controller já fechado
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      streamController = ctrl

      // ── Verifica bloqueio ANTES de tudo ─────────────────────────────────
      const bloqueio = await verificarBloqueio(issueKey)
      if (bloqueio.bloqueado) {
        send({ type: "blocked", message: bloqueio.motivo, status: bloqueio.status })
        send({ type: "done" })
        streamClosed = true
        try { ctrl.close() } catch { /* já fechado */ }
        return
      }

      // ── Intercepta console para repassar como logs SSE ───────────────────
      const origLog = console.log
      const origError = console.error
      const origWarn = console.warn

      const makeConsole = (level: "info" | "error" | "warn") =>
        (...args: any[]) => {
          const message = args
            .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
            .join(" ")
          if (level === "info") origLog(...args)
          else if (level === "error") origError(...args)
          else origWarn(...args)
          send({ type: "log", message, level })
        }

      console.log = makeConsole("info")
      console.error = makeConsole("error")
      console.warn = makeConsole("warn")

      try {
        const onEtapa = (etapa: EtapaLog) => {
          send({ type: "etapa", etapa })
        }

        const resultado = await executarAnaliseManual(issueKey, onEtapa)
        send({ type: "result", data: resultado })

      } catch (err: any) {
        send({ type: "error", message: err.message || "Erro desconhecido na análise" })
      } finally {
        console.log = origLog
        console.error = origError
        console.warn = origWarn

        send({ type: "done" })
        streamClosed = true
        try { ctrl.close() } catch { /* já fechado */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}