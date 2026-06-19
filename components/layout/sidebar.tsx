"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  BarChart3, Package, Zap, ShoppingCart, Users, CheckSquare, Truck,
  UserCog, ChevronDown, ChevronRight, LayoutDashboard, CalendarCheck,
  FileText, DollarSign, Building2, TableProperties, Clock
} from "lucide-react"
import { ROLE_MODULES } from "@/lib/roles"

interface SidebarProps {
  activeModule: string
  setActiveModule: (module: string) => void
  sidebarOpen: boolean
  userRole: string
}

const MODULE_ICONS: Record<string, any> = {
  analytics: BarChart3,
  inventory: Package,
  production: Zap,
  orders: ShoppingCart,
  purchasing: ShoppingCart,
  suppliers: Users,
  quality: CheckSquare,
  dispatch: Truck,
  subcontract: Package,
}

const MODULES = [
  { id: "analytics",   label: "Dashboard",      icon: "analytics" },
  { id: "inventory",   label: "Inventory",       icon: "inventory" },
  { id: "production",  label: "Production",      icon: "production" },
  { id: "orders",      label: "Orders",          icon: "orders" },
  { id: "purchasing",  label: "Purchasing",      icon: "purchasing" },
  { id: "suppliers",   label: "Suppliers",       icon: "suppliers" },
  { id: "quality",     label: "Quality Control", icon: "quality" },
  { id: "dispatch",    label: "Dispatch",        icon: "dispatch" },
  { id: "subcontract", label: "Subcontracting",  icon: "subcontract" },
]

const HR_SUB_MODULES = [
  { id: "hr:dashboard",        label: "HR Dashboard",    icon: LayoutDashboard },
  { id: "hr:employees",        label: "Employees",       icon: Users },
  { id: "hr:attendance",       label: "Attendance",      icon: CalendarCheck },
  { id: "hr:attendance-sheet", label: "Attendance Sheet",icon: TableProperties },
  { id: "hr:shifts",           label: "Shifts",          icon: Clock },
  { id: "hr:leave",            label: "Leave",           icon: FileText },
  { id: "hr:payroll",          label: "Payroll",         icon: DollarSign },
  { id: "hr:departments",      label: "Departments",     icon: Building2 },
]

export default function Sidebar({ activeModule, setActiveModule, sidebarOpen, userRole }: SidebarProps) {
  const isHR = activeModule.startsWith("hr")
  const [hrExpanded, setHrExpanded] = useState(isHR)

  const allowed = ROLE_MODULES[userRole] || ROLE_MODULES['admin']
  const visibleModules = MODULES.filter(m => allowed.includes(m.id))
  const showHR = allowed.includes('hr')

  const handleHRClick = () => {
    if (!sidebarOpen) {
      setActiveModule("hr:dashboard")
      return
    }
    if (!isHR) {
      setActiveModule("hr:dashboard")
      setHrExpanded(true)
    } else {
      setHrExpanded(e => !e)
    }
  }

  return (
    <div
      className={`bg-white border-r border-orange-200 flex flex-col transition-all duration-300 ${
        sidebarOpen ? "w-56" : "w-20"
      }`}
    >
      <div className="p-4 border-b border-orange-200 flex items-center justify-between">
        {sidebarOpen && <span className="text-lg font-bold text-black">Demo ERP</span>}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleModules.map((module) => {
          const Icon = MODULE_ICONS[module.icon]
          return (
            <Button
              key={module.id}
              variant={activeModule === module.id ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeModule === module.id
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "text-black hover:text-black hover:bg-orange-50"
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="ml-3">{module.label}</span>}
            </Button>
          )
        })}

        {/* HR Section */}
        {showHR && <div className="pt-1">
          {sidebarOpen && (
            <p className="px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Human Resources
            </p>
          )}

          {/* HR & Payroll parent button */}
          <Button
            variant="ghost"
            className={`w-full justify-start ${
              isHR
                ? "bg-orange-600 hover:bg-orange-700 text-white"
                : "text-black hover:text-black hover:bg-orange-50"
            }`}
            onClick={handleHRClick}
          >
            <UserCog className="w-5 h-5 shrink-0" />
            {sidebarOpen && (
              <>
                <span className="ml-3 flex-1 text-left">HR & Payroll</span>
                {hrExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </>
            )}
          </Button>

          {/* Sub-menu items */}
          {sidebarOpen && hrExpanded && (
            <div className="ml-4 mt-0.5 border-l-2 border-orange-100 pl-2 space-y-0.5">
              {HR_SUB_MODULES.map((sub) => {
                const Icon = sub.icon
                const active = activeModule === sub.id
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveModule(sub.id)}
                    className={`w-full justify-start h-8 text-xs ${
                      active
                        ? "bg-orange-100 text-orange-700 font-medium"
                        : "text-gray-600 hover:text-orange-700 hover:bg-orange-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="ml-2">{sub.label}</span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>}
      </nav>
    </div>
  )
}
