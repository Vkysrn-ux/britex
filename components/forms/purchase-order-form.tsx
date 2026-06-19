"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

type Supplier = { id: number; supplier_name: string }
type RawMaterial = { id: number; sku: string; name: string; unit?: string; category?: string }

interface PurchaseOrderFormProps {
  onSubmit: (po: any) => void
  onCancel: () => void
}

export default function PurchaseOrderForm({ onSubmit, onCancel }: PurchaseOrderFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const supplierBoxRef = useRef<HTMLDivElement | null>(null)
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState<string>('')
  const [notes, setNotes] = useState('')

  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [qty, setQty] = useState(1)
  const [unitCost, setUnitCost] = useState<number>(0)
  const [items, setItems] = useState<any[]>([])
  const [showCreateMaterial, setShowCreateMaterial] = useState(false)
  const formatINR = useMemo(
    () => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }),
    []
  )

  // Load supplier suggestions when typing
  useEffect(() => {
    const controller = new AbortController()
    const q = supplierQuery.trim()
    fetch(`/api/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setSuppliers(res.data || []))
      .catch(() => setSuppliers([]))
    return () => controller.abort()
  }, [supplierQuery])

  const [materialQuery, setMaterialQuery] = useState('')
  const [materialOpen, setMaterialOpen] = useState(false)
  const materialBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const q = materialQuery.trim()
    const url = `/api/inventory/raw-materials?search=${encodeURIComponent(q)}&page=1&pageSize=10`
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setMaterials(res.data || []))
      .catch(() => setMaterials([]))
    return () => controller.abort()
  }, [materialQuery])

  const handleAddItem = async () => {
    let matId = selectedMaterial
    const typed = materialQuery.trim()
    // If user typed but didn't pick, try to infer
    if (!matId && typed) {
      if (materials.length > 0) {
        matId = String(materials[0].id)
        setSelectedMaterial(matId)
        setMaterialQuery(`${materials[0].name} (${materials[0].sku})`)
      } else {
        // Try to extract SKU in parentheses or last token and query once
        const skuMatch = typed.match(/\(([^)]+)\)/)
        const probe = skuMatch?.[1] || typed.split(/\s+/).pop() || typed
        try {
          const r = await fetch(`/api/inventory/raw-materials?search=${encodeURIComponent(probe)}&page=1&pageSize=1`)
          const j = await r.json()
          const found = Array.isArray(j.data) && j.data.length ? j.data[0] : null
          if (found) {
            matId = String(found.id)
            setSelectedMaterial(matId)
            setMaterials([found])
            setMaterialQuery(`${found.name} (${found.sku})`)
          } else if (typed) {
            // Create material on-the-fly from typed text (name (sku))
            const sku = skuMatch?.[1] || `${Date.now()}`
            const name = typed.replace(/\([^)]*\)/g, '').trim() || `Material ${sku}`
            const lower = name.toLowerCase()
            const category = lower.includes('yarn') ? 'yarn' : lower.includes('zip') ? 'zip' : 'other'
            const resp = await fetch('/api/inventory/raw-materials', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sku, name, category, unit: category === 'yarn' ? 'kg' : category === 'zip' ? 'piece' : 'piece', reorder_level: 0, status: 'active' }),
            })
            const data = await resp.json()
            if (resp.ok) {
              matId = String(data.data.id)
              setSelectedMaterial(matId)
              setMaterials([data.data])
              setMaterialQuery(`${data.data.name} (${data.data.sku})`)
            }
          }
        } catch {}
      }
    }
    if (!matId || qty <= 0) {
      if (!materials.length && typed) setShowCreateMaterial(true)
      return
    }
    const m = materials.find((x) => x.id === Number.parseInt(matId))
    if (!m) {
      // As a last resort fetch by id then add
      try {
        const r = await fetch(`/api/inventory/raw-materials/${matId}`)
        const j = await r.json()
        const mat = j?.data
        if (!mat) return
        setMaterials([mat])
        const unitDisplay = (mat.category || '').toLowerCase() === 'yarn' ? 'kg' : 'nos'
        setItems([
          ...items,
          { raw_material_id: mat.id, name: `${mat.name} (${mat.sku})`, quantity_ordered: qty, unit_cost: unitCost || 0, unit_display: unitDisplay },
        ])
      } catch {
        return
      }
    } else {
      const unitDisplay = (m.category || '').toLowerCase() === 'yarn' ? 'kg' : 'nos'
      setItems([
        ...items,
        {
          raw_material_id: m.id,
          name: `${m.name} (${m.sku})`,
          quantity_ordered: qty,
          unit_cost: unitCost || 0,
          unit_display: unitDisplay,
        },
      ])
    }
    setSelectedMaterial('')
    setQty(1)
    setUnitCost(0)
  }

  const handleRemove = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const total = useMemo(() => items.reduce((s, it) => s + it.quantity_ordered * (it.unit_cost || 0), 0), [items])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!items.length || !supplierQuery.trim()) return
    let sid = supplierId
    if (!sid) {
      try {
        const resp = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier_name: supplierQuery.trim() }),
        })
        const data = await resp.json()
        if (resp.ok) {
          sid = String(data.data.id)
          setSupplierId(sid)
          setSupplierQuery(data.data.supplier_name)
        } else {
          return
        }
      } catch {
        return
      }
    }
    onSubmit({
      supplier_id: Number.parseInt(sid),
      order_date: orderDate,
      expected_delivery_date: expectedDate || null,
      notes: notes || null,
      items: items.map((it) => ({
        raw_material_id: it.raw_material_id,
        quantity_ordered: it.quantity_ordered,
        unit_cost: it.unit_cost || 0,
      })),
    })
  }

  return (
    <Card className="bg-white border-orange-200 mb-6">
      <CardHeader>
        <CardTitle className="text-black">Create Purchase Order (Raw Materials)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative" ref={supplierBoxRef}>
              <label className="text-sm text-black">Supplier *</label>
              <Input
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value)
                  setSupplierOpen(true)
                }}
                onFocus={() => setSupplierOpen(true)}
                placeholder="Type supplier name..."
                className="w-full bg-white border border-orange-200 text-black rounded px-2 py-2 text-sm mt-1"
              />
              {supplierOpen && (
                <div className="absolute z-10 bg-white border border-orange-200 rounded mt-1 w-full max-h-48 overflow-auto">
                  {suppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-orange-50 text-black"
                      onClick={() => {
                        setSupplierId(String(s.id))
                        setSupplierQuery(s.supplier_name)
                        setSupplierOpen(false)
                      }}
                    >
                      {s.supplier_name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="block w-full text-left px-3 py-2 hover:bg-orange-50 text-black"
                    onClick={async () => {
                      if (!supplierQuery.trim()) return
                      const resp = await fetch('/api/suppliers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ supplier_name: supplierQuery.trim() }),
                      })
                      const data = await resp.json()
                      if (resp.ok) {
                        setSupplierId(String(data.data.id))
                        setSupplierQuery(data.data.supplier_name)
                        setSupplierOpen(false)
                      }
                    }}
                  >
                    Create "{supplierQuery.trim()}"
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-black">Order Date</label>
              <Input value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="bg-white border-orange-200 text-black mt-1" type="date" />
            </div>
            <div>
              <label className="text-sm text-black">Expected Delivery</label>
              <Input value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="bg-white border-orange-200 text-black mt-1" type="date" />
            </div>
            <div>
              <label className="text-sm text-black">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-white border-orange-200 text-black mt-1" placeholder="Optional" />
            </div>
          </div>

          <div className="border border-orange-200 rounded p-4 space-y-3">
            <h3 className="font-semibold text-black">Add Raw Materials</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2 relative" ref={materialBoxRef}>
                <label className="text-xs font-medium text-black">Material *</label>
                <Input
                  value={materialQuery}
                  onChange={(e) => {
                    setMaterialQuery(e.target.value)
                    setMaterialOpen(true)
                  }}
                  onFocus={() => setMaterialOpen(true)}
                  placeholder="Type to search material..."
                  className="w-full bg-white border border-orange-200 text-black rounded px-2 py-2 text-sm mt-1"
                />
                {materialOpen && (
                  <div className="absolute z-10 bg-white border border-orange-200 rounded mt-1 w-full max-h-48 overflow-auto">
                    {materials.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="block w-full text-left px-3 py-2 hover:bg-orange-50 text-black"
                        onClick={() => {
                          setSelectedMaterial(String(m.id))
                          setMaterialQuery(`${m.name} (${m.sku})`)
                          setMaterialOpen(false)
                        }}
                      >
                        {m.name} ({m.sku}) {m.unit ? `• ${m.unit}` : ''}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-orange-50 text-black"
                      onClick={() => setShowCreateMaterial(true)}
                    >
                      Create new material "{materialQuery.trim()}"
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-black">
                  Qty {(() => {
                    const m = materials.find((x) => x.id === Number.parseInt(selectedMaterial || ''))
                    const cat = (m?.category || '').toLowerCase()
                    if (cat === 'yarn') return '(kg)'
                    return '(nos)'
                  })()}
                </label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value) || 1))} className="bg-white border-orange-200 text-black mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-black">Unit Cost</label>
                <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} className="bg-white border-orange-200 text-black mt-1" />
              </div>
              <div>
                <Button type="button" onClick={handleAddItem} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                  Add Item
                </Button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-orange-200 rounded p-4 space-y-3">
              <h3 className="font-semibold text-black">PO Items</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                    <div className="flex-1">
                      <p className="text-black">{it.name}</p>
                      <p className="text-black">Qty: {it.quantity_ordered} {it.unit_display || ''} @ {formatINR.format(Number(it.unit_cost || 0))}</p>
                    </div>
                    <p className="text-black font-semibold mr-4">{formatINR.format((it.quantity_ordered * (it.unit_cost || 0)) as number)}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(idx)} className="text-black">
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t border-orange-200 pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-black">Total:</span>
                  <span className="text-black">{formatINR.format(total)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button type="button" onClick={onCancel} variant="outline" className="border-orange-200 text-black bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={!supplierQuery.trim() || items.length === 0} className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
              Create Purchase Order
            </Button>
          </div>
        </form>
      </CardContent>
      <CreateMaterialDialog
        open={showCreateMaterial}
        onOpenChange={setShowCreateMaterial}
        initialName={materialQuery.trim()}
        defaultSupplierId={supplierId ? Number.parseInt(supplierId) : undefined}
        onCreated={(mat) => {
          setSelectedMaterial(String(mat.id))
          setMaterialQuery(`${mat.name} (${mat.sku})`)
          setMaterialOpen(false)
        }}
      />
    </Card>
  )
}

function CreateMaterialDialog({
  open,
  onOpenChange,
  initialName,
  defaultSupplierId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialName?: string
  defaultSupplierId?: number
  onCreated: (mat: any) => void
}) {
  const [name, setName] = useState(initialName || '')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState<'foam'|'fabric'|'springs'|'padding'|'glue'|'thread'|'yarn'|'zip'|'cover'|'other'>('other')
  const [unit, setUnit] = useState('piece')
  const [reorder, setReorder] = useState(0)
  const [unitCost, setUnitCost] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(initialName || '')
  }, [initialName])

  const save = async () => {
    if (!name.trim() || !sku.trim()) return
    setSaving(true)
    try {
      const resp = await fetch('/api/inventory/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim(),
          name: name.trim(),
          category,
          unit,
          reorder_level: reorder,
          unit_cost: unitCost || 0,
          supplier_id: defaultSupplierId ?? null,
          status: 'active',
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to create material')
      onCreated(data.data)
      onOpenChange(false)
    } catch (e) {
      // no-op
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Raw Material</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-black">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-orange-200 text-black mt-1" />
          </div>
          <div>
            <label className="text-xs text-black">SKU *</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} className="bg-white border-orange-200 text-black mt-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-black">Category</label>
              <select value={category} onChange={(e) => {
                const val = e.target.value as any
                setCategory(val)
                if (val === 'yarn') setUnit('kg')
                else if (val === 'zip') setUnit('piece')
              }} className="w-full bg-white border border-orange-200 text-black rounded px-2 py-2 text-sm mt-1">
                {['foam','fabric','springs','padding','glue','thread','yarn','zip','cover','other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-black">Unit</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-white border-orange-200 text-black mt-1" placeholder="e.g., kg, m, piece" />
            </div>
            <div>
              <label className="text-xs text-black">Reorder Level</label>
              <Input type="number" min="0" value={reorder} onChange={(e) => setReorder(Math.max(0, Number.parseInt(e.target.value) || 0))} className="bg-white border-orange-200 text-black mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-black">Unit Cost</label>
            <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} className="bg-white border-orange-200 text-black mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-orange-200 text-black" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={save} disabled={saving || !name.trim() || !sku.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
