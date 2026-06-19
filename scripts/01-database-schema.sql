-- PostgreSQL schema for mattress ERP
-- All tables use IF NOT EXISTS for idempotency

-- Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
'BEGIN NEW.updated_at = NOW(); RETURN NEW; END;';

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role TEXT NOT NULL CHECK (role IN ('admin','manager','production','sales','warehouse','quality')),
  department VARCHAR(100),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_user_role ON users(role);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  supplier_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  payment_terms VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- Raw Materials
CREATE TABLE IF NOT EXISTS raw_materials (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('foam','fabric','springs','padding','glue','thread','yarn','zip','cover','other')),
  unit VARCHAR(20) NOT NULL DEFAULT 'piece',
  quantity_on_hand DECIMAL(12,3) DEFAULT 0,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2),
  supplier_id INT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','discontinued')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_raw_materials_updated_at ON raw_materials;
CREATE TRIGGER trg_raw_materials_updated_at BEFORE UPDATE ON raw_materials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_raw_material_sku ON raw_materials(sku);
CREATE INDEX IF NOT EXISTS idx_raw_material_category ON raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_material_status ON raw_materials(status);

-- Finished Products
CREATE TABLE IF NOT EXISTS finished_products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('mattress','pillow','sofa_bed','latex_product')),
  size VARCHAR(50),
  firmness_level VARCHAR(50),
  quantity_on_hand DECIMAL(12,3) DEFAULT 0,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','discontinued')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_finished_products_updated_at ON finished_products;
CREATE TRIGGER trg_finished_products_updated_at BEFORE UPDATE ON finished_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_finished_product_sku ON finished_products(sku);
CREATE INDEX IF NOT EXISTS idx_finished_product_type ON finished_products(product_type);
CREATE INDEX IF NOT EXISTS idx_finished_product_status ON finished_products(status);

-- Customer Orders
CREATE TABLE IF NOT EXISTS customer_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','packaged','shipped','delivered','cancelled')),
  total_amount DECIMAL(12,2),
  order_date TIMESTAMPTZ DEFAULT NOW(),
  ship_date DATE,
  expected_delivery_date DATE,
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_customer_orders_updated_at ON customer_orders;
CREATE TRIGGER trg_customer_orders_updated_at BEFORE UPDATE ON customer_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON customer_orders(customer_name);

-- Customer Order Items
CREATE TABLE IF NOT EXISTS customer_order_items (
  id SERIAL PRIMARY KEY,
  customer_order_id INT NOT NULL REFERENCES customer_orders(id),
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  quantity_ordered INT NOT NULL,
  quantity_shipped INT DEFAULT 0,
  unit_price DECIMAL(10,2),
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound Shipments
CREATE TABLE IF NOT EXISTS outbound_shipments (
  id SERIAL PRIMARY KEY,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('customer','showroom','warehouse')),
  destination_ref VARCHAR(255),
  status TEXT DEFAULT 'shipped' CHECK (status IN ('draft','shipped')),
  ship_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound Shipment Lines
CREATE TABLE IF NOT EXISTS outbound_shipment_lines (
  id SERIAL PRIMARY KEY,
  shipment_id INT NOT NULL REFERENCES outbound_shipments(id),
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  quantity DECIMAL(12,3) NOT NULL,
  customer_order_id INT REFERENCES customer_orders(id),
  customer_order_item_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Item Reservations
CREATE TABLE IF NOT EXISTS order_item_reservations (
  customer_order_item_id INT NOT NULL REFERENCES customer_order_items(id),
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  qty_reserved INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_order_item_id, finished_product_id)
);

-- Bill of Materials
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id SERIAL PRIMARY KEY,
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  quantity_required DECIMAL(10,2),
  uom VARCHAR(20),
  calc_method TEXT DEFAULT 'fixed' CHECK (calc_method IN ('fixed','per_area','per_length')),
  factor DECIMAL(10,4),
  waste_percent DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (finished_product_id, raw_material_id)
);

-- Product Size Specs
CREATE TABLE IF NOT EXISTS product_size_specs (
  id SERIAL PRIMARY KEY,
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  width_cm DECIMAL(10,2) NOT NULL,
  length_cm DECIMAL(10,2) NOT NULL,
  height_cm DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (finished_product_id)
);

-- Production Orders
CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  finished_product_id INT NOT NULL REFERENCES finished_products(id),
  quantity_ordered INT NOT NULL,
  quantity_produced INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  start_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  assigned_to INT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_production_orders_updated_at ON production_orders;
CREATE TRIGGER trg_production_orders_updated_at BEFORE UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_priority ON production_orders(priority);
CREATE INDEX IF NOT EXISTS idx_production_date_status ON production_orders(status, expected_completion_date);

-- Production Logs
CREATE TABLE IF NOT EXISTS production_logs (
  id SERIAL PRIMARY KEY,
  production_order_id INT NOT NULL REFERENCES production_orders(id),
  production_date DATE NOT NULL,
  quantity_produced INT NOT NULL,
  batch_number VARCHAR(50),
  quality_check_passed INT DEFAULT 0,
  defects_found INT DEFAULT 0,
  notes TEXT,
  logged_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_production_logs_date ON production_logs(production_date);
CREATE INDEX IF NOT EXISTS idx_production_logs_order ON production_logs(production_order_id);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','received','partial','cancelled')),
  total_cost DECIMAL(12,2),
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INT NOT NULL REFERENCES purchase_orders(id),
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  quantity_ordered INT NOT NULL,
  quantity_received INT DEFAULT 0,
  unit_cost DECIMAL(10,2),
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality Inspections
CREATE TABLE IF NOT EXISTS quality_inspections (
  id SERIAL PRIMARY KEY,
  inspection_date DATE NOT NULL,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('raw_material','in_process','finished_product')),
  product_id INT NOT NULL,
  batch_number VARCHAR(50),
  quantity_inspected INT,
  quantity_passed INT,
  quantity_failed INT,
  defect_types TEXT,
  inspector_id INT REFERENCES users(id),
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('passed','failed','pending_review')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_date ON quality_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_type ON quality_inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_status ON quality_inspections(status);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase','production','adjustment','damage','sale','subcontract_issue','subcontract_receipt','process_loss','conversion')),
  product_id INT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('raw_material','finished_product')),
  quantity DECIMAL(12,3) NOT NULL,
  reference_id INT,
  reference_type VARCHAR(50),
  notes TEXT,
  recorded_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_date ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_product ON inventory_transactions(product_id);

-- Dashboard Cache
CREATE TABLE IF NOT EXISTS dashboard_cache (
  id SERIAL PRIMARY KEY,
  metric_key VARCHAR(100) UNIQUE NOT NULL,
  metric_value JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_updated ON dashboard_cache(last_updated);

-- Production Material Allocations
CREATE TABLE IF NOT EXISTS production_material_allocations (
  id SERIAL PRIMARY KEY,
  production_order_id INT NOT NULL REFERENCES production_orders(id),
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  unit VARCHAR(20),
  required_qty DECIMAL(12,3) DEFAULT 0,
  allocated_qty DECIMAL(12,3) DEFAULT 0,
  consumed_qty DECIMAL(12,3) DEFAULT 0,
  waste_qty DECIMAL(12,3) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (production_order_id, raw_material_id)
);
DROP TRIGGER IF EXISTS trg_prod_alloc_updated_at ON production_material_allocations;
CREATE TRIGGER trg_prod_alloc_updated_at BEFORE UPDATE ON production_material_allocations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Production Material Movements
CREATE TABLE IF NOT EXISTS production_material_movements (
  id SERIAL PRIMARY KEY,
  allocation_id INT NOT NULL REFERENCES production_material_allocations(id),
  production_order_id INT NOT NULL REFERENCES production_orders(id),
  raw_material_id INT NOT NULL REFERENCES raw_materials(id),
  movement TEXT NOT NULL CHECK (movement IN ('issue','return','consume','waste','adjustment')),
  quantity DECIMAL(12,3) NOT NULL,
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_movements_alloc ON production_material_movements(allocation_id);
CREATE INDEX IF NOT EXISTS idx_prod_movements_order_rm ON production_material_movements(production_order_id, raw_material_id);

-- Process Definitions
CREATE TABLE IF NOT EXISTS process_definitions (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL CHECK (name IN ('knitting','washing_dyeing','lamination')),
  default_loss_percent DECIMAL(5,2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_process_def_updated_at ON process_definitions;
CREATE TRIGGER trg_process_def_updated_at BEFORE UPDATE ON process_definitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Product Specs
CREATE TABLE IF NOT EXISTS product_specs (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('raw_material','finished_product')),
  lot_no VARCHAR(100),
  gsm DECIMAL(10,2),
  width_cm DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, product_type, lot_no)
);

-- Subcontract Orders
CREATE TABLE IF NOT EXISTS subcontract_orders (
  id SERIAL PRIMARY KEY,
  sc_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  process_id INT NOT NULL REFERENCES process_definitions(id),
  input_product_id INT NOT NULL,
  input_product_type TEXT NOT NULL CHECK (input_product_type IN ('raw_material','finished_product')),
  input_uom VARCHAR(20) NOT NULL,
  planned_input_qty DECIMAL(12,3) DEFAULT 0,
  output_product_id INT NOT NULL,
  output_product_type TEXT NOT NULL CHECK (output_product_type IN ('raw_material','finished_product')),
  output_uom VARCHAR(20) NOT NULL,
  expected_output_qty DECIMAL(12,3) DEFAULT 0,
  planned_loss_percent DECIMAL(5,2) DEFAULT 0.00,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','received','closed')),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_completion_date DATE,
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_subcontract_orders_updated_at ON subcontract_orders;
CREATE TRIGGER trg_subcontract_orders_updated_at BEFORE UPDATE ON subcontract_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_sc_status ON subcontract_orders(status);
CREATE INDEX IF NOT EXISTS idx_sc_supplier ON subcontract_orders(supplier_id);

-- Subcontract Order Issues
CREATE TABLE IF NOT EXISTS subcontract_order_issues (
  id SERIAL PRIMARY KEY,
  subcontract_order_id INT NOT NULL REFERENCES subcontract_orders(id),
  product_id INT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('raw_material','finished_product')),
  uom VARCHAR(20) NOT NULL,
  qty DECIMAL(12,3) NOT NULL,
  lot_no VARCHAR(100),
  spec_snapshot_json JSONB,
  inventory_txn_id INT,
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sc_issue_order ON subcontract_order_issues(subcontract_order_id);

-- Subcontract Order Receipts
CREATE TABLE IF NOT EXISTS subcontract_order_receipts (
  id SERIAL PRIMARY KEY,
  subcontract_order_id INT NOT NULL REFERENCES subcontract_orders(id),
  product_id INT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('raw_material','finished_product')),
  uom VARCHAR(20) NOT NULL,
  qty DECIMAL(12,3) NOT NULL,
  waste_qty DECIMAL(12,3) DEFAULT 0,
  measured_loss_percent DECIMAL(5,2),
  lot_no VARCHAR(100),
  spec_snapshot_json JSONB,
  inventory_txn_id INT,
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sc_receipt_order ON subcontract_order_receipts(subcontract_order_id);

-- App Meta (migration marker)
CREATE TABLE IF NOT EXISTS app_meta (
  k VARCHAR(100) PRIMARY KEY,
  v TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View: raw material lookup
CREATE OR REPLACE VIEW v_raw_material_lookup AS
SELECT id, sku, name, category, unit, quantity_on_hand, status
FROM raw_materials WHERE status = 'active';

-- View: per-unit BOM requirements
CREATE OR REPLACE VIEW bom_per_unit_requirements AS
SELECT
  b.finished_product_id,
  b.raw_material_id,
  COALESCE(
    CASE b.calc_method
      WHEN 'fixed' THEN b.quantity_required
      WHEN 'per_area' THEN ((ps.width_cm * ps.length_cm) / 10000.0) * b.factor * (1 + b.waste_percent/100.0)
      WHEN 'per_length' THEN (((ps.width_cm + ps.length_cm) * 2) / 100.0) * b.factor * (1 + b.waste_percent/100.0)
      ELSE NULL
    END, 0
  ) AS per_unit_required_qty,
  b.uom
FROM bill_of_materials b
LEFT JOIN product_size_specs ps ON ps.finished_product_id = b.finished_product_id;

-- View: total material requirements per production order
CREATE OR REPLACE VIEW production_order_material_requirements AS
SELECT
  po.id AS production_order_id,
  po.order_number,
  b.raw_material_id,
  rm.sku AS raw_material_sku,
  rm.name AS raw_material_name,
  rm.unit AS material_unit,
  (COALESCE(
    CASE b.calc_method
      WHEN 'fixed' THEN b.quantity_required
      WHEN 'per_area' THEN ((ps.width_cm * ps.length_cm) / 10000.0) * b.factor * (1 + b.waste_percent/100.0)
      WHEN 'per_length' THEN (((ps.width_cm + ps.length_cm) * 2) / 100.0) * b.factor * (1 + b.waste_percent/100.0)
      ELSE NULL
    END, 0) * po.quantity_ordered
  ) AS total_required_qty
FROM production_orders po
JOIN bill_of_materials b ON b.finished_product_id = po.finished_product_id
LEFT JOIN product_size_specs ps ON ps.finished_product_id = po.finished_product_id
LEFT JOIN raw_materials rm ON rm.id = b.raw_material_id;

-- View: live material status per order/material
CREATE OR REPLACE VIEW v_production_material_status AS
WITH mv AS (
  SELECT
    production_order_id,
    raw_material_id,
    SUM(CASE WHEN movement='issue' THEN quantity WHEN movement='return' THEN -quantity ELSE 0 END) AS net_allocated,
    SUM(CASE WHEN movement='consume' THEN quantity ELSE 0 END) AS total_consumed,
    SUM(CASE WHEN movement='waste' THEN quantity ELSE 0 END) AS total_waste
  FROM production_material_movements
  GROUP BY production_order_id, raw_material_id
)
SELECT
  a.production_order_id,
  po.order_number,
  a.raw_material_id,
  rm.sku AS raw_material_sku,
  rm.name AS raw_material_name,
  COALESCE(a.unit, rm.unit) AS unit,
  a.required_qty,
  COALESCE(mv.net_allocated, 0) AS allocated_qty,
  COALESCE(mv.total_consumed, 0) AS consumed_qty,
  COALESCE(mv.total_waste, 0) AS waste_qty,
  GREATEST(COALESCE(mv.net_allocated,0) - (COALESCE(mv.total_consumed,0) + COALESCE(mv.total_waste,0)), 0) AS on_floor_qty,
  CASE WHEN a.required_qty > 0 THEN ROUND((COALESCE(mv.total_consumed,0) / a.required_qty) * 100, 2) ELSE NULL END AS fulfillment_percent
FROM production_material_allocations a
JOIN production_orders po ON po.id = a.production_order_id
JOIN raw_materials rm ON rm.id = a.raw_material_id
LEFT JOIN mv ON mv.production_order_id = a.production_order_id AND mv.raw_material_id = a.raw_material_id;

-- View: production order progress
CREATE OR REPLACE VIEW v_production_order_progress AS
WITH pl AS (
  SELECT production_order_id, SUM(quantity_produced) AS produced_qty
  FROM production_logs
  GROUP BY production_order_id
)
SELECT
  po.id AS production_order_id,
  po.order_number,
  po.finished_product_id,
  fp.sku AS finished_sku,
  fp.name AS finished_name,
  po.quantity_ordered,
  COALESCE(pl.produced_qty, po.quantity_produced, 0) AS quantity_produced,
  CASE WHEN po.quantity_ordered > 0 THEN ROUND((COALESCE(pl.produced_qty, po.quantity_produced, 0)::numeric / po.quantity_ordered) * 100, 2) ELSE 0 END AS percent_complete,
  po.status,
  po.start_date,
  po.expected_completion_date,
  po.actual_completion_date
FROM production_orders po
JOIN finished_products fp ON fp.id = po.finished_product_id
LEFT JOIN pl ON pl.production_order_id = po.id;

-- View: subcontract WIP
CREATE OR REPLACE VIEW v_subcontract_wip AS
WITH iss AS (
  SELECT subcontract_order_id, SUM(qty) AS qty_issued
  FROM subcontract_order_issues GROUP BY subcontract_order_id
), rec AS (
  SELECT subcontract_order_id, SUM(qty) AS qty_received, SUM(waste_qty) AS qty_waste
  FROM subcontract_order_receipts GROUP BY subcontract_order_id
)
SELECT
  so.id AS subcontract_order_id,
  so.sc_number,
  s.supplier_name,
  pd.name AS process_name,
  so.status,
  so.planned_input_qty,
  so.expected_output_qty,
  COALESCE(iss.qty_issued,0) AS total_issued,
  COALESCE(rec.qty_received,0) AS total_received,
  COALESCE(rec.qty_waste,0) AS total_waste
FROM subcontract_orders so
LEFT JOIN iss ON iss.subcontract_order_id = so.id
LEFT JOIN rec ON rec.subcontract_order_id = so.id
JOIN suppliers s ON s.id = so.supplier_id
JOIN process_definitions pd ON pd.id = so.process_id;

-- View: yield by supplier and process
CREATE OR REPLACE VIEW v_process_yield_by_supplier AS
SELECT
  s.id AS supplier_id,
  s.supplier_name,
  pd.name AS process_name,
  ROUND(
    CASE WHEN SUM(GREATEST(r.qty,0)) > 0
         THEN 100.0 - (SUM(GREATEST(r.waste_qty,0)) / SUM(GREATEST(r.qty,0))) * 100.0
         ELSE NULL END, 2) AS yield_percent,
  SUM(GREATEST(r.qty,0)) AS total_output_qty,
  SUM(GREATEST(r.waste_qty,0)) AS total_waste_qty,
  COUNT(DISTINCT r.subcontract_order_id) AS orders_count
FROM subcontract_order_receipts r
JOIN subcontract_orders so ON so.id = r.subcontract_order_id
JOIN suppliers s ON s.id = so.supplier_id
JOIN process_definitions pd ON pd.id = so.process_id
GROUP BY s.id, s.supplier_name, pd.name;
