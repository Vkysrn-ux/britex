-- Insert sample users with different roles
INSERT INTO users (email, password_hash, first_name, last_name, role, department) VALUES
('admin@mattress.com', 'hashed_password_123', 'Admin', 'User', 'admin', 'Management'),
('manager@mattress.com', 'hashed_password_123', 'John', 'Manager', 'manager', 'Operations'),
('production@mattress.com', 'hashed_password_123', 'Mike', 'Production', 'production', 'Manufacturing'),
('sales@mattress.com', 'hashed_password_123', 'Sarah', 'Sales', 'sales', 'Sales'),
('warehouse@mattress.com', 'hashed_password_123', 'Tom', 'Warehouse', 'warehouse', 'Warehouse'),
('quality@mattress.com', 'hashed_password_123', 'Emma', 'QC', 'quality', 'Quality Control');

-- Insert raw materials (threads, yarns, zips, fabrics) with units
INSERT INTO raw_materials (sku, name, category, unit, quantity_on_hand, reorder_level, unit_cost) VALUES
('RM101', 'Cotton Knit Fabric 280 GSM', 'fabric', 'sqm', 500, 100, 6.00),
('RM102', 'Polyester Sewing Thread 40/2 (White)', 'thread', 'meter', 200000, 50000, 0.0020),
('RM103', 'Nylon Zip No.5 200 cm', 'zip', 'piece', 1000, 200, 1.20),
('RM104', 'Woven Mattress Border Fabric 320 GSM', 'fabric', 'sqm', 300, 60, 7.50),
('RM105', 'Cotton Yarn 30s', 'yarn', 'meter', 500000, 100000, 0.0012),
('RM106', 'Latex Foam Sheet', 'foam', 'piece', 200, 40, 35.00),
('RM107', 'Sofa Upholstery Fabric 300 GSM', 'fabric', 'sqm', 400, 80, 7.80),
('RM108', 'Nylon Zip No.8 220 cm', 'zip', 'piece', 600, 120, 1.60);

-- Insert finished products
INSERT INTO finished_products (sku, name, product_type, size, firmness_level, quantity_on_hand, reorder_level, unit_cost, unit_price) VALUES
('FP001', 'Queen Memory Foam Mattress', 'mattress', 'Queen', 'Medium', 50, 20, 150.00, 499.99),
('FP002', 'King Hybrid Mattress', 'mattress', 'King', 'Firm', 30, 15, 180.00, 699.99),
('FP003', 'Twin Plush Mattress', 'mattress', 'Twin', 'Soft', 40, 20, 100.00, 399.99),
('FP004', 'Shredded Memory Foam Pillow', 'pillow', 'Standard', 'Medium', 200, 50, 25.00, 79.99),
('FP005', 'Latex Pillow', 'pillow', 'King', 'Firm', 150, 40, 30.00, 99.99),
('FP006', 'Sofa Bed 3-Seater', 'sofa_bed', '3-Seater', 'Firm', 10, 5, 220.00, 799.00);

-- Size specs for dynamic material calculations (dimensions in cm)
INSERT INTO product_size_specs (finished_product_id, width_cm, length_cm, height_cm)
SELECT id, 152.0, 203.0, 25.0 FROM finished_products WHERE sku = 'FP001'; -- Queen
INSERT INTO product_size_specs (finished_product_id, width_cm, length_cm, height_cm)
SELECT id, 193.0, 203.0, 25.0 FROM finished_products WHERE sku = 'FP002'; -- King
INSERT INTO product_size_specs (finished_product_id, width_cm, length_cm, height_cm)
SELECT id, 99.0, 191.0, 22.0 FROM finished_products WHERE sku = 'FP003';  -- Twin
INSERT INTO product_size_specs (finished_product_id, width_cm, length_cm, height_cm)
SELECT id, 200.0, 90.0, 40.0 FROM finished_products WHERE sku = 'FP006';  -- Sofa bed seat (approx)

-- Insert suppliers
INSERT INTO suppliers (supplier_name, contact_person, email, phone, city, state, country, payment_terms) VALUES
('Foam Supply Inc', 'Bob Smith', 'bob@foamsupply.com', '555-0001', 'Los Angeles', 'CA', 'USA', 'Net 30'),
('Zipper World', 'Kevin Patel', 'kevin@zipperworld.com', '555-0108', 'Newark', 'NJ', 'USA', 'Net 30'),
('Textile Global', 'Maria Garcia', 'maria@textileglobal.com', '555-0003', 'Houston', 'TX', 'USA', 'Net 30');

-- Bill of Materials
-- Queen Mattress uses: cover fabric (per area), sewing thread (per area), zipper (fixed)
INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'sqm', 'per_area', 2.20, 5.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM101'
WHERE fp.sku = 'FP001';

INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'meter', 'per_area', 50.00, 10.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM102'
WHERE fp.sku = 'FP001';

-- Optional: if fabric is knitted in-house, yarn requirement per sqm of cover
INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'meter', 'per_area', 120.00, 5.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM105'
WHERE fp.sku = 'FP001';

INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, 1.00, 'piece', 'fixed', NULL, 0.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM103'
WHERE fp.sku = 'FP001';

-- King Mattress similar BOM with same factors
INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'sqm', 'per_area', 2.20, 5.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM101'
WHERE fp.sku = 'FP002';

INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'meter', 'per_area', 50.00, 10.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM102'
WHERE fp.sku = 'FP002';

INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, 1.00, 'piece', 'fixed', NULL, 0.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM103'
WHERE fp.sku = 'FP002';

-- Twin Mattress with same coating and thread factors
INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'sqm', 'per_area', 2.20, 5.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM101'
WHERE fp.sku = 'FP003';

INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, NULL, 'meter', 'per_area', 50.00, 10.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM102'
WHERE fp.sku = 'FP003';

-- Pillows: fixed zipper count example
INSERT INTO bill_of_materials (finished_product_id, raw_material_id, quantity_required, uom, calc_method, factor, waste_percent)
SELECT fp.id, rm.id, 1.00, 'piece', 'fixed', NULL, 0.0
FROM finished_products fp
JOIN raw_materials rm ON rm.sku = 'RM103'
WHERE fp.sku = 'FP004';

-- Insert production orders
INSERT INTO production_orders (order_number, finished_product_id, quantity_ordered, quantity_produced, status, priority, start_date, expected_completion_date, assigned_to) VALUES
('PO-001', 1, 100, 75, 'in_progress', 'high', '2025-11-01', '2025-11-10', 3),
('PO-002', 2, 50, 0, 'pending', 'medium', '2025-11-06', '2025-11-15', 3),
('PO-003', 4, 200, 150, 'in_progress', 'medium', '2025-11-03', '2025-11-08', 3),
('PO-004', 1, 80, 80, 'completed', 'low', '2025-10-25', '2025-11-02', 3);

-- Insert customer orders
INSERT INTO customer_orders (order_number, customer_name, customer_email, status, total_amount, ship_date, expected_delivery_date, created_by) VALUES
('CO-001', 'John Doe Furniture', 'john@furniture.com', 'processing', 2499.95, '2025-11-08', '2025-11-15', 4),
('CO-002', 'Bedroom Sets Ltd', 'orders@bedroom.com', 'pending', 1399.97, NULL, '2025-11-20', 4),
('CO-003', 'Hotel Supplies Plus', 'bulk@hotel.com', 'shipped', 7999.95, '2025-11-05', '2025-11-12', 4);

-- Insert customer order items
INSERT INTO customer_order_items (customer_order_id, finished_product_id, quantity_ordered, quantity_shipped, unit_price) VALUES
(1, 1, 5, 3, 499.99),
(2, 3, 2, 0, 399.99),
(2, 4, 5, 0, 79.99),
(3, 1, 10, 10, 499.99),
(3, 5, 8, 8, 99.99);

-- Demo: Plan 2 pillows today and track material usage and waste
-- Create a new production order for 2 units of pillow FP004
INSERT INTO production_orders (
  order_number, finished_product_id, quantity_ordered, quantity_produced, status, priority, start_date, expected_completion_date, assigned_to
) VALUES (
  'PO-005',
  (SELECT id FROM finished_products WHERE sku = 'FP004'),
  2,
  0,
  'in_progress',
  'high',
  '2025-11-07',
  '2025-11-07',
  (SELECT id FROM users WHERE email = 'production@mattress.com')
);

-- Prefill material allocation rows from BOM requirements for this order (e.g., zipper per pillow)
INSERT INTO production_material_allocations (production_order_id, raw_material_id, unit, required_qty, notes)
SELECT r.production_order_id, r.raw_material_id, r.material_unit, r.total_required_qty, 'Auto from BOM'
FROM production_order_material_requirements r
WHERE r.order_number = 'PO-005';

-- Add any extra materials selected manually for this pillow job (examples)
-- Thread 30 m for 2 pillows
INSERT INTO production_material_allocations (production_order_id, raw_material_id, unit, required_qty, notes)
SELECT po.id, rm.id, rm.unit, 30.0, 'Manual: sewing thread for pillows'
FROM production_orders po
JOIN raw_materials rm ON rm.sku = 'RM102'
WHERE po.order_number = 'PO-005'
ON DUPLICATE KEY UPDATE required_qty = VALUES(required_qty);

-- Fabric 1.20 sqm for 2 pillows
INSERT INTO production_material_allocations (production_order_id, raw_material_id, unit, required_qty, notes)
SELECT po.id, rm.id, rm.unit, 1.20, 'Manual: cover fabric for pillows'
FROM production_orders po
JOIN raw_materials rm ON rm.sku = 'RM101'
WHERE po.order_number = 'PO-005'
ON DUPLICATE KEY UPDATE required_qty = VALUES(required_qty);

-- Foam sheet 2 pcs for 2 pillows
INSERT INTO production_material_allocations (production_order_id, raw_material_id, unit, required_qty, notes)
SELECT po.id, rm.id, rm.unit, 2.0, 'Manual: foam core for pillows'
FROM production_orders po
JOIN raw_materials rm ON rm.sku = 'RM106'
WHERE po.order_number = 'PO-005'
ON DUPLICATE KEY UPDATE required_qty = VALUES(required_qty);

-- Log material movements (issue/consume/waste/return) for this 2-pillow job
-- Zippers: require 2 pcs, issue and consume 2, no waste
INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'issue', 2.0, 'Issue zippers to floor', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM103'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'consume', 2.0, 'Consume zippers', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM103'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

-- Thread: issue 30 m, consume 28 m, waste 1 m, return 1 m
INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'issue', 30.0, 'Issue thread to floor', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM102'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'consume', 28.0, 'Consume thread', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM102'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'waste', 1.0, 'Thread offcuts/overuse', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM102'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'return', 1.0, 'Return unused thread', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM102'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

-- Fabric: issue 1.2 sqm, consume 1.1 sqm, waste 0.1 sqm
INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'issue', 1.20, 'Issue fabric to floor', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM101'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'consume', 1.10, 'Consume fabric', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM101'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'waste', 0.10, 'Fabric trimmings', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM101'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

-- Foam sheet: issue 2 pcs, consume 2 pcs
INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'issue', 2.0, 'Issue foam core', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM106'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

INSERT INTO production_material_movements (allocation_id, production_order_id, raw_material_id, movement, quantity, note, created_by)
SELECT a.id, a.production_order_id, a.raw_material_id, 'consume', 2.0, 'Consume foam core', 3
FROM production_material_allocations a
JOIN raw_materials rm ON rm.id = a.raw_material_id AND rm.sku = 'RM106'
JOIN production_orders po ON po.id = a.production_order_id AND po.order_number = 'PO-005';

-- Optional: sync allocation rollups with movement totals for quick reads
UPDATE production_material_allocations a
JOIN (
  SELECT production_order_id, raw_material_id,
         SUM(CASE WHEN movement='issue' THEN quantity WHEN movement='return' THEN -quantity ELSE 0 END) AS allocated,
         SUM(CASE WHEN movement='consume' THEN quantity ELSE 0 END) AS consumed,
         SUM(CASE WHEN movement='waste' THEN quantity ELSE 0 END) AS wasted
  FROM production_material_movements
  GROUP BY production_order_id, raw_material_id
) m ON m.production_order_id = a.production_order_id AND m.raw_material_id = a.raw_material_id
SET a.allocated_qty = COALESCE(m.allocated,0),
    a.consumed_qty = COALESCE(m.consumed,0),
    a.waste_qty = COALESCE(m.wasted,0)
WHERE a.production_order_id = (SELECT id FROM production_orders WHERE order_number='PO-005');

-- Log production output for 2 pillows (complete the order)
INSERT INTO production_logs (production_order_id, production_date, quantity_produced, batch_number, quality_check_passed, defects_found, notes, logged_by)
SELECT id, '2025-11-07', 2, 'BATCH-PILLOW-2', 2, 0, 'Completed 2 pillows', 3
FROM production_orders WHERE order_number='PO-005';

UPDATE production_orders SET status='completed', actual_completion_date='2025-11-07' WHERE order_number='PO-005';
