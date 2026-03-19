"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, Server, HelpCircle, LineChart,
  ChevronDown, ChevronLeft, ChevronRight, UserCog, Shield,
  Database, FileText, Activity, PieChart, BarChart3, RefreshCw,
  Settings,
  DollarSign,
  Monitor
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

type SubMenuItem = {
  title: string
  href?: string
  icon?: React.ReactNode
  submenu?: SubMenuItem[]
}

type MenuItem = {
  title: string
  href?: string
  icon: React.ReactNode
  submenu?: SubMenuItem[]
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", href: "/", icon: <LayoutDashboard className="w-5 h-5" /> },

  {
    title: "Cadastros",
    icon: <Users className="w-5 h-5" />,
    submenu: [
      { title: "Usuários", href: "/cadastros/usuarios", icon: <UserCog className="w-4 h-4" /> },
      { title: "Agentes", href: "/cadastros/agentes", icon: <Activity className="w-4 h-4" /> },
    ],
  },

  {
    title: "Análises Avançadas",
    icon: <LineChart className="w-5 h-5" />,
    submenu: [
      
      { title: "Nova Análise", href: "/analises-avancadas/nova-analise", icon: <PieChart className="w-4 h-4" /> },
      { title: "Exibir Demandas", href: "/analises-avancadas/demandas/exibir-demandas", icon: <LineChart className="w-4 h-4" /> },
      { title: "Exibir Análises", href: "/analises-avancadas/exibir-analises", icon: <LineChart className="w-4 h-4" /> },
      // {
      //   title: "Demandas",
      //   icon: <BarChart3 className="w-4 h-4" />,
      //   submenu: [
      //     { title: "Relatórios", href: "/analises-avancadas/demandas/relatorios", icon: <RefreshCw className="w-4 h-4" /> },
      //   ],
      // },
    ],
  },

  {
    title: "Helper",
    icon: <HelpCircle className="w-5 h-5" />,
    submenu: [
      { title: "Exibir Helpers", href: "/helper/exibir", icon: <FileText className="w-4 h-4" /> },
      { title: "Relatórios", href: "/helper/relatorios", icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },

  {
    title: "APIs",
    icon: <Server className="w-5 h-5" />,
    submenu: [
      { 
          title: "HOS Gestão",
          icon: <DollarSign className="w-4 h-4" />,
          submenu: [
            { title: "Monitor de Problemas", href: "/apis/hos-gestao-v1", icon: <Monitor className="w-4 h-4" /> },
          ]
        },
      { title: "HOS Ecommerce - V2", href: "/apis/hos-ecommerce-v2", icon: <Database className="w-4 h-4" /> },
      { title: "Imendes - V3", href: "/apis/imendes-v3", icon: <Database className="w-4 h-4" /> },
      { title: "Éden - Trier", href: "/apis/eden-trier", icon: <Database className="w-4 h-4" /> },
    ],
  },

  {
    title: "Configurações",
    icon: <Settings className="w-5 h-5" />,
    submenu: [
      { title: "Geral", href: "/configuracoes/geral", icon: <Settings className="w-4 h-4" /> },
      { title: "Permissões", href: "/configuracoes/permissoes", icon: <Shield className="w-4 h-4" /> },
    ],
  }
  
]

// ─── Verifica se algum filho (em qualquer profundidade) está ativo ───
function hasActiveDescendant(items: SubMenuItem[], pathname: string): boolean {
  return items.some(
    item => item.href === pathname || (item.submenu ? hasActiveDescendant(item.submenu, pathname) : false)
  )
}

// ─── Renderiza submenus recursivamente em qualquer profundidade ───
function SubMenuItems({
  items,
  pathname,
  depth = 1,
}: {
  items: SubMenuItem[]
  pathname: string
  depth?: number
}) {
  return (
    <>
      {items.map((item, i) => {
        if (item.submenu) {
          const isActive = hasActiveDescendant(item.submenu, pathname)
          return (
            <Collapsible key={i} defaultOpen={isActive}>
              <CollapsibleTrigger asChild>
                <button
                  style={{ paddingLeft: `${depth * 16}px` }}
                  className={cn(
                    "flex items-center justify-between w-full pr-3 py-2 text-sm rounded-md transition-colors group",
                    isActive ? "text-zinc-900 font-semibold" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="animate-in slide-in-from-top-1">
                <SubMenuItems items={item.submenu} pathname={pathname} depth={depth + 1} />
              </CollapsibleContent>
            </Collapsible>
          )
        }

        if (!item.href) return null

        return (
          <Link
            key={i}
            href={item.href}
            style={{ paddingLeft: `${depth * 16}px` }}
            className={cn(
              "flex items-center gap-3 pr-3 py-2 text-sm rounded-md transition-colors",
              pathname === item.href
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            {item.icon}
            <span>{item.title}</span>
          </Link>
        )
      })}
    </>
  )
}

// ─── Props ───
interface SidebarProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

// ─── Sidebar principal ───
export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState))
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200">
          {!isCollapsed && (
            <span className="text-xl font-bold text-zinc-900 ml-2">ORKESTRIA</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className={cn("hidden lg:flex transition-all", isCollapsed && "mx-auto")}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        {/* Menu */}
        <div className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {menuItems.map((item, index) => {
            const isActive =
              item.href === pathname ||
              (item.submenu ? hasActiveDescendant(item.submenu, pathname) : false)

            if (item.submenu) {
              return (
                <Collapsible key={index} defaultOpen={isActive} disabled={isCollapsed}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-all group",
                        isActive
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                        isCollapsed ? "justify-center" : "justify-between"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        {!isCollapsed && (
                          <span className="animate-in fade-in duration-300">{item.title}</span>
                        )}
                      </div>
                      {!isCollapsed && (
                        <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      )}
                    </button>
                  </CollapsibleTrigger>

                  {!isCollapsed && (
                    <CollapsibleContent className="px-3 py-1 space-y-1 animate-in slide-in-from-top-1">
                      <SubMenuItems items={item.submenu} pathname={pathname} />
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
                {!isCollapsed && (
                  <span className="animate-in fade-in duration-300">{item.title}</span>
                )}
              </Link>
            )
          })}
        </div>
      </aside>
    </>
  )
}
