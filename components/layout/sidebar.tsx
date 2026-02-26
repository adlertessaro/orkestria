"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, Server, HelpCircle, LineChart,
  ChevronDown, ChevronLeft, ChevronRight, UserCog, Shield,
  Database, FileText, Activity, PieChart, BarChart3, Menu
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

// Tipagens mantidas
type SubMenuItem = { title: string; href: string; icon?: React.ReactNode }
type MenuItem = { title: string; href?: string; icon: React.ReactNode; submenu?: SubMenuItem[] }

const menuItems: MenuItem[] = [
  { title: "Dashboard", href: "/", icon: <LayoutDashboard className="w-5 h-5" /> },
  {
    title: "Cadastro",
    icon: <Users className="w-5 h-5" />,
    submenu: [
      { title: "Usuários", href: "/cadastro/usuarios", icon: <UserCog className="w-4 h-4" /> },
      { title: "Permissões", href: "/cadastro/permissoes", icon: <Shield className="w-4 h-4" /> },
    ],
  },
  {
    title: "APIs",
    icon: <Server className="w-5 h-5" />,
    submenu: [
      { title: "HOS Ecommerce - V2", href: "/apis/hos-ecommerce-v2", icon: <Database className="w-4 h-4" /> },
      { title: "Imendes - V3", href: "/apis/imendes-v3", icon: <Database className="w-4 h-4" /> },
      { title: "Éden - Trier", href: "/apis/eden-trier", icon: <Database className="w-4 h-4" /> },
    ],
  },
  {
    title: "Helper",
    icon: <HelpCircle className="w-5 h-5" />,
    submenu: [
      { title: "Exibir", href: "/helper/exibir", icon: <FileText className="w-4 h-4" /> },
      { title: "Relatórios", href: "/helper/relatorios", icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    title: "Análises Avançadas",
    icon: <LineChart className="w-5 h-5" />,
    submenu: [
      { title: "Agentes", href: "/analises-avancadas/agentes", icon: <Activity className="w-4 h-4" /> },
      { title: "Nova Análise", href: "/analises-avancadas/nova-analise", icon: <PieChart className="w-4 h-4" /> },
      { title: "Exibir Análises", href: "/analises-avancadas/exibir-analises", icon: <LineChart className="w-4 h-4" /> },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean // Controle mobile
  setIsOpen: (isOpen: boolean) => void
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  // 1. Persistência: Carrega do LocalStorage no montagem
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  // 2. Persistência: Salva sempre que mudar
  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState))
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-64" // Alternância de largura
        )}
      >
        {/* Header com Ícone de Recolher */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200">
          {!isCollapsed && <span className="text-xl font-bold text-zinc-900 ml-2">ORKESTRIA</span>}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleCollapse}
            className={cn("hidden lg:flex transition-all", isCollapsed && "mx-auto")}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        <div className="p-3 space-y-2 overflow-y-auto h-[calc(100vh-4rem)]">
          {menuItems.map((item, index) => {
            const isActive = item.href === pathname || item.submenu?.some(sub => sub.href === pathname)
            
            if (item.submenu) {
              return (
                <Collapsible key={index} defaultOpen={isActive} disabled={isCollapsed}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-all group",
                        isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                        isCollapsed ? "justify-center" : "justify-between"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        {!isCollapsed && <span className="animate-in fade-in duration-300">{item.title}</span>}
                      </div>
                      {!isCollapsed && (
                        <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  
                  {/* Submenu só aparece se não estiver colapsado OU se o usuário clicar (quando expandido) */}
                  {!isCollapsed && (
                    <CollapsibleContent className="px-3 py-1 space-y-1 animate-in slide-in-from-top-1">
                      {item.submenu.map((sub, subIndex) => (
                        <Link
                          key={subIndex}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                            pathname === sub.href ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500 hover:bg-zinc-50"
                          )}
                        >
                          {sub.icon}
                          <span>{sub.title}</span>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              )
            }

            return (
              <Link
                key={index}
                href={item.href!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all",
                  isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50",
                  isCollapsed ? "justify-center" : "pl-3"
                )}
              >
                {item.icon}
                {!isCollapsed && <span className="animate-in fade-in duration-300">{item.title}</span>}
              </Link>
            )
          })}
        </div>
      </aside>
    </>
  )
}