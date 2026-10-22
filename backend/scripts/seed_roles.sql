INSERT INTO role (code, name, description, sort_order)
VALUES
  ('system_admin', '系統管理員', '管理使用者、角色、選單與系統設定。', 1),
  ('general_manager', '總經理', '查看跨部門營運資訊與管理總覽。', 2),
  ('sales_manager', '業務主管', '管理客戶、報價、銷售訂單與出貨相關作業。', 3),
  ('sales_staff', '業務人員', '維護客戶資料並處理報價與銷售訂單。', 4),
  ('purchase_manager', '採購主管', '管理供應商、請購、採購訂單與進貨驗收。', 5),
  ('purchase_staff', '採購人員', '建立與維護採購相關資料。', 6),
  ('warehouse_manager', '倉管主管', '管理倉庫、庫存、盤點與庫存異動。', 7),
  ('warehouse_staff', '倉管人員', '處理進出貨、盤點與庫存異動作業。', 8),
  ('finance_manager', '財務主管', '管理應收、應付、發票與收付款紀錄。', 9),
  ('hr_manager', '人資主管', '管理員工、部門、出勤與薪資作業。', 10),
  ('viewer', '檢視者', '查看基本儀表板與被授權的查詢頁面。', 11)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
