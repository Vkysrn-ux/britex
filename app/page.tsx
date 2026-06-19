"use client"

import { useState, useEffect } from "react"
import LoginForm from "@/components/auth/login-form"
import Dashboard from "@/components/dashboard/dashboard"

export default function Home() {
  const [user, setUser]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  // Restore session from cookie on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user) })
      .finally(() => setLoading(false))
  }, [])

  const handleLogin  = (userData: any) => setUser(userData)
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <LoginForm onLogin={handleLogin} />
}
