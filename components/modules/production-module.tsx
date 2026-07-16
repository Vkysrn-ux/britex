"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Factory } from "lucide-react"

interface ProductionModuleProps {
  activeTab: string
}

const TAB_TITLES: Record<string, string> = {
  "dashboard":     "Production Dashboard",
  "daily-entry":   "Daily Production Entry",
  "tailor-report": "Tailor Report",
  "dispatch":      "Dispatch Counts",
}

export default function ProductionModule({ activeTab }: ProductionModuleProps) {
  const title = TAB_TITLES[activeTab] || "Production"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black">{title}</h1>
        <p className="text-sm text-gray-500">Tailor-wise production and dispatch tracking</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="w-5 h-5 text-orange-600" />
            Coming up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            This section is being rebuilt from scratch. {title} will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
