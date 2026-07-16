"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Users, UserCog, ChevronDown, ChevronRight, LayoutDashboard, CalendarCheck,
  FileText, DollarSign, Building2, TableProperties, Clock,
  Factory, ClipboardList, BarChart3, Truck
} from "lucide-react"

interface SidebarProps {
  activeModule: string
  setActiveModule: (module: string) => void
  sidebarOpen: boolean
  userRole: string
}

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

const PROD_SUB_MODULES = [
  { id: "production:dashboard",   label: "Production Dashboard", icon: LayoutDashboard },
  { id: "production:daily-entry", label: "Daily Entry",          icon: ClipboardList },
  { id: "production:tailor-report", label: "Tailor Report",      icon: BarChart3 },
  { id: "production:dispatch",    label: "Dispatch Counts",      icon: Truck },
]

export default function Sidebar({ activeModule, setActiveModule, sidebarOpen }: SidebarProps) {
  const isHR = activeModule.startsWith("hr")
  const isProd = activeModule.startsWith("production")
  const [hrExpanded, setHrExpanded] = useState(true)
  const [prodExpanded, setProdExpanded] = useState(true)

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

  const handleProdClick = () => {
    if (!sidebarOpen) {
      setActiveModule("production:dashboard")
      return
    }
    if (!isProd) {
      setActiveModule("production:dashboard")
      setProdExpanded(true)
    } else {
      setProdExpanded(e => !e)
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
        {/* HR Section */}
        <div className="pt-1">
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
        </div>

        {/* Production Section */}
        <div className="pt-3">
          {sidebarOpen && (
            <p className="px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Production
            </p>
          )}

          <Button
            variant="ghost"
            className={`w-full justify-start ${
              isProd
                ? "bg-orange-600 hover:bg-orange-700 text-white"
                : "text-black hover:text-black hover:bg-orange-50"
            }`}
            onClick={handleProdClick}
          >
            <Factory className="w-5 h-5 shrink-0" />
            {sidebarOpen && (
              <>
                <span className="ml-3 flex-1 text-left">Production</span>
                {prodExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </>
            )}
          </Button>

          {sidebarOpen && prodExpanded && (
            <div className="ml-4 mt-0.5 border-l-2 border-orange-100 pl-2 space-y-0.5">
              {PROD_SUB_MODULES.map((sub) => {
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
        </div>
      </nav>
    </div>
  )
}
