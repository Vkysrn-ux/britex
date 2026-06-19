Inventory (Raw Materials) CRUD

Overview
- Adds REST API endpoints under `app/api/inventory/raw-materials` for listing, creating, updating, and deleting raw materials.
- Adds a simple UI at `app/inventory/page.tsx` to create, search, edit inline, and delete items.
- Uses MySQL via `mysql2` with a pooled connection defined in `lib/db.ts`.

Database
- Run the SQL scripts to create the schema and seed data:
  - `scripts/01-database-schema.sql`
  - `scripts/02-seed-data.sql`
- Default DB name is `mattress_erp`.

Environment
1) Copy `.env.local.example` to `.env.local` and set credentials:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mattress_erp
```

API Routes
- `GET  /api/inventory/raw-materials?search=&page=&pageSize=`
- `POST /api/inventory/raw-materials`  (body: sku, name, category, quantity_on_hand, reorder_level, unit_cost?, supplier_id?)
- `GET  /api/inventory/raw-materials/:id`
- `PUT  /api/inventory/raw-materials/:id` (any subset of fields to update)
- `DELETE /api/inventory/raw-materials/:id`

UI
- Visit `/inventory` to manage raw materials.
- Inline edit fields update on blur/change; delete with confirm; refresh and search supported.

