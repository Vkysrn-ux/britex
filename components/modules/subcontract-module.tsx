"use client"

import { useEffect, useMemo, useState } from 'react'

type Supplier = { id: number; supplier_name: string }
type RawMaterial = { id: number; sku: string; name: string; unit?: string; quantity_on_hand?: number }

export default function SubcontractModule() {
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
  const [forwardRow, setForwardRow] = useState<any | null>(null)
  const [forwardForm, setForwardForm] = useState({
    nextProcess: 'washing',
    qty: '',
    plannedLossPercent: '2',
    dateSent: '',
    outputSku: '',
    dcSuffix: '1',
  })
  const [receiveRow, setReceiveRow] = useState<any | null>(null)
  const [receiveForm, setReceiveForm] = useState({ qty: '', wasteQty: '', date: '', note: '' })

  function baseDcNoFrom(lot: string | null | undefined) {
    if (!lot) return 'DC'
    const parts = String(lot).split('-')
    // Base is the segment before the first hyphen
    return parts[0]
  }

  function computeNextSuffix(base: string, list: any[]) {
    let maxSuffix = 0
    for (const x of list) {
      const lot = String(x.lot_no || '')
      if (!lot.startsWith(base)) continue
      const rest = lot.slice(base.length)
      if (!rest) { maxSuffix = Math.max(maxSuffix, 0); continue }
      if (!rest.startsWith('-')) continue
      const numStr = rest.slice(1)
      const num = Number(numStr)
      if (!Number.isNaN(num)) maxSuffix = Math.max(maxSuffix, num)
    }
    return String(maxSuffix + 1)
  }

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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Subcontracting</h2>

      <section className="rounded-lg border p-4 space-y-4">
        <h3 className="font-medium">Send to Knitting (Delivery Challan)</h3>

        <form onSubmit={onSubmit} className="space-y-3">
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
      </section>

      <section className="rounded-lg border p-4 space-y-3">
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
                <th className="px-3 py-2">Loss %</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingIssues ? (
                <tr><td className="px-3 py-4" colSpan={9}>Loading…</td></tr>
              ) : issues.length === 0 ? (
                <tr><td className="px-3 py-4" colSpan={9}>No DCs yet</td></tr>
              ) : (
                issues.map((r: any) => {
                  const base = baseDcNoFrom(r.lot_no)
                  const hasNextAfterKnitting = issues.some((x:any)=> baseDcNoFrom(x.lot_no) === base && x.process_name !== 'knitting')
                  const hasLamination = issues.some((x:any)=> baseDcNoFrom(x.lot_no) === base && x.process_name === 'lamination')
                  let showForward = false
                  let showComplete = false
                  let showConvert = false
                  if (r.status === 'issued') {
                    if (r.process_name === 'knitting') showForward = !hasNextAfterKnitting
                    else if (r.process_name === 'washing_dyeing') { showForward = !hasLamination; showConvert = true }
                    else showForward = false
                    if (r.process_name === 'lamination') showComplete = true
                  }
                  return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.created_at?.slice(0, 19).replace('T',' ')}</td>
                    <td className="px-3 py-2">{r.lot_no || '-'}</td>
                    <td className="px-3 py-2">{r.sc_number}</td>
                    <td className="px-3 py-2">{r.supplier_name}</td>
                    <td className="px-3 py-2">{r.process_name}</td>
                    <td className="px-3 py-2">{r.product_sku} — {r.product_name}</td>
                    <td className="px-3 py-2">{r.qty} {r.uom}</td>
                    <td className="px-3 py-2">{r.process_name==='washing_dyeing' ? (r.planned_loss_percent ?? '-') : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{(r.process_name === 'knitting' && hasNextAfterKnitting) ? 'completed' : (r.process_name==='lamination' && r.status==='received') ? 'completed' : r.status}</span>
                        {showForward && (
                          <button
                            type="button"
                            className="px-2 py-1 text-xs border rounded"
                            onClick={() => {
                              setError(null); setSuccess(null);
                              setForwardRow(r);
                              const suggested = computeNextSuffix(base, issues)
                              // default planned loss 2% for washing; qty will be adjusted below in UI
                              const loss = 2
                              const adjusted = Number((Number(r.qty) * (1 - loss/100)).toFixed(3))
                              setForwardForm({ nextProcess: 'washing', qty: String(adjusted), plannedLossPercent: String(loss), dateSent: new Date().toISOString().slice(0,10), outputSku: '', dcSuffix: suggested })
                            }}
                          >Forward</button>
                        )}
                        {showConvert && (
                          <button
                            type="button"
                            className="px-2 py-1 text-xs border rounded"
                            onClick={async ()=>{
                              try{
                                setError(null); setSuccess(null)
                                const res = await fetch('/api/subcontract/convert',{
                                  method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                                    scNumber: r.sc_number,
                                    qtyKg: Number(r.uom==='kg'? r.qty : r.qty),
                                    factor: 2.6,
                                    note: `Direct convert from washing for ${r.lot_no}`,
                                  })
                                })
                                const data = await res.json()
                                if(!res.ok) throw new Error(data?.error||'Convert failed')
                                setSuccess(`Converted to inventory: ${data.meters} m`)
                                refreshIssues()
                              }catch(e:any){ setError(e.message||'Convert failed') }
                            }}
                          >Convert</button>
                        )}
                        {showComplete && (
                          <button
                            type="button"
                            className="px-2 py-1 text-xs border rounded"
                            onClick={() => {
                              setError(null); setSuccess(null);
                              setReceiveRow(r)
                              setReceiveForm({ qty: String(r.qty), wasteQty: '', date: new Date().toISOString().slice(0,10), note: '' })
                            }}
                          >Complete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {forwardRow && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <strong>Forward DC {forwardRow.lot_no} to next process</strong>
              <button className="ml-auto text-sm underline" type="button" onClick={() => setForwardRow(null)}>Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1">Next Process</label>
                <select className="border rounded px-3 py-2 w-full" value={forwardForm.nextProcess} onChange={(e)=> setForwardForm({...forwardForm, nextProcess: e.target.value})}>
                  <option value="washing">Washing</option>
                  <option value="dyeing">Dyeing</option>
                  <option value="lamination">Lamination</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Qty to Send {forwardForm.nextProcess==='washing' ? '(kg)' : ''}</label>
                <input className="border rounded px-3 py-2 w-full" value={forwardForm.qty} onChange={(e)=> setForwardForm({...forwardForm, qty: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">DC Suffix</label>
                <input className="border rounded px-3 py-2 w-full" value={forwardForm.dcSuffix} onChange={(e)=> setForwardForm({...forwardForm, dcSuffix: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Date Sent</label>
                <input type="date" className="border rounded px-3 py-2 w-full" value={forwardForm.dateSent} onChange={(e)=> setForwardForm({...forwardForm, dateSent: e.target.value})} />
              </div>
              {forwardForm.nextProcess === 'washing' && (
                <div>
                  <label className="block text-sm mb-1">Planned Loss % (1-3)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    max={3}
                    className="border rounded px-3 py-2 w-full"
                    value={forwardForm.plannedLossPercent}
                    onChange={(e)=> {
                      const v = e.target.value
                      let num = Number(v)
                      if (Number.isNaN(num)) num = 2
                      if (num < 1) num = 1
                      if (num > 3) num = 3
                      // Recompute qty from the base row qty when loss changes
                      const baseQty = Number(forwardRow?.qty || 0)
                      const adjusted = baseQty ? Number((baseQty * (1 - num/100)).toFixed(3)) : 0
                      setForwardForm({...forwardForm, plannedLossPercent: String(num), qty: String(adjusted)})
                    }}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Output SKU (optional)</label>
                <input className="border rounded px-3 py-2 w-full" placeholder="leave same as input" value={forwardForm.outputSku} onChange={(e)=> setForwardForm({...forwardForm, outputSku: e.target.value})} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-black text-white"
                onClick={async ()=>{
                  try{
                    setError(null); setSuccess(null);
                    const res = await fetch('/api/subcontract/forward',{
                      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                        prevScNumber: forwardRow.sc_number,
                        nextProcess: forwardForm.nextProcess,
                        // send baseQty (original knitting qty) and computed qty
                        baseQty: Number(forwardRow.qty||0),
                        qty: Number(forwardForm.qty||0),
                        baseDcNo: baseDcNoFrom(forwardRow.lot_no),
                        dcSuffix: Number(forwardForm.dcSuffix||1),
                        plannedLossPercent: forwardForm.nextProcess==='washing'? Number(forwardForm.plannedLossPercent||2): 0,
                        dateSent: forwardForm.dateSent || undefined,
                        outputSku: forwardForm.outputSku || undefined,
                        notes: `Forward from ${forwardRow.sc_number} / ${forwardRow.lot_no}`,
                      })
                    })
                    const data = await res.json()
                    if(!res.ok) throw new Error(data?.error||'Forward failed')
                    setSuccess(`Forwarded on ${data.dcNo}. New SC: ${data.scNumber}`)
                    setForwardRow(null)
                    refreshIssues()
                  }catch(e:any){ setError(e.message||'Forward failed') }
                }}
              >Forward</button>
              <button type="button" className="px-4 py-2 rounded border" onClick={()=> setForwardRow(null)}>Cancel</button>
            </div>
          </div>
        )}
        {receiveRow && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <strong>Complete {receiveRow.sc_number} ({receiveRow.lot_no})</strong>
              <button className="ml-auto text-sm underline" type="button" onClick={() => setReceiveRow(null)}>Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm mb-1">Output Qty</label>
                <input className="border rounded px-3 py-2 w-full" value={receiveForm.qty} onChange={(e)=> setReceiveForm({...receiveForm, qty: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Waste Qty</label>
                <input className="border rounded px-3 py-2 w-full" value={receiveForm.wasteQty} onChange={(e)=> setReceiveForm({...receiveForm, wasteQty: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Date</label>
                <input type="date" className="border rounded px-3 py-2 w-full" value={receiveForm.date} onChange={(e)=> setReceiveForm({...receiveForm, date: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm mb-1">Note</label>
                <input className="border rounded px-3 py-2 w-full" value={receiveForm.note} onChange={(e)=> setReceiveForm({...receiveForm, note: e.target.value})} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-black text-white"
                onClick={async ()=>{
                  try{
                    setError(null); setSuccess(null)
                    const res = await fetch('/api/subcontract/receive',{
                      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                        scNumber: receiveRow.sc_number,
                        qty: Number(receiveForm.qty||0),
                        wasteQty: Number(receiveForm.wasteQty||0) || 0,
                        lotNo: receiveRow.lot_no,
                        note: receiveForm.note || undefined,
                      })
                    })
                    const data = await res.json()
                    if(!res.ok) throw new Error(data?.error||'Complete failed')
                    setSuccess('Completed and moved to inventory')
                    setReceiveRow(null)
                    refreshIssues()
                  }catch(e:any){ setError(e.message||'Complete failed') }
                }}
              >Save</button>
              <button type="button" className="px-4 py-2 rounded border" onClick={()=> setReceiveRow(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
