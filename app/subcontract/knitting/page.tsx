"use client"

import { useEffect, useMemo, useState } from 'react'

type Supplier = { id: number; supplier_name: string }
type RawMaterial = { id: number; sku: string; name: string; unit?: string; quantity_on_hand?: number }

export default function KnittingIssuePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState('')
  const [rmOptions, setRmOptions] = useState<RawMaterial[]>([])
  const [searchSku, setSearchSku] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [issues, setIssues] = useState<any[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)

  const [form, setForm] = useState({
    supplierId: '',
    inputSku: '',
    qtyKg: '',
    dcNo: '',
    gsm: '',
    widthCm: '',
    outputSku: '',
    expectedOutputQty: '',
    notes: '',
  })

  async function fetchSuppliers(q: string) {
    try {
      const res = await fetch(`/api/suppliers?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load suppliers')
      setSuppliers(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Supplier load error')
    }
  }

  async function createSupplier() {
    if (!newSupplier.trim()) return
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_name: newSupplier.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create supplier')
      const created: Supplier = data.data
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)))
      setForm((f) => ({ ...f, supplierId: String(created.id) }))
      setNewSupplier('')
      setAddingSupplier(false)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Create supplier failed')
    }
  }

  async function searchRawMaterials(q: string) {
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      params.set('categories', 'yarn')
      const res = await fetch(`/api/inventory/raw-materials?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load materials')
      setRmOptions(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Raw material search error')
    }
  }

  useEffect(() => {
    fetchSuppliers('')
    searchRawMaterials('')
    refreshIssues()
  }, [])

  const selectedRm = useMemo(() => rmOptions.find((r) => r.sku === form.inputSku), [rmOptions, form.inputSku])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const body = {
        supplierId: Number(form.supplierId),
        inputSku: form.inputSku.trim(),
        qtyKg: Number(form.qtyKg),
        dcNo: form.dcNo.trim(),
        gsm: form.gsm === '' ? null : Number(form.gsm),
        widthCm: form.widthCm === '' ? null : Number(form.widthCm),
        outputSku: form.outputSku.trim() || undefined,
        expectedOutputQty: form.expectedOutputQty === '' ? undefined : Number(form.expectedOutputQty),
        notes: form.notes?.trim() || undefined,
      }

      const res = await fetch('/api/subcontract/knitting/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to issue to knitting')
      setSuccess(`Issued on DC. Subcontract Order: ${data.scNumber}`)
      setForm({ supplierId: '', inputSku: '', qtyKg: '', dcNo: '', gsm: '', widthCm: '', outputSku: '', expectedOutputQty: '', notes: '' })
      setRmOptions([])
      searchRawMaterials('')
      refreshIssues()
    } catch (e: any) {
      setError(e.message || 'Issue failed')
    } finally {
      setLoading(false)
    }
  }

  async function refreshIssues() {
    setLoadingIssues(true)
    try {
      const res = await fetch('/api/subcontract/issues?limit=50')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load issues')
      setIssues(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load DC list')
    } finally {
      setLoadingIssues(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Send to Knitting (Delivery Challan)</h1>

      <form onSubmit={onSubmit} className="rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Supplier</label>
            <div className="flex gap-2">
              <select
                required
                className="border rounded px-3 py-2 w-full"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplier_name}</option>
                ))}
              </select>
              <button type="button" className="px-3 py-2 border rounded" onClick={() => fetchSuppliers('')}>Refresh</button>
              <button type="button" className="px-3 py-2 border rounded" onClick={() => setAddingSupplier((v) => !v)}>New</button>
            </div>
            {addingSupplier && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  placeholder="New supplier name"
                  className="border rounded px-3 py-2 w-full"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createSupplier())}
                />
                <button type="button" className="px-3 py-2 rounded bg-black text-white" onClick={createSupplier}>Save</button>
                <button type="button" className="px-3 py-2 rounded border" onClick={() => { setAddingSupplier(false); setNewSupplier('') }}>Cancel</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">DC Number</label>
            <input required className="border rounded px-3 py-2 w-full" value={form.dcNo} onChange={(e) => setForm({ ...form, dcNo: e.target.value })} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Yarn (SKU)</label>
            <div className="flex gap-2">
              <input
                placeholder="Search SKU or name"
                className="border rounded px-3 py-2 w-full"
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchRawMaterials(searchSku))}
              />
              <button type="button" className="px-3 py-2 border rounded" onClick={() => searchRawMaterials(searchSku)}>Search</button>
            </div>
            <div className="mt-2">
              <select
                required
                className="border rounded px-3 py-2 w-full"
                value={form.inputSku}
                onChange={(e) => setForm({ ...form, inputSku: e.target.value })}
              >
                <option value="">Select yarn SKU</option>
                {rmOptions.map((r) => (
                  <option key={r.id} value={r.sku}>{r.sku} — {r.name}</option>
                ))}
              </select>
              {selectedRm && (
                <p className="text-xs text-gray-600 mt-1">On hand: {selectedRm.quantity_on_hand ?? '—'}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Quantity (kg)</label>
            <input required type="number" step="0.001" className="border rounded px-3 py-2 w-full" value={form.qtyKg} onChange={(e) => setForm({ ...form, qtyKg: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">GSM (optional)</label>
            <input type="number" step="0.01" className="border rounded px-3 py-2 w-full" value={form.gsm} onChange={(e) => setForm({ ...form, gsm: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Width (cm, optional)</label>
            <input type="number" step="0.1" className="border rounded px-3 py-2 w-full" value={form.widthCm} onChange={(e) => setForm({ ...form, widthCm: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Output SKU (optional)</label>
            <input placeholder="Default FAB-GREIGE" className="border rounded px-3 py-2 w-full" value={form.outputSku} onChange={(e) => setForm({ ...form, outputSku: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Expected Output Qty (m, optional)</label>
            <input type="number" step="0.001" className="border rounded px-3 py-2 w-full" value={form.expectedOutputQty} onChange={(e) => setForm({ ...form, expectedOutputQty: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <textarea className="border rounded px-3 py-2 w-full" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button disabled={loading} className="px-4 py-2 rounded bg-black text-white" type="submit">
            {loading ? 'Submitting…' : 'Issue to Knitting'}
          </button>
          <button type="button" className="px-4 py-2 rounded border" onClick={() => setForm({ supplierId: '', inputSku: '', qtyKg: '', dcNo: '', gsm: '', widthCm: '', outputSku: '', expectedOutputQty: '', notes: '' })}>Clear</button>
          <div className="ml-auto text-sm text-gray-600">Creates SC & logs DC</div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}
      </form>
      <section className="rounded-lg border p-4 space-y-3 mt-6">
        <div className="flex items-center">
          <h3 className="font-medium">Recent Delivery Challans</h3>
          <button type="button" className="ml-auto px-3 py-2 border rounded" onClick={refreshIssues}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">DC No</th>
                <th className="px-3 py-2">SC No</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Process</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingIssues ? (
                <tr><td className="px-3 py-4" colSpan={8}>Loading…</td></tr>
              ) : issues.length === 0 ? (
                <tr><td className="px-3 py-4" colSpan={8}>No DCs yet</td></tr>
              ) : (
                issues.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.created_at?.slice(0, 19).replace('T',' ')}</td>
                    <td className="px-3 py-2">{r.lot_no || '-'}</td>
                    <td className="px-3 py-2">{r.sc_number}</td>
                    <td className="px-3 py-2">{r.supplier_name}</td>
                    <td className="px-3 py-2">{r.process_name}</td>
                    <td className="px-3 py-2">{r.product_sku} — {r.product_name}</td>
                    <td className="px-3 py-2">{r.qty} {r.uom}</td>
                    <td className="px-3 py-2">{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
