"use client"
import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"

type Product = { id: number; name: string; sku: string; price?: number }

interface OrderFormProps {
  onSubmit: (order: any) => void
  onCancel: () => void
}

export default function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const [formData, setFormData] = useState({
    customer: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
  })
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetch("/api/products/finished")
      .then((r) => r.json())
      .then((res) => {
        const list = (res.data || []).map((p: any) => ({
          id: p.id,
          name: `${p.name} (${p.sku})`,
          sku: p.sku,
          price: 0, // real price could be fetched from pricing table
        })) as Product[]
        setProducts(list)
      })
      .catch(() => setProducts([]))
  }, [])

  const priceMap = useMemo(() => {
    const map = new Map<number, number>()
    products.forEach((p) => map.set(p.id, p.price ?? 0))
    return map
  }, [products])

  const handleAddItem = () => {
    if (!selectedProduct || quantity < 1) return
    const product = products.find((p) => p.id === Number.parseInt(selectedProduct))
    if (!product) return
    const newItem = {
      productId: product.id,
      productName: product.name,
      ordered: quantity,
      shipped: 0,
      price: priceMap.get(product.id) ?? 0,
    }
    setItems([...items, newItem])
    setSelectedProduct("")
    setQuantity(1)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + item.ordered * item.price, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer || items.length === 0) return
    const newOrder = {
      customer: formData.customer,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      total: total,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      shipDate: null,
      expectedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      items: items,
      notes: formData.notes,
    }
    onSubmit(newOrder)
  }

  return (
    <Card className="bg-white border-orange-200 mb-6">
      <CardHeader>
        <CardTitle className="text-black">Create New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-black">Customer Name *</label>
              <Input
                required
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                placeholder="Enter customer name"
                className="bg-white border-orange-200 text-black mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-black">Email</label>
              <Input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                placeholder="customer@example.com"
                className="bg-white border-orange-200 text-black mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-black">Phone</label>
              <Input
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                placeholder="555-0000"
                className="bg-white border-orange-200 text-black mt-1"
              />
            </div>
          </div>

          <div className="border border-orange-200 rounded p-4 space-y-3">
            <h3 className="font-semibold text-black">Add Order Items</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-black">Product *</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-white border border-orange-200 text-black rounded px-2 py-2 text-sm mt-1"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-black">Quantity *</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value) || 1))}
                  className="bg-white border-orange-200 text-black mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Add Item
                </Button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-orange-200 rounded p-4 space-y-3">
              <h3 className="font-semibold text-black">Order Items</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                    <div className="flex-1">
                      <p className="text-black">{item.productName}</p>
                      <p className="text-black">Qty: {item.ordered} @ ${item.price.toFixed(2)}</p>
                    </div>
                    <p className="text-black font-semibold mr-4">${(item.ordered * item.price).toFixed(2)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-black hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t border-orange-200 pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-black">Total:</span>
                  <span className="text-black">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-black">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any special instructions or notes..."
              className="w-full bg-white border border-orange-200 text-black rounded p-2 mt-1"
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" onClick={onCancel} variant="outline" className="border-orange-200 text-black bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.customer || items.length === 0} className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
              Create Order
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
