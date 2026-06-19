"use client"

import { useEffect, useMemo, useState } from 'react'
import { Progress } from '@/components/ui/progress'

 type ProductionOrder = {
  id: number
  order_number: string
  finished_product_id: number
  quantity_ordered: number
  quantity_produced: number
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  start_date?: string | null
  expected_completion_date?: string | null
  actual_completion_date?: string | null
  assigned_to?: number | null
  notes?: string | null
  product_sku?: string
  product_name?: string
  product_size?: string
  assigned_to_name?: string | null
}

 type FinishedProduct = { id: number; sku: string; name: string; size?: string | null; product_type: string }

 const statuses = ['pending','in_progress','completed','cancelled'] as const
 const priorities = ['low','medium','high'] as const

function OrdersTab() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [products, setProducts] = useState<FinishedProduct[]>([])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueBusy, setIssueBusy] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [issueForm, setIssueForm] = useState<{ sku: string; qty: string; note: string }>({ sku: '', qty: '', note: '' })
  const [matOpts, setMatOpts] = useState<any[]>([])
  const [matLoading, setMatLoading] = useState(false)
  const [matQ, setMatQ] = useState('')

  async function loadMaterials(search: string) {
    setMatLoading(true)
    try {
      const qs = new URLSearchParams({ search, pageSize: '200' })
      const res = await fetch(`/api/inventory/raw-materials?${qs.toString()}`)
      const data = await res.json()
      if (res.ok) setMatOpts(data.data || [])
    } finally {
      setMatLoading(false)
    }
  }
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })
  const fmtQty = (n: any) => nf.format(Number(n ?? 0))
  const fmtDate = (s?: string | null) => {
    if (!s) return '-'
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    return d.toISOString().slice(0,10)
  }

  // Complete & QC modal state
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [completeErr, setCompleteErr] = useState<string | null>(null)
  const [completeForm, setCompleteForm] = useState<{ producedQty: string; passedQty: string; failedQty: string; batch: string; note: string }>({ producedQty: '', passedQty: '', failedQty: '0', batch: '', note: '' })

  function openCompleteModal() {
    if (!detail?.order) return
    const produced = Number(detail.order.quantity_ordered || 0)
    setCompleteForm({ producedQty: String(produced), passedQty: String(produced), failedQty: '0', batch: detail.order.order_number, note: '' })
    setCompleteErr(null)
    setCompleteOpen(true)
  }

  async function submitComplete() {
    if (selectedId == null) return
    setCompleteBusy(true)
    setCompleteErr(null)
    const produced = Number(completeForm.producedQty)
    const passed = Number(completeForm.passedQty)
    const failed = Number(completeForm.failedQty)
    if (passed + failed !== produced) {
      setCompleteErr('Passed + Failed must equal Produced')
      setCompleteBusy(false)
      return
    }
    try {
      const res = await fetch(`/api/production/orders/${selectedId}/complete-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producedQty: produced,
          passedQty: passed,
          failedQty: failed,
          batchNumber: completeForm.batch || detail?.order?.order_number,
          note: completeForm.note || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to complete order')
      setCompleteOpen(false)
      await openDetail(selectedId)
    } catch (e: any) {
      setCompleteErr(e.message || 'Failed to complete order')
    } finally {
      setCompleteBusy(false)
    }
  }

  const [form, setForm] = useState({
    order_number: '',
    finished_product_id: '',
    quantity_ordered: 1,
    priority: 'medium',
    start_date: '',
    expected_completion_date: '',
    assigned_to: ''
  })

  async function fetchOrders() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (statusFilter) qs.set('status', statusFilter)
      const res = await fetch(`/api/production/orders?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setOrders(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Error loading orders')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products/finished')
      const data = await res.json()
      if (res.ok) setProducts(data.data || [])
    } catch {}
  }

  useEffect(() => {
    fetchOrders()
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openDetail(id: number) {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/production/orders/${id}/summary`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load order')
      setDetail(data.data)
    } catch (e) {
      console.error(e)
      setDetail({ error: 'Failed to load' })
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetail(null)
  }

  async function submitIssue() {
    if (selectedId == null) return
    setIssueBusy(true)
    setIssueError(null)
    try {
      const res = await fetch(`/api/production/orders/${selectedId}/material-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: issueForm.sku.trim(), qty: Number(issueForm.qty), note: issueForm.note || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to issue material')
      setIssueOpen(false)
      setIssueForm({ sku: '', qty: '', note: '' })
      // refresh detail view
      await openDetail(selectedId)
    } catch (e: any) {
      setIssueError(e.message || 'Failed to issue material')
    } finally {
      setIssueBusy(false)
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const body = {
        order_number: form.order_number.trim(),
        finished_product_id: Number(form.finished_product_id),
        quantity_ordered: Number(form.quantity_ordered) || 1,
        priority: form.priority as 'low'|'medium'|'high',
        start_date: form.start_date || null,
        expected_completion_date: form.expected_completion_date || null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      }
      const res = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add order')
      setOrders((prev) => [data.data, ...prev])
      setForm({ order_number: '', finished_product_id: '', quantity_ordered: 1, priority: 'medium', start_date: '', expected_completion_date: '', assigned_to: '' })
    } catch (e: any) {
      setError(e.message || 'Error adding order')
    }
  }

  async function onInlineUpdate(id: number, patch: Partial<ProductionOrder>) {
    try {
      const res = await fetch(`/api/production/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update')
      setOrders((prev) => prev.map((x) => (x.id === id ? data.data : x)))
    } catch (e: any) {
      alert(e.message || 'Update failed')
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this order?')) return
    try {
      const res = await fetch(`/api/production/orders/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete')
      setOrders((prev) => prev.filter((x) => x.id !== id))
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  const filtered = useMemo(() => orders, [orders])

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Production - Orders</h1>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium mb-3">Create Order</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input required placeholder="Order #" className="border rounded px-3 py-2"
                 value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} />

          <select required className="border rounded px-3 py-2"
                  value={form.finished_product_id}
                  onChange={(e) => setForm({ ...form, finished_product_id: e.target.value })}>
            <option value="">Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.sku} - {p.name}{p.size ? ` (${p.size})` : ''}</option>
            ))}
          </select>

          <input type="number" min={1} className="border rounded px-3 py-2" placeholder="Qty"
                 value={form.quantity_ordered}
                 onChange={(e) => setForm({ ...form, quantity_ordered: Number(e.target.value) })} />

          <select className="border rounded px-3 py-2" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {priorities.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>

          <input type="date" className="border rounded px-3 py-2" value={form.start_date}
                 onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input type="date" className="border rounded px-3 py-2" value={form.expected_completion_date}
                 onChange={(e) => setForm({ ...form, expected_completion_date: e.target.value })} />

          <button className="md:col-span-6 bg-orange-600 hover:bg-orange-700 text-white rounded px-4 py-2"
                  type="submit">Add Order</button>
        </form>
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <input placeholder="Search by order # or product" className="border rounded px-3 py-2 flex-1"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border rounded px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
          <button className="bg-orange-600 hover:bg-orange-700 text-white rounded px-4 py-2" onClick={fetchOrders}>Refresh</button>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border">
              <thead className="bg-orange-50">
                <tr>
                  <th className="text-left p-2 border">Order #</th>
                  <th className="text-left p-2 border">Product</th>
                  <th className="text-left p-2 border">Qty</th>
                  <th className="text-left p-2 border">Produced</th>
                  <th className="text-left p-2 border">Status</th>
                  <th className="text-left p-2 border">Priority</th>
                  <th className="text-left p-2 border">Dates</th>
                  <th className="text-left p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="odd:bg-white even:bg-orange-50/30 cursor-pointer hover:bg-orange-50"
                      onClick={() => openDetail(o.id)}>
                    <td className="p-2 border font-medium">{o.order_number}</td>
                    <td className="p-2 border">{o.product_sku} - {o.product_name}{o.product_size ? ` (${o.product_size})` : ''}</td>
                    <td className="p-2 border">{o.quantity_ordered}</td>
                    <td className="p-2 border">
                      <input type="number" min={0} className="border rounded px-2 py-1 w-24" value={o.quantity_produced} onClick={(e) => e.stopPropagation()}
                             onChange={(e) => onInlineUpdate(o.id, { quantity_produced: Number(e.target.value) })} />
                    </td>
                    <td className="p-2 border">
                      <select className="border rounded px-2 py-1" value={o.status} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onInlineUpdate(o.id, { status: e.target.value as any })}>
                        {statuses.map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </td>
                    <td className="p-2 border">
                      <select className="border rounded px-2 py-1" value={o.priority} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onInlineUpdate(o.id, { priority: e.target.value as any })}>
                        {priorities.map(p => (<option key={p} value={p}>{p}</option>))}
                      </select>
                    </td>
                    <td className="p-2 border text-sm">
                      {o.start_date || '-'} ? {o.expected_completion_date || '-'}
                    </td>
                    <td className="p-2 border">
                      <button className="text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); onDelete(o.id) }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>

    {/* Drawer rendered inside OrdersTab */}
    {selectedId !== null && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
        <div className="absolute right-0 top-0 h-full w-full sm:w-[600px] bg-white shadow-xl overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">Order Details</h3>
            <button className="text-orange-600" onClick={closeDetail}>Close</button>
          </div>
          <div className="p-4 space-y-4">
            {detailLoading && <div>Loading…</div>}
            {!detailLoading && detail && !detail.error && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-gray-600">Order #</div>
                  <div className="font-medium">{detail.order.order_number}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Product</div>
                    <div className="font-medium">{detail.order.product_sku} - {detail.order.product_name}{detail.order.product_size ? ` (${detail.order.product_size})` : ''}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Due date</div>
                    <div className="font-medium">{fmtDate(detail.order.expected_completion_date)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Status</div>
                    <div className="font-medium capitalize">{detail.order.status}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Qty</div>
                    <div className="font-medium">{detail.order.quantity_produced} / {detail.order.quantity_ordered}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-gray-700">Order Progress</span>
                    <span className="font-medium">{detail.progress.percent_complete}%</span>
                  </div>
                  <Progress value={detail.progress.percent_complete} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-gray-700">Materials Completion</span>
                    <span className="font-medium">{detail.aggregates?.materials_percent ?? 0}%</span>
                  </div>
                  <Progress value={detail.aggregates?.materials_percent ?? 0} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Raw Materials</h4>
                    <button className="bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-1"
                            onClick={() => { setIssueOpen(true); setIssueError(null); loadMaterials('') }}>
                      Add Material
                    </button>
                  </div>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-orange-50">
                        <th className="text-left p-2 border">Material</th>
                        <th className="text-right p-2 border">Required</th>
                        <th className="text-right p-2 border">Allocated</th>
                        <th className="text-right p-2 border">Consumed</th>
                        <th className="text-right p-2 border">Waste</th>
                        <th className="text-right p-2 border">On Floor</th>
                        <th className="text-right p-2 border">Fulfilled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.materials as any[] | undefined)?.map((m) => (
                        <tr key={m.raw_material_id} className="odd:bg-white even:bg-orange-50/30">
                          <td className="p-2 border">{m.raw_material_sku} - {m.raw_material_name} ({m.unit})</td>
                          <td className="p-2 border text-right">{fmtQty(m.required_qty)}</td>
                          <td className="p-2 border text-right">{fmtQty(m.allocated_qty)}</td>
                          <td className="p-2 border text-right">{fmtQty(m.consumed_qty)}</td>
                          <td className="p-2 border text-right">{fmtQty(m.waste_qty)}</td>
                          <td className="p-2 border text-right">{fmtQty(m.on_floor_qty)}</td>
                          <td className="p-2 border text-right">{m.fulfillment_percent ?? 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button className={`px-3 py-1 rounded ${detail.order.status === 'completed' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                          disabled={detail.order.status === 'completed'}
                          onClick={openCompleteModal}>
                    Complete & Move to QC
                  </button>
                </div>
              </div>
            )}
            {!detailLoading && detail?.error && (
              <div className="text-red-600">{detail.error}</div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Issue material modal */}
    {issueOpen && (
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/40" onClick={() => !issueBusy && setIssueOpen(false)} />
        <div className="absolute inset-x-4 sm:inset-x-auto sm:right-6 top-24 sm:w-[420px] bg-white rounded shadow-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Add Material from Inventory</h4>
            <button className="text-gray-600" disabled={issueBusy} onClick={() => setIssueOpen(false)}>Close</button>
          </div>
          {issueError && <div className="text-red-600 mb-2 text-sm">{issueError}</div>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Material</label>
              <div className="flex gap-2">
                <input className="border rounded px-2 py-1 flex-1" placeholder="Search SKU or name"
                       value={matQ}
                       onChange={(e) => { setMatQ(e.target.value); loadMaterials(e.target.value) }} />
                <button className="px-2 py-1 border rounded" onClick={() => loadMaterials(matQ)}>Search</button>
              </div>
              <select className="mt-2 border rounded px-2 py-1 w-full" value={issueForm.sku}
                      onChange={(e) => setIssueForm({ ...issueForm, sku: e.target.value })}>
                <option value="" disabled>{matLoading ? 'Loading…' : 'Select a material'}</option>
                {matOpts.map((m) => (
                  <option key={m.id} value={m.sku}>
                    {m.sku} — {m.name} ({m.unit}) • On hand: {m.quantity_on_hand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Issue Qty</label>
              <input type="number" min={0.001} step={0.001} className="border rounded px-2 py-1 w-40"
                     value={issueForm.qty}
                     onChange={(e) => setIssueForm({ ...issueForm, qty: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Note (optional)</label>
              <input className="border rounded px-2 py-1 w-full" value={issueForm.note}
                     onChange={(e) => setIssueForm({ ...issueForm, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-3 py-1 rounded border" disabled={issueBusy} onClick={() => setIssueOpen(false)}>Cancel</button>
              <button className={`px-3 py-1 rounded text-white ${issueBusy ? 'bg-orange-400' : 'bg-orange-600 hover:bg-orange-700'}`}
                      disabled={issueBusy || !issueForm.sku.trim() || !(Number(issueForm.qty) > 0)}
                      onClick={submitIssue}>
                {issueBusy ? 'Issuing…' : 'Issue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Complete & QC modal */}
    {completeOpen && (
      <div className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/40" onClick={() => !completeBusy && setCompleteOpen(false)} />
        <div className="absolute inset-x-4 sm:inset-x-auto sm:right-6 top-24 sm:w-[460px] bg-white rounded shadow-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Complete Order & Send to QC</h4>
            <button className="text-gray-600" disabled={completeBusy} onClick={() => setCompleteOpen(false)}>Close</button>
          </div>
          {completeErr && <div className="text-red-600 mb-2 text-sm">{completeErr}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Batch</label>
              <input className="border rounded px-2 py-1 w-full" value={completeForm.batch}
                     onChange={(e) => setCompleteForm({ ...completeForm, batch: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Produced Qty</label>
              <input type="number" min={0} step={1} className="border rounded px-2 py-1 w-full"
                     value={completeForm.producedQty}
                     onChange={(e) => {
                       const produced = e.target.value
                       // keep passed default equal to produced if failed is zero
                       setCompleteForm((f) => ({ ...f, producedQty: produced, passedQty: String(Math.max(0, Number(produced) - Number(f.failedQty||'0'))) }))
                     }} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Failed Qty</label>
              <input type="number" min={0} step={1} className="border rounded px-2 py-1 w-full"
                     value={completeForm.failedQty}
                     onChange={(e) => {
                       const failed = e.target.value
                       setCompleteForm((f) => ({ ...f, failedQty: failed, passedQty: String(Math.max(0, Number(f.producedQty||'0') - Number(failed))) }))
                     }} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Passed Qty</label>
              <input type="number" min={0} step={1} className="border rounded px-2 py-1 w-full"
                     value={completeForm.passedQty}
                     onChange={(e) => {
                       const passed = e.target.value
                       setCompleteForm((f) => ({ ...f, passedQty: passed, failedQty: String(Math.max(0, Number(f.producedQty||'0') - Number(passed))) }))
                     }} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Note (optional)</label>
              <input className="border rounded px-2 py-1 w-full" value={completeForm.note}
                     onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button className="px-3 py-1 rounded border" disabled={completeBusy} onClick={() => setCompleteOpen(false)}>Cancel</button>
            <button className={`px-3 py-1 rounded text-white ${completeBusy ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
                    disabled={completeBusy || !(Number(completeForm.producedQty) >= 0)}
                    onClick={submitComplete}>
              {completeBusy ? 'Saving…' : 'Complete & QC'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
 }



function MaterialsTab() {
  const [rows, setRows] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function fetchMaterials() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/production/materials')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load materials')
      setRows(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Error loading materials')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchMaterials() }, [])

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-medium">Materials Needed (open orders)</h2>
        <button className="bg-orange-600 hover:bg-orange-700 text-white rounded px-3 py-1" onClick={fetchMaterials}>Refresh</button>
      </div>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border">
            <thead className="bg-orange-50">
              <tr>
                <th className="text-left p-2 border">SKU</th>
                <th className="text-left p-2 border">Material</th>
                <th className="text-left p-2 border">Unit</th>
                <th className="text-left p-2 border">In Stock</th>
                <th className="text-left p-2 border">Required</th>
                <th className="text-left p-2 border">Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.raw_material_id} className="odd:bg-white even:bg-orange-50/30">
                  <td className="p-2 border font-mono">{r.sku}</td>
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.unit}</td>
                  <td className="p-2 border">{r.on_hand}</td>
                  <td className="p-2 border">{r.required_total}</td>
                  <td className={`p-2 border ${r.shortage > 0 ? 'text-red-600 font-semibold' : ''}`}>{r.shortage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
import React from "react"

export default function ProductionPage() {
  const [tab, setTab] = React.useState<'orders' | 'materials'>('orders')
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Production</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setTab('orders')} className={`px-3 py-1 rounded border ${tab==='orders' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white'}`}>Orders</button>
          <button onClick={() => setTab('materials')} className={`px-3 py-1 rounded border ${tab==='materials' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white'}`}>Materials</button>
      </div>
    </div>

    {/* Drawer rendered inside OrdersTab */}
      {tab === 'orders' ? <OrdersTab /> : <MaterialsTab />}
    </div>
  )
}



