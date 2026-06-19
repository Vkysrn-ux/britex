"use client"

import { useState, useEffect } from "react"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import InventoryModule from "@/components/modules/inventory-module"
import ProductionModule from "@/components/modules/production-module"
import OrdersModule from "@/components/modules/orders-module"
import PurchasingModule from "@/components/modules/purchasing-module"
import AnalyticsModule from "@/components/modules/analytics-module"
import QualityModule from "@/components/modules/quality-module"
import DispatchModule from "@/components/modules/dispatch-module"
import SubcontractModule from "@/components/modules/subcontract-module"
import HRModule from "@/components/modules/hr-module"

interface DashboardProps {
  user: { email: string; role: string; name: string }
  onLogout: () => void
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  // Default module based on role: HR users go straight to HR dashboard
  const defaultModule = user.role === 'hr' ? 'hr:dashboard' : 'analytics'
  const [activeModule, setActiveModule] = useState(defaultModule)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isHR = activeModule.startsWith("hr")
  // Extract sub-tab from "hr:employees" → "employees"
  const hrTab = activeModule.startsWith("hr:") ? activeModule.split(":")[1] : "dashboard"

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
          {activeModule === "analytics"  && <AnalyticsModule />}
          {activeModule === "inventory"  && <InventoryModule />}
          {activeModule === "production" && <ProductionModule />}
          {activeModule === "orders"     && <OrdersModule />}
          {activeModule === "purchasing" && <PurchasingModule />}
          {activeModule === "quality"    && <QualityModule />}
          {activeModule === "dispatch"   && <DispatchModule />}
          {activeModule === "subcontract"&& <SubcontractModule />}
          {isHR && <HRModule activeTab={hrTab} />}
        </main>
      </div>
    </div>
  )
}
