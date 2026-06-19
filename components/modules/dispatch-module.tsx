"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  order_id: number
  order_number: string
  status: string
  item_id: number
  finished_product_id: number
  sku: string
  name: string
  quantity_ordered: number
  quantity_shipped: number
  outstanding: number
  on_hand: number
}

export default function DispatchModule() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [alloc, setAlloc] = useState<Record<number, string>>({})
  const [shipOpen, setShipOpen] = useState<null | Row>(null)
  const [shipBusy, setShipBusy] = useState(false)
  const [shipErr, setShipErr] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState<{ dest: 'customer'|'showroom'|'warehouse'; ref: string; qty: string }>({ dest: 'customer', ref: '', qty: '' })
  const [stockOpen, setStockOpen] = useState(false)
  const [stockBusy, setStockBusy] = useState(false)
  const [stockErr, setStockErr] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [stockForm, setStockForm] = useState<{ productId: string; qty: string; dest: 'showroom'|'warehouse'|'customer'; ref: string }>({ productId: '', qty: '', dest: 'warehouse', ref: '' })

  async function fetchRows() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      const res = await fetch(`/api/dispatch/orders?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setRows(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchRows() }, [])
  async function loadProducts() {
    try {
      const res = await fetch('/api/products/finished')
      const data = await res.json()
      if (res.ok) setProducts(data.data || [])
    } catch {}
  }

  async function allocate(itemId: number, max: number) {
    const qty = Math.min(Number(alloc[itemId] || 0), max)
    if (!(qty > 0)) return
    setError(null)
    try {
      const res = await fetch('/api/dispatch/allocate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, qty }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to allocate')
      setAlloc(prev => ({ ...prev, [itemId]: '' }))
      fetchRows()
    } catch (e: any) {
      setError(e.message || 'Failed to allocate')
    }
  }

  async function shipNow(row: Row) {
    setShipBusy(true)
    setShipErr(null)
    const qty = Number(shipForm.qty)
    if (!(qty > 0)) { setShipBusy(false); return }
    try {
      const body = {
        destinationType: shipForm.dest,
        destinationRef: shipForm.ref || null,
        lines: [{ productId: row.finished_product_id, qty, orderId: shipForm.dest === 'customer' ? row.order_id : null, orderItemId: shipForm.dest === 'customer' ? row.item_id : null }],
      }
      const res = await fetch('/api/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to ship')
      setShipOpen(null)
      setShipForm({ dest: 'customer', ref: '', qty: '' })
      fetchRows()
    } catch (e: any) {
      setShipErr(e.message || 'Failed to ship')
    } finally {
      setShipBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-black">Dispatch</h1>
        <input className="ml-auto border rounded px-2 py-1" placeholder="Search order / product" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-1" onClick={fetchRows}>Refresh</button>
        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1" onClick={() => { setStockOpen(true); setStockErr(null); loadProducts() }}>Ship From Stock</button>
      </div>

      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Allocate Finished Goods to Orders</CardTitle>
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
                    <th className="p-2 border text-left">Order</th>
                    <th className="p-2 border text-left">Product</th>
                    <th className="p-2 border text-right">Outstanding</th>
                    <th className="p-2 border text-right">On Hand</th>
                    <th className="p-2 border text-right">Qty to Reserve</th>
                    <th className="p-2 border text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const max = Math.max(0, Math.min(Number(r.outstanding||0), Number(r.on_hand||0)))
                    return (
                      <tr key={r.item_id} className="odd:bg-white even:bg-orange-50/30">
                        <td className="p-2 border">{r.order_number} <span className="text-xs text-gray-600">({r.status})</span></td>
                        <td className="p-2 border">{r.sku} - {r.name}</td>
                        <td className="p-2 border text-right">{r.outstanding}</td>
                        <td className="p-2 border text-right">{r.on_hand}</td>
                        <td className="p-2 border text-right">
                          <input type="number" min={0} step={1} className="border rounded px-2 py-1 w-24 text-right" value={alloc[r.item_id] ?? ''} onChange={(e) => setAlloc(prev => ({ ...prev, [r.item_id]: e.target.value }))} />
                          <button className="ml-2 text-xs underline" onClick={() => setAlloc(prev => ({ ...prev, [r.item_id]: String(max) }))}>Max</button>
                        </td>
                        <td className="p-2 border">
                          <div className="flex gap-2">
                            <button className={`px-3 py-1 rounded text-white ${max <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`} disabled={max <= 0} onClick={() => allocate(r.item_id, max)}>Reserve</button>
                            <button className={`px-3 py-1 rounded text-white ${max <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} disabled={max <= 0} onClick={() => { setShipOpen(r); setShipErr(null); setShipForm({ dest: 'customer', ref: r.order_number, qty: String(max) }) }}>Ship</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-3 border text-center text-gray-500">Nothing to dispatch</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {shipOpen && (
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/40" onClick={() => !shipBusy && setShipOpen(null)} />
        <div className="absolute inset-x-4 sm:inset-x-auto sm:right-6 top-24 sm:w-[520px] bg-white rounded shadow-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Create Shipment</h4>
            <button className="text-gray-600" disabled={shipBusy} onClick={() => setShipOpen(null)}>Close</button>
          </div>
          {shipErr && <div className="text-red-600 mb-2 text-sm">{shipErr}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Destination</label>
              <select className="border rounded px-2 py-1 w-full" value={shipForm.dest} onChange={(e) => setShipForm({ ...shipForm, dest: e.target.value as any })}>
                <option value="customer">Customer</option>
                <option value="showroom">Showroom</option>
                <option value="warehouse">Warehouse</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Reference</label>
              <input className="border rounded px-2 py-1 w-full" placeholder="Order # / Location"
                     value={shipForm.ref} onChange={(e) => setShipForm({ ...shipForm, ref: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Qty</label>
              <input type="number" min={1} step={1} className="border rounded px-2 py-1 w-full"
                     value={shipForm.qty} onChange={(e) => setShipForm({ ...shipForm, qty: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button className="px-3 py-1 rounded border" disabled={shipBusy} onClick={() => setShipOpen(null)}>Cancel</button>
            <button className={`px-3 py-1 rounded text-white ${shipBusy ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`} disabled={shipBusy} onClick={() => shipNow(shipOpen!)}>{shipBusy ? 'Shipping…' : 'Ship Now'}</button>
          </div>
        </div>
      </div>
    )}
      {stockOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => !stockBusy && setStockOpen(false)} />
          <div className="absolute inset-x-4 sm:inset-x-auto sm:right-6 top-24 sm:w-[520px] bg-white rounded shadow-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Ship From Stock</h4>
              <button className="text-gray-600" disabled={stockBusy} onClick={() => setStockOpen(false)}>Close</button>
            </div>
            {stockErr && <div className="text-red-600 mb-2 text-sm">{stockErr}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Product</label>
                <select className="border rounded px-2 py-1 w-full" value={stockForm.productId} onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}>
                  <option value="" disabled>Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name} • On hand: {p.quantity_on_hand}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Destination</label>
                <select className="border rounded px-2 py-1 w-full" value={stockForm.dest} onChange={(e) => setStockForm({ ...stockForm, dest: e.target.value as any })}>
                  <option value="warehouse">Warehouse</option>
                  <option value="showroom">Showroom</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Reference</label>
                <input className="border rounded px-2 py-1 w-full" placeholder="Location / Ref"
                       value={stockForm.ref} onChange={(e) => setStockForm({ ...stockForm, ref: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Qty</label>
                <input type="number" min={1} step={1} className="border rounded px-2 py-1 w-full"
                       value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, qty: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button className="px-3 py-1 rounded border" disabled={stockBusy} onClick={() => setStockOpen(false)}>Cancel</button>
              <button className={`px-3 py-1 rounded text-white ${stockBusy ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`} disabled={stockBusy || !stockForm.productId || !(Number(stockForm.qty) > 0)} onClick={async () => {
                setStockBusy(true)
                setStockErr(null)
                try {
                  const res = await fetch('/api/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationType: stockForm.dest, destinationRef: stockForm.ref || null, lines: [{ productId: Number(stockForm.productId), qty: Number(stockForm.qty) }] }) })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(data?.error || 'Failed to ship')
                  setStockOpen(false)
                  setStockForm({ productId: '', qty: '', dest: 'warehouse', ref: '' })
                  fetchRows()
                } catch (e: any) {
                  setStockErr(e.message || 'Failed to ship')
                } finally {
                  setStockBusy(false)
                }
              }}>Ship Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
