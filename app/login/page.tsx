import { LoginForm } from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* LADO ESQUERDO: O Formulário (Ocupa 100% no mobile, ~40% no desktop) */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-[450px] xl:w-[550px] bg-zinc-50 border-r border-zinc-200">
        <div className="mx-auto w-full max-w-sm">
           {/* O nosso Robô e o Formulário moram aqui dentro */}
          <LoginForm />
        </div>
      </div>

      {/* LADO DIREITO: A Visão do Futuro (Só aparece em telas grandes) */}
      <div className="relative hidden flex-1 lg:block bg-zinc-900">
        {/* Camada de cor e brilho para o "Dashboard Colorido" */}
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/20 via-transparent to-green-600/20" />
        
        {/* Imagem de Fundo (Você pode trocar pela URL do seu dashboard) */}
        <div 
          className="h-full w-full bg-cover bg-center opacity-40 grayscale-[0.5] hover:grayscale-0 transition-all duration-700"
          style={{ backgroundImage: "url('https://foccoerp.com.br/wp-content/uploads/2017/04/sistema-de-gesto-empresarial-1.jpg')" }}
        />

        {/* Texto Visionário */}
        <div className="absolute bottom-12 left-12 z-20 max-w-lg">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Assuma a regência dos seus sistemas.
          </h1>
          <p className="text-zinc-400 text-lg">
            O Orkestria centraliza suas operações, APIs e análises em uma única melodia de dados.
          </p>
        </div>
      </div>
    </div>
  )
}