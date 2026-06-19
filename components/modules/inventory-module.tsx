"use client";

// Render the full Inventory page inside the dashboard module slot.
// This surfaces the working CRUD UI instead of the temporary placeholder.
import InventoryPage from "@/app/inventory/page";

export default function InventoryModule() {
  return <InventoryPage />;
}
