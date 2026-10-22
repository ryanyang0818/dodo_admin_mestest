INSERT INTO menu (key, label, path, parent_id, sort_order, icon)
VALUES
  ('dashboard', '儀表板', '/', NULL, 1, 'Home'),
  ('items', 'Items', '/items', NULL, 2, 'Briefcase'),
  ('items-crud', 'ItemsCRUD', '/items-crud', NULL, 3, 'Table2'),
  ('master-detail', 'Master Detail', '/master-detail', NULL, 4, 'Rows2'),
  ('sales', '銷售管理', NULL, NULL, 10, 'ShoppingCart'),
  ('purchase', '採購管理', NULL, NULL, 20, 'PackageCheck'),
  ('inventory', '庫存管理', NULL, NULL, 30, 'Warehouse'),
  ('finance', '財務管理', NULL, NULL, 40, 'Wallet'),
  ('hr', '人資管理', NULL, NULL, 50, 'Users'),
  ('system', '系統管理', NULL, NULL, 60, 'Settings')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon,
  is_active = TRUE,
  is_visible = TRUE;

INSERT INTO menu (key, label, path, parent_id, sort_order, icon, access_policy)
VALUES (
  'todo-report',
  '我的待辦報表',
  '/todo-report',
  NULL,
  26,
  'ListChecks',
  'authenticated'
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon,
  access_policy = EXCLUDED.access_policy,
  is_active = TRUE,
  is_visible = TRUE;

INSERT INTO menu (key, label, path, parent_id, sort_order, icon)
SELECT 'hr.reports', '報表', NULL, parent.id, 5, 'Folder'
FROM menu parent
WHERE parent.key = 'hr'
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon,
  is_active = TRUE,
  is_visible = TRUE;

INSERT INTO menu (key, label, path, parent_id, sort_order, icon)
SELECT 'system.reports', '報表', NULL, parent.id, 5, 'Folder'
FROM menu parent
WHERE parent.key = 'system'
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon,
  is_active = TRUE,
  is_visible = TRUE;

WITH menu_seed(key, label, path, parent_key, sort_order, icon) AS (
  VALUES
    ('sales.customers', '客戶資料', '/sales/customers', 'sales', 1, 'Building'),
    ('sales.quotations', '報價單', '/sales/quotations', 'sales', 2, 'FileText'),
    ('sales.orders', '銷售訂單', '/sales/orders', 'sales', 3, 'ClipboardList'),
    ('sales.shipments', '出貨單', '/sales/shipments', 'sales', 4, 'Truck'),
    ('sales.returns', '銷售退貨', '/sales/returns', 'sales', 5, 'Undo2'),
    ('purchase.suppliers', '供應商資料', '/purchase/suppliers', 'purchase', 1, 'Factory'),
    ('purchase.requests', '採購請購', '/purchase/requests', 'purchase', 2, 'FilePlus'),
    ('purchase.orders', '採購訂單', '/purchase/orders', 'purchase', 3, 'ShoppingBag'),
    ('purchase.receipts', '進貨驗收', '/purchase/receipts', 'purchase', 4, 'ClipboardCheck'),
    ('purchase.returns', '採購退貨', '/purchase/returns', 'purchase', 5, 'RotateCcw'),
    ('inventory.products', '商品資料', '/inventory/products', 'inventory', 1, 'Box'),
    ('inventory.warehouses', '倉庫管理', '/inventory/warehouses', 'inventory', 3, 'Warehouse'),
    ('inventory.stock', '庫存查詢', '/inventory/stock', 'inventory', 4, 'Search'),
    ('inventory.adjustments', '庫存異動', '/inventory/adjustments', 'inventory', 5, 'Repeat'),
    ('inventory.counting', '盤點作業', '/inventory/counting', 'inventory', 6, 'ClipboardCheck'),
    ('finance.receivables', '應收帳款', '/finance/receivables', 'finance', 1, 'Receipt'),
    ('finance.payables', '應付帳款', '/finance/payables', 'finance', 2, 'ReceiptText'),
    ('finance.invoices', '發票管理', '/finance/invoices', 'finance', 3, 'FileBadge'),
    ('finance.payments', '收付款紀錄', '/finance/payments', 'finance', 4, 'Banknote'),
    ('hr.user-report', '員工帳號報表', '/hr/user-report', 'hr.reports', 1, 'FileSpreadsheet'),
    ('hr.departments', '部門管理', '/hr/departments', 'hr', 2, 'Network'),
    ('hr.attendance', '出勤紀錄', '/hr/attendance', 'hr', 3, 'CalendarCheck'),
    ('hr.payroll', '薪資作業', '/hr/payroll', 'hr', 4, 'BadgeDollarSign'),
    ('system.users', '使用者管理', '/admin', 'system', 1, 'UserCog'),
    ('system.roles', '角色管理', '/system/roles', 'system', 2, 'ShieldCheck'),
    ('system.menus', '選單管理', '/system/menus', 'system', 3, 'ListTree'),
    ('system.permissions', '權限設定', '/system/permissions', 'system', 4, 'KeyRound'),
    ('system.role-report', '角色權限報表', '/system/role-report', 'system.reports', 1, 'FileKey')
)
INSERT INTO menu (key, label, path, parent_id, sort_order, icon)
SELECT
  seed.key,
  seed.label,
  seed.path,
  parent.id,
  seed.sort_order,
  seed.icon
FROM menu_seed seed
JOIN menu parent ON parent.key = seed.parent_key
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon,
  is_active = TRUE,
  is_visible = TRUE;
