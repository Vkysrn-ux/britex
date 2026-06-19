"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Inspection = {
  id: number
  inspection_date: string
  product_id: number
  batch_number: string | null
  quantity_inspected: number
  quantity_passed: number
  quantity_failed: number
  status: 'pending_review' | 'passed' | 'failed'
  product_sku?: string
  product_name?: string
}

export default function QualityModule() {
  const [rows, setRows] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchInspections() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quality/inspections?status=pending_review')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load inspections')
      setRows(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load inspections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInspections() }, [])

  async function markPassed(id: number) {
    try {
      const res = await fetch(`/api/quality/inspections/${id}/pass`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update')
      // Drop from list and keep UX snappy
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (e: any) {
      setError(e.message || 'Failed to mark as passed')
    }
  }

  async function markFailed(id: number) {
    const reason = prompt('Reason for failure (optional)') || undefined
    try {
      const res = await fetch(`/api/quality/inspections/${id}/fail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update')
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (e: any) {
      setError(e.message || 'Failed to mark as failed')
    }
  }

  const fmtDate = (s?: string | null) => {
    if (!s) return '-'
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    return d.toISOString().slice(0,10)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-black">Quality Control</h1>
        <button className="ml-auto bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-1" onClick={fetchInspections}>Refresh</button>
      </div>

      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Pending Inspections</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          {loading ? (
            <div className="text-black">Loading…</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="text-left p-2 border">Date</th>
                    <th className="text-left p-2 border">Batch</th>
                    <th className="text-left p-2 border">Product</th>
                    <th className="text-right p-2 border">Inspected</th>
                    <th className="text-right p-2 border">Passed</th>
                    <th className="text-right p-2 border">Failed</th>
                    <th className="text-left p-2 border">Status</th>
                    <th className="text-left p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="odd:bg-white even:bg-orange-50/30">
                      <td className="p-2 border">{fmtDate(r.inspection_date)}</td>
                      <td className="p-2 border">{r.batch_number || '-'}</td>
                      <td className="p-2 border">{r.product_sku} - {r.product_name}</td>
                      <td className="p-2 border text-right">{r.quantity_inspected}</td>
                      <td className="p-2 border text-right">{r.quantity_passed}</td>
                      <td className="p-2 border text-right">{r.quantity_failed}</td>
                      <td className="p-2 border capitalize">{r.status.replace('_',' ')}</td>
                      <td className="p-2 border">
                        <div className="flex gap-2">
                          <button className="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1" onClick={() => markPassed(r.id)}>
                            Tested OK → Dispatch
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1" onClick={() => markFailed(r.id)}>
                            Fail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="p-3 border text-center text-gray-500" colSpan={8}>No pending inspections</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
