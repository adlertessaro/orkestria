"use client"

import * as React from "react"
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiveAvatar } from "./RiveAvatar"
import { loginAction } from "@/app/login/actions"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const router = useRouter() 
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [authStatus, setAuthStatus] = React.useState<"success" | "fail" | null>(null)
  const [message, setMessage] = React.useState<{ type: "success" | "error", text: string } | null>(null)
  
  const [robotState, setRobotState] = React.useState({
    isChecking: false,
    lookValue: 0
  })

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.length
    setRobotState(prev => ({ ...prev, lookValue: Math.min(value * 2.5, 100) }))
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setAuthStatus(null)

    const formData = new FormData(e.currentTarget)
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000))
      const loginPromise = loginAction(formData)
      const result = await Promise.race([loginPromise, timeoutPromise]) as { success: boolean, error?: string }

    setIsLoading(false)

    if (!result.success) {
      //Setamos o erro e o Teddy fica triste
      setAuthStatus("fail")
      setMessage({ type: "error", text: result.error || "Falha ao autenticar. Tente novamente." })
    } else {
      // Teddy comemora e depois de 2s mudamos de página
      setAuthStatus("success")
      setMessage({ type: "success", text: "Bem-vindo de volta!" })
      setTimeout(() => router.push("/"), 2000)
    }
  } catch (err) {
    setIsLoading(false)
    setAuthStatus("fail")
    setMessage({ type: "error", text: err instanceof Error && err.message === "Timeout" ? "O servidor demorou a responder. Verifique sua conexão." : "Erro inesperado. Tente novamente." })
  }
  }
  return (
    <div className="w-full max-w-md space-y-4 bg-white p-8 rounded-xl shadow-lg border border-zinc-200">
      <RiveAvatar 
        isChecking={robotState.isChecking}
        isHandsUp={showPassword} // Teddy tapa os olhos direto ao clicar no botão
        lookValue={robotState.lookValue}
        state={authStatus} // Sincronizado com o resultado do login
      />

      {/* Banner de Mensagem - Aparecerá agora sem ser apagado pelo router */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium border animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold text-zinc-900">Orkestria OS</h2>
        <p className="text-sm text-zinc-500">Inicie os sistemas de controlo</p>
      </div>

      <form className="space-y-4 pt-4" onSubmit={handleLogin}>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <Input 
            name="email"
            type="email" 
            placeholder="E-mail corporativo" 
            className="pl-10"
            onFocus={() => setRobotState(prev => ({ ...prev, isChecking: true }))}
            onBlur={() => setRobotState(prev => ({ ...prev, isChecking: false }))}
            onChange={handleEmailChange}
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <Input 
            name="password"
            type={showPassword ? "text" : "password"} 
            placeholder="Senha de acesso" 
            className="pl-10 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button 
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-500" 
          disabled={isLoading}
        >
          {isLoading ? "A validar..." : "Entrar no Dashboard"}
          {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}