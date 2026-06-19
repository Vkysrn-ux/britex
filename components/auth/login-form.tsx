"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface LoginFormProps {
  onLogin: (user: any) => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail]       = useState("admin@erp.com")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      onLogin(data.user)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-xl border-orange-200 bg-white">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Mattress ERP</span>
          </div>
          <CardTitle className="text-gray-900">Sign In</CardTitle>
          <CardDescription>Enter your credentials to access the system</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="admin@erp.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600">
              {[
                { role: 'Admin',      email: 'admin@erp.com',    pw: 'Admin@123',    access: 'All modules' },
                { role: 'HR Manager', email: 'hr@erp.com',       pw: 'Hr@123',       access: 'HR only' },
                { role: 'Production', email: 'prod@erp.com',     pw: 'Prod@123',     access: 'Production' },
                { role: 'Sales',      email: 'sales@erp.com',    pw: 'Sales@123',    access: 'Orders' },
                { role: 'Quality',    email: 'quality@erp.com',  pw: 'Quality@123',  access: 'QC' },
                { role: 'Warehouse',  email: 'warehouse@erp.com',pw: 'Warehouse@123',access: 'Dispatch' },
              ].map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword(u.pw) }}
                  className="text-left p-2 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                >
                  <p className="font-semibold text-gray-800">{u.role}</p>
                  <p className="text-gray-400 text-[10px]">{u.access}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">Click a role card to auto-fill credentials</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
