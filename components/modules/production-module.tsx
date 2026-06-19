"use client";

// Render the full Production page inside the dashboard module slot.
// This surfaces the working CRUD UI instead of the temporary placeholder.
import ProductionPage from "@/app/production/page";

export default function ProductionModule() {
  return <ProductionPage />;
}

