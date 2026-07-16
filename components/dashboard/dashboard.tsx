"use client"

import { useState } from "react"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import HRModule from "@/components/modules/hr-module"
import ProductionModule from "@/components/modules/production-module"

interface DashboardProps {
  user: { email: string; role: string; name: string }
  onLogout: () => void
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeModule, setActiveModule] = useState("hr:dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Extract sub-tab from "hr:employees" → "employees"
  const isProd = activeModule.startsWith("production")
  const hrTab = activeModule.startsWith("hr:") ? activeModule.split(":")[1] : "dashboard"
  const prodTab = activeModule.startsWith("production:") ? activeModule.split(":")[1] : "dashboard"

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        sidebarOpen={sidebarOpen}
        userRole={user.role}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} onLogout={onLogout} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 overflow-auto bg-white p-6">
          {isProd ? <ProductionModule activeTab={prodTab} /> : <HRModule activeTab={hrTab} />}
        </main>
      </div>
    </div>
  )
}
