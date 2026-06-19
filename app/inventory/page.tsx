"use client"

import { useEffect, useMemo, useState } from 'react'

type RawMaterial = {
  id: number
  sku: string
  name: string
  category: 'foam' | 'fabric' | 'springs' | 'padding' | 'glue' | 'other'
  quantity_on_hand: number
  reorder_level: number
  unit_cost: number | null
  supplier_id: number | null
  status: 'active' | 'discontinued'
  created_at?: string
  updated_at?: string
}

const categories = ['foam', 'fabric', 'springs', 'padding', 'glue', 'other'] as const

export default function InventoryPage() {
  const [items, setItems] = useState<RawMaterial[]>([])
  const [finished, setFinished] = useState<Array<{ id:number; sku:string; name:string; size:string|null; product_type:string; quantity_on_hand:number }>>([])
  const [loading, setLoading] = useState(false)
  const [loadingFinished, setLoadingFinished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishedError, setFinishedError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'foam',
    quantity_on_hand: 0,
    reorder_level: 0,
    unit_cost: '',
    supplier_id: '',
  })

  const filteredItems = useMemo(() => items, [items])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      const res = await fetch(`/api/inventory/raw-materials?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setItems(data.data || [])
    } catch (e: any) {
      setError(e.message || 'Error loading inventory')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFinished() {
    setLoadingFinished(true)
    setFinishedError(null)
    try {
      const res = await fetch('/api/products/finished')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load finished products')
      setFinished(data.data || [])
    } catch (e:any) {
      setFinishedError(e.message || 'Error loading finished products')
    } finally {
      setLoadingFinished(false)
    }
  }

  useEffect(() => {
    fetchItems()
    fetchFinished()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const body = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category,
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        supplier_id: form.supplier_id === '' ? null : Number(form.supplier_id),
      }

      const res = await fetch('/api/inventory/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add item')
      setItems((prev) => [data.data, ...prev])
      setForm({ sku: '', name: '', category: 'foam', quantity_on_hand: 0, reorder_level: 0, unit_cost: '', supplier_id: '' })
    } catch (e: any) {
      setError(e.message || 'Error adding item')
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this item?')) return
    try {
      const res = await fetch(`/api/inventory/raw-materials/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete')
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  async function onInlineUpdate(id: number, patch: Partial<RawMaterial>) {
    try {
      const res = await fetch(`/api/inventory/raw-materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update')
      setItems((prev) => prev.map((x) => (x.id === id ? data.data : x)))
    } catch (e: any) {
      alert(e.message || 'Update failed')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Inventory — Raw Materials</h1>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium mb-3">Add Item</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            required
            placeholder="SKU"
            className="border rounded px-3 py-2"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <input
            required
            placeholder="Name"
            className="border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="border rounded px-3 py-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as any })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Quantity"
            className="border rounded px-3 py-2"
            value={form.quantity_on_hand}
            onChange={(e) => setForm({ ...form, quantity_on_hand: Number(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Reorder level"
            className="border rounded px-3 py-2"
            value={form.reorder_level}
            onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Unit cost"
            className="border rounded px-3 py-2"
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
          />
          <input
            type="number"
            placeholder="Supplier ID (optional)"
            className="border rounded px-3 py-2"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          />
          <div className="md:col-span-3 flex gap-2">
            <button className="px-4 py-2 rounded bg-black text-white" type="submit">Add</button>
            <button className="px-4 py-2 rounded border" type="button" onClick={fetchItems}>Refresh</button>
            <input
              placeholder="Search SKU or Name"
              className="ml-auto border rounded px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
            />
          </div>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </section>

      <section className="rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Reorder</th>
              <th className="px-3 py-2">Unit Cost</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4" colSpan={8}>Loading...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td className="px-3 py-4" colSpan={8}>No items</td></tr>
            ) : (
              filteredItems.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">
                    <input className="border rounded px-2 py-1 w-36" defaultValue={it.sku}
                      onBlur={(e) => e.target.value !== it.sku && onInlineUpdate(it.id, { sku: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input className="border rounded px-2 py-1 w-60" defaultValue={it.name}
                      onBlur={(e) => e.target.value !== it.name && onInlineUpdate(it.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select className="border rounded px-2 py-1"
                      defaultValue={it.category}
                      onChange={(e) => onInlineUpdate(it.id, { category: e.target.value as any })}
                    >
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="border rounded px-2 py-1 w-24" defaultValue={it.quantity_on_hand}
                      onBlur={(e) => onInlineUpdate(it.id, { quantity_on_hand: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="border rounded px-2 py-1 w-24" defaultValue={it.reorder_level}
                      onBlur={(e) => onInlineUpdate(it.id, { reorder_level: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" className="border rounded px-2 py-1 w-28" defaultValue={it.unit_cost ?? ''}
                      onBlur={(e) => onInlineUpdate(it.id, { unit_cost: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select className="border rounded px-2 py-1" defaultValue={it.status}
                      onChange={(e) => onInlineUpdate(it.id, { status: e.target.value as any })}
                    >
                      <option value="active">active</option>
                      <option value="discontinued">discontinued</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button className="text-red-600 hover:underline" onClick={() => onDelete(it.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center">
          <h2 className="font-medium">Inventory — Finished Products</h2>
          <button className="ml-auto px-3 py-2 border rounded" type="button" onClick={fetchFinished}>Refresh</button>
        </div>
        {finishedError && <p className="text-sm text-red-600 mb-2">{finishedError}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {loadingFinished ? (
                <tr><td className="px-3 py-4" colSpan={4}>Loading…</td></tr>
              ) : finished.length === 0 ? (
                <tr><td className="px-3 py-4" colSpan={4}>No finished products</td></tr>
              ) : (
                finished.map(fp => (
                  <tr key={fp.id} className="border-t">
                    <td className="px-3 py-2">{fp.sku}</td>
                    <td className="px-3 py-2">{fp.name}</td>
                    <td className="px-3 py-2">{fp.size ?? '-'}</td>
                    <td className="px-3 py-2">{fp.quantity_on_hand}</td>
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


