"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const productionData = [
  { date: "Mon", produced: 120, target: 150 },
  { date: "Tue", produced: 140, target: 150 },
  { date: "Wed", produced: 100, target: 150 },
  { date: "Thu", produced: 155, target: 150 },
  { date: "Fri", produced: 160, target: 150 },
];

const inventoryData = [
  { name: "In Stock", value: 65, fill: "#3b82f6" },
  { name: "Low Stock", value: 25, fill: "#f59e0b" },
  { name: "Out of Stock", value: 10, fill: "#ef4444" },
];

const revenueData = [
  { month: "Jan", revenue: 45000 },
  { month: "Feb", revenue: 52000 },
  { month: "Mar", revenue: 48000 },
  { month: "Apr", revenue: 61000 },
  { month: "May", revenue: 55000 },
  { month: "Jun", revenue: 67000 },
];

export default function AnalyticsModule() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-black text-sm font-medium">Total Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">$125,400</div>
            <p className="text-xs text-black mt-1">+2.5% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-black text-sm font-medium">Active Production Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">14</div>
            <p className="text-xs text-black mt-1">3 overdue</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-black text-sm font-medium">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">28</div>
            <p className="text-xs text-black mt-1">8 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-black text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">$67,000</div>
            <p className="text-xs text-black mt-1">+21.8% vs last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-orange-200">
          <CardHeader>
            <CardTitle className="text-black">Production vs Target</CardTitle>
            <CardDescription className="text-black">Weekly production output</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                <Legend />
                <Bar dataKey="produced" fill="#3b82f6" />
                <Bar dataKey="target" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-orange-200">
          <CardHeader>
            <CardTitle className="text-black">Inventory Status</CardTitle>
            <CardDescription className="text-black">Product availability</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={inventoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {inventoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Revenue Trend</CardTitle>
          <CardDescription className="text-black">6-month revenue performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
