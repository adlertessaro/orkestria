"use client"

import * as React from "react"
import {
  Users,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts"

const kpiData = [
  {
    title: "Usuários Ativos",
    value: "2.543",
    change: "+12.5%",
    trend: "up",
    icon: <Users className="w-5 h-5 text-blue-500" />,
  },
  {
    title: "Requisições API",
    value: "1.2M",
    change: "+5.2%",
    trend: "up",
    icon: <Server className="w-5 h-5 text-indigo-500" />,
  },
  {
    title: "Tempo de Resposta",
    value: "245ms",
    change: "-15ms",
    trend: "down",
    icon: <Clock className="w-5 h-5 text-emerald-500" />,
  },
  {
    title: "Taxa de Erro",
    value: "0.12%",
    change: "-0.05%",
    trend: "down",
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  },
]

const performanceData = [
  { name: "00:00", requests: 4000, errors: 24 },
  { name: "04:00", requests: 3000, errors: 13 },
  { name: "08:00", requests: 2000, errors: 98 },
  { name: "12:00", requests: 2780, errors: 39 },
  { name: "16:00", requests: 1890, errors: 48 },
  { name: "20:00", requests: 2390, errors: 38 },
  { name: "24:00", requests: 3490, errors: 43 },
]

const apiUsageData = [
  { name: "HOS V2", value: 400 },
  { name: "Imendes V3", value: 300 },
  { name: "Éden Trier", value: 300 },
  { name: "Outros", value: 200 },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard de Operações</h1>
        <p className="text-zinc-500">Visão geral dos indicadores de performance do sistema.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
          <div
            key={index}
            className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{kpi.title}</p>
              <div className="p-2 bg-zinc-50 rounded-lg">{kpi.icon}</div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold tracking-tight text-zinc-900">{kpi.value}</h3>
              <p className={`text-sm mt-1 ${
                kpi.trend === 'up' && kpi.title !== 'Taxa de Erro' ? 'text-emerald-600' : 
                kpi.trend === 'down' && (kpi.title === 'Taxa de Erro' || kpi.title === 'Tempo de Resposta') ? 'text-emerald-600' : 
                'text-red-600'
              }`}>
                {kpi.change} em relação a ontem
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance Chart */}
        <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-900">Performance do Sistema</h3>
            <p className="text-sm text-zinc-500">Requisições vs Erros nas últimas 24h</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e4e4e7' }}
                />
                <Legend />
                <Line type="monotone" dataKey="requests" name="Requisições" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="errors" name="Erros" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* API Usage Chart */}
        <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-900">Uso por API</h3>
            <p className="text-sm text-zinc-500">Distribuição de chamadas por serviço</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apiUsageData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e4e4e7' }}
                  cursor={{ fill: '#f4f4f5' }}
                />
                <Bar dataKey="value" name="Chamadas (milhares)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-zinc-900">Status dos Serviços</h3>
        </div>
        <div className="space-y-4">
          {[
            { name: "HOS Ecommerce - V2", status: "Operacional", uptime: "99.99%", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
            { name: "Imendes - V3", status: "Operacional", uptime: "99.95%", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
            { name: "Éden - Trier", status: "Instabilidade Parcial", uptime: "98.50%", icon: <AlertTriangle className="w-5 h-5 text-amber-500" /> },
          ].map((service, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-zinc-100 rounded-lg bg-zinc-50/50">
              <div className="flex items-center gap-3">
                {service.icon}
                <div>
                  <p className="font-medium text-zinc-900">{service.name}</p>
                  <p className="text-sm text-zinc-500">{service.status}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-900">{service.uptime}</p>
                <p className="text-xs text-zinc-500">Uptime (30d)</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
