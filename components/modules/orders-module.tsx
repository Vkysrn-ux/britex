"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OrderForm from "@/components/forms/order-form";
import { Button } from "@/components/ui/button";

type FinishedProduct = { id: number; sku: string; name: string; size?: string; quantity_on_hand?: number };

export default function OrdersModule() {
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products/finished")
      .then((r) => r.json())
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, []);

  const priceMap = useMemo(() => {
    // Placeholder pricing: in real app, fetch pricing; default 0
    const map = new Map<number, number>();
    products.forEach((p) => map.set(p.id, 0));
    return map;
  }, [products]);

  const handleSubmit = async (order: any) => {
    // Map OrderForm payload to API schema
    const items = order.items.map((it: any) => ({
      finished_product_id: it.productId,
      quantity_ordered: it.ordered,
      unit_price: it.price ?? priceMap.get(it.productId) ?? 0,
    }));
    const payload = {
      customer_name: order.customer,
      customer_email: order.customerEmail || null,
      customer_phone: order.customerPhone || null,
      notes: order.notes || null,
      items,
    };
    setSubmitting(true);
    setMessage(null);
    try {
      const resp = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to create order");
      setMessage(`Order ${data?.data?.order_number || "created"} saved.`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border-orange-200">
        <CardHeader>
          <CardTitle className="text-black">Create Customer Order</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-black mb-4">
            Fill customer details and add finished products. Submits to /api/orders.
          </p>
          <OrderForm onSubmit={handleSubmit} onCancel={() => {}} />
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
    </div>
  );
}
