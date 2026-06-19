"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PurchaseOrderForm from '@/components/forms/purchase-order-form'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function PurchasingModule() {
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const inr = useMemo(() => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }), [])

  async function fetchOrders() {
    setLoading(true)
    try {
      const r = await fetch('/api/purchase/orders')
      const j = await r.json()
      setOrders(Array.isArray(j.data) ? j.data : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleSubmit = async (po: any) => {
    setSubmitting(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/purchase/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to create purchase order')
      setMessage(`PO ${data?.data?.po_number || 'created'} saved.`)
      fetchOrders()
    } catch (e: any) {
      setMessage(e?.message || 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Purchasing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-black mb-4">Place raw material orders (yarn, zips, etc.).</p>
          <PurchaseOrderForm onSubmit={handleSubmit} onCancel={() => {}} />
          {message && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-black">{message}</span>
              <Button variant="outline" className="border-orange-200 text-black" onClick={() => setMessage(null)} disabled={submitting}>
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Recent Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-black">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="text-black">No purchase orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-orange-200">
                    <TableHead className="text-black">PO Number</TableHead>
                    <TableHead className="text-black">Supplier</TableHead>
                    <TableHead className="text-black">Order Date</TableHead>
                    <TableHead className="text-black">Status</TableHead>
                    <TableHead className="text-black">Delivered</TableHead>
                    <TableHead className="text-black text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="border-orange-200 hover:bg-white/30">
                      <TableCell className="text-black">{o.po_number}</TableCell>
                      <TableCell className="text-black">{o.supplier_name}</TableCell>
                      <TableCell className="text-black">{o.order_date?.slice(0, 10)}</TableCell>
                      <TableCell className="text-black">
                        <select
                          value={o.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value
                            try {
                              await fetch(`/api/purchase/orders/${o.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: newStatus }),
                              })
                              await fetchOrders()
                            } catch {}
                          }}
                          className="bg-white border border-orange-200 text-black rounded px-2 py-1 text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="received">Received</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-black">{o.actual_delivery_date ? String(o.actual_delivery_date).slice(0, 10) : '-'}</TableCell>
                      <TableCell className="text-black text-right font-semibold">{inr.format(Number(o.total_cost || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-orange-200 text-black" onClick={fetchOrders} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
