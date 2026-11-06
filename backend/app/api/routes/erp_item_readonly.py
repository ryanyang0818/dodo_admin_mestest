"""料號基本資料：依已確認需求提供匿名、有限範圍的唯讀查詢。"""
import csv
import io
from collections.abc import Generator
from datetime import date
from threading import Lock
from time import monotonic
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.tt_db import getTtConnection


# 此公開報表的連線錯誤只顯示一般訊息，不洩漏帳號與主機資訊。
def item_connection() -> Generator:
  try:
    yield from getTtConnection()
  except SQLAlchemyError:
    raise HTTPException(503, "ERP 暫時無法連線，請稍後再試") from None


TtConnectionDep = Annotated[object, Depends(item_connection)]

router = APIRouter(prefix="/page/erp/item-readonly/report", tags=["page-erp-item-readonly"])
SOURCE_LABELS = dict(zip("CTDAMPXKUVRZS", ["規格組件", "最後規格料件", "特性料件", "族群料件", "自製料件", "採購料件", "虛擬料件", "配件虛擬料件", "自製大宗料件", "採購大宗料件", "在製途料件", "雜項料件", "廠外加工料件"], strict=True))
SALES_CHARACTERISTIC_LABELS = {"0": "非產品", "1": "一般產品", "2": "PHASE OUT"}
REPLENISHMENT_LABELS = {"0": "再訂購點", "1": "MPS", "2": "MRP", "3": "FAS", "4": "訂單式生產", "5": "期間採購"}
# 2026-10-30 使用者確認 IMA1010；未知代碼保留原碼。
STATUS_LABELS: dict[str, str] = {"1": "確認"}
ACTIVE_LABELS: dict[str, str] = {"Y": "確認"}
COLUMNS = {
  "part_no": "i.ima01",
  "name": "i.ima02",
  "specification": "i.ima021",
  "group_code": "i.ima06",
  "source": "i.ima08",
  "sales_characteristic": "i.ima130",
  "material_category": "i.ima109",
  "stock_unit": "i.ima25",
  "replenishment_strategy": "i.ima37",
  "status": "i.ima1010",
  "active_code": "i.imaacti",
  "origin": "i.ima916",
}
DETAIL_COLUMNS = {
  "part_no": "i.ima01",
  "name": "i.ima02",
  "specification": "i.ima021",
  "group_code": "i.ima06",
  "source": "i.ima08",
  "status": "i.ima1010",
  "processing": "i.ima93",
  "vendor_control": "i.ima915",
  "origin": "i.ima916",
  "software_object": "i.ima105",
  "engineering_item": "i.ima14",
  "auto_plugin_position": "i.ima107",
  "plugin_qpa_check": "i.ima147",
  "co_product": "i.ima903",
  "inspection": "i.ima24",
  "repetitive_production": "i.ima911",
  "material_category": "i.ima109",
  "abc_code": "i.ima07",
  "consumable": "i.ima70",
  "replenishment_strategy": "i.ima37",
  "economic_order_qty": "i.ima51",
  "average_order_qty": "i.ima52",
  "safety_stock": "i.ima27",
  "safety_period": "i.ima28",
  "max_stock": "i.ima271",
  "shelf_life_days": "i.ima71",
  "stock_unit": "i.ima25",
  "primary_warehouse": "i.ima35",
  "primary_location": "i.ima36",
  "warehouse_keeper": "i.ima23",
  "lot_control": "i.ima159",
  "pallet_full_qty": "i.imaud12",
  # 2026-11-06 依 TT 欄位提示截圖核對：批／序號管理頁簽。
  "manufacturing_lot_control": "i.ima918",
  "manufacturing_lot_auto_number": "i.ima919",
  "manufacturing_lot_rule": "i.ima920",
  "serial_control": "i.ima921",
  "serial_auto_number": "i.ima922",
  "serial_rule": "i.ima923",
  "serial_unique": "i.ima924",
  "lot_sort_method": "i.ima925",
  "brand_code": "i.ima1005",
  "series_code": "i.ima1006",
  "manufacturer": "i.imaud04",
  # 成本分群為 IMA12；IMA121 是單位材料成本。
  "cost_group": "i.ima12",
  "account_code": "i.ima39",
  "bonded_item": "i.ima15",
  "bom_changed": "i.ima146",
  "low_level_code": "i.ima16",
  "monthly_joint_product": "i.ima905",
  "tax_classification_version": "i.ta_ima13",
  "tax_classification_code": "i.ta_ima14",
  "other_group_1": "i.ima09",
  "other_group_2": "i.ima10",
  "other_group_3": "i.ima11",
  "quantitative_specification": "i.ima022",
  "quantitative_unit": "i.ima251",
  "first_created_date": "i.ima901",
  "stagnation_date": "i.ima902",
  "opening_stagnation_date": "i.ima9021",
  "last_purchase_date": "i.ima881",
  "last_receipt_date": "i.ima73",
  "last_issue_date": "i.ima74",
  "last_movement_date": "i.ima29",
  "last_stocktake_date": "i.ima30",
  "shipping_valid_days": "i.ta_ima01",
  "combination_item": "i.ta_ima02",
  "combination_effective_date": "i.ta_ima03",
  "combination_expiry_date": "i.ta_ima04",
  "health_insurance_item_no": "i.ta_ima05",
  "health_license_no": "i.ta_ima06",
  "health_license_expiry_date": "i.ta_ima07",
  "reinspection_days": "i.ta_ima08",
  "controlled_drug": "i.ta_ima09",
  "cold_item": "i.ta_ima10",
  "drug_declaration": "i.imaud02",
  "observation_item": "i.imaud05",
}
LABELS = dict(zip(COLUMNS, ["料件編號", "品名", "規格", "分群碼", "來源碼", "產品銷售特性", "材料類別", "庫存單位", "補貨策略", "狀況", "資料有效碼", "資料來源"], strict=True))
FieldKey = Literal["part_no", "name", "specification", "group_code", "source", "sales_characteristic", "material_category", "stock_unit", "replenishment_strategy", "status", "active_code", "origin"]


class ItemFilters(BaseModel):
  preview: bool = False
  search: str = Field(default="", max_length=80)
  group_code: list[str] = Field(default_factory=list, max_length=15)
  source: list[str] = Field(default_factory=list, max_length=15)
  status: list[str] = Field(default_factory=list, max_length=15)
  origin: list[str] = Field(default_factory=list, max_length=15)
  sort_by: FieldKey = "part_no"
  sort_direction: Literal["asc", "desc"] = "asc"
  page: int = Field(default=1, ge=1, le=10000)
  page_size: int = Field(default=250, ge=1, le=500)
  columns: list[FieldKey] = Field(default_factory=lambda: list(COLUMNS), min_length=1, max_length=12)

  # 清除前後空白並拒絕控制字元，保留中文及一般標點。
  @field_validator("search")
  @classmethod
  def clean_search(cls, value: str) -> str:
    if any(ord(c) < 32 for c in value):
      raise ValueError("搜尋不可包含控制字元")
    return value.strip()

  # 限制多選值大小，避免產生過長 OPENQUERY。
  @field_validator("group_code", "source", "status", "origin")
  @classmethod
  def clean_choices(cls, values: list[str]) -> list[str]:
    if any(not v.strip() or len(v) > 20 or any(ord(c) < 32 for c in v) for v in values):
      raise ValueError("篩選值格式錯誤")
    return list(dict.fromkeys(v.strip() for v in values))

  # 僅初次預覽允許無條件，且不可混入篩選條件。
  @model_validator(mode="after")
  def validate_mode(self) -> "ItemFilters":
    has_filter = bool(self.search or self.group_code or self.source or self.status or self.origin)
    if self.preview == has_filter:
      raise ValueError("初次預覽不可帶條件；手動查詢至少需要一個條件")
    if len(set(self.columns)) != len(self.columns):
      raise ValueError("匯出欄位不可重複")
    return self


class ItemRow(BaseModel):
  part_no: str
  name: str | None = None
  specification: str | None = None
  group_code: str | None = None
  group_name: str | None = None
  source: str | None = None
  sales_characteristic: str | None = None
  material_category: str | None = None
  stock_unit: str | None = None
  replenishment_strategy: str | None = None
  status: str | None = None
  active_code: str | None = None
  origin: str | None = None


class ItemDetail(BaseModel):
  part_no: str
  name: str | None = None
  specification: str | None = None
  group_code: str | None = None
  group_name: str | None = None
  source: str | None = None
  status: str | None = None
  processing: str | None = None
  vendor_control: str | None = None
  origin: str | None = None
  software_object: str | None = None
  engineering_item: str | None = None
  auto_plugin_position: str | None = None
  plugin_qpa_check: str | None = None
  co_product: str | None = None
  inspection: str | None = None
  repetitive_production: str | None = None
  material_category: str | None = None
  abc_code: str | None = None
  consumable: str | None = None
  replenishment_strategy: str | None = None
  economic_order_qty: float | None = None
  average_order_qty: float | None = None
  safety_stock: float | None = None
  safety_period: float | None = None
  max_stock: float | None = None
  shelf_life_days: float | None = None
  stock_unit: str | None = None
  primary_warehouse: str | None = None
  primary_location: str | None = None
  warehouse_keeper: str | None = None
  warehouse_keeper_name: str | None = None
  lot_control: str | None = None
  pallet_full_qty: float | None = None
  manufacturing_lot_control: str | None = None
  manufacturing_lot_auto_number: str | None = None
  manufacturing_lot_rule: str | None = None
  serial_control: str | None = None
  serial_auto_number: str | None = None
  serial_rule: str | None = None
  serial_unique: str | None = None
  lot_sort_method: str | None = None
  brand_code: str | None = None
  series_code: str | None = None
  manufacturer: str | None = None
  brand_name: str | None = None
  series_name: str | None = None
  cost_group: str | None = None
  account_code: str | None = None
  bonded_item: str | None = None
  bom_changed: str | None = None
  low_level_code: int | None = None
  monthly_joint_product: str | None = None
  tax_classification_version: str | None = None
  tax_classification_code: str | None = None
  other_group_1: str | None = None
  other_group_2: str | None = None
  other_group_3: str | None = None
  quantitative_specification: float | None = None
  quantitative_unit: str | None = None
  first_created_date: date | None = None
  stagnation_date: date | None = None
  opening_stagnation_date: date | None = None
  last_purchase_date: date | None = None
  last_receipt_date: date | None = None
  last_issue_date: date | None = None
  last_movement_date: date | None = None
  last_stocktake_date: date | None = None
  shipping_valid_days: float | None = None
  combination_item: str | None = None
  combination_effective_date: date | None = None
  combination_expiry_date: date | None = None
  health_insurance_item_no: str | None = None
  health_license_no: str | None = None
  health_license_expiry_date: date | None = None
  reinspection_days: float | None = None
  controlled_drug: str | None = None
  cold_item: str | None = None
  drug_declaration: str | None = None
  observation_item: str | None = None


class ItemReport(BaseModel):
  data: list[ItemRow]
  total: int
  preview: bool
  page: int
  page_size: int


class ItemOption(BaseModel):
  value: str
  label: str


class ItemOptions(BaseModel):
  group_code: list[ItemOption]
  source: list[ItemOption]
  status: list[ItemOption]
  origin: list[ItemOption]


_options_lock = Lock()
_options_cache: tuple[float, ItemOptions] | None = None


# 以 UNISTR 的 UTF-16 碼單位傳遞文字，避免 linked server code page 損失中文。
def oracle_value(value: str) -> str:
  encoded = value.encode("utf-16-be")
  return "UNISTR('" + "".join(f"\\{encoded[i:i+2].hex().upper()}" for i in range(0, len(encoded), 2)) + "')"


# 產生固定欄位的 Oracle SELECT，不接受任意 SQL。
def base_query(filters: ItemFilters) -> str:
  select = ", ".join(f"{column} AS {key}" for key, column in COLUMNS.items())
  base = f"SELECT {select}, z.imz02 AS group_name FROM MWF.ima_file i LEFT JOIN MWF.imz_file z ON i.ima06 = z.imz01"
  if filters.preview:
    return f"SELECT * FROM ({base} ORDER BY i.ima01) WHERE ROWNUM <= 500"
  conditions = []
  if filters.search:
    escaped = filters.search.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    value = oracle_value(f"%{escaped}%")
    conditions.append(f"(LOWER(i.ima01) LIKE {value} ESCAPE '\\' OR LOWER(i.ima02) LIKE {value} ESCAPE '\\')")
  for key in ("group_code", "source", "status", "origin"):
    values = getattr(filters, key)
    if values:
      conditions.append(f"{COLUMNS[key]} IN ({', '.join(oracle_value(v) for v in values)})")
  return base + " WHERE " + " AND ".join(conditions)


# 包裝 OPENQUERY，限制 SQL 長度以符合 SQL Server 的 8KB 邊界。
def openquery(sql: str) -> str:
  if len(sql.encode("utf-8")) > 7800:
    raise HTTPException(422, "查詢條件過長，請減少選項")
  return "SELECT * FROM OPENQUERY(TOPPROD, '" + sql.replace("'", "''") + "')"


# 執行白名單 SELECT，屏蔽包含連線資訊的底層錯誤。
def fetch_rows(connection, sql: str) -> list[dict]:
  try:
    return [{k.lower(): v for k, v in row.items()} for row in connection.execute(text(openquery(sql))).mappings()]
  except SQLAlchemyError:
    raise HTTPException(503, "ERP 查詢失敗或逾時，請縮小條件後再試") from None


# 將代碼與名稱統一轉為畫面及 CSV 文字。
def display_value(row: ItemRow, key: str) -> str:
  value = getattr(row, key)
  if value is None or value == "":
    return "—"
  lookup = {
    "source": SOURCE_LABELS,
    "sales_characteristic": SALES_CHARACTERISTIC_LABELS,
    "replenishment_strategy": REPLENISHMENT_LABELS,
    "status": STATUS_LABELS,
    "active_code": ACTIVE_LABELS,
  }.get(key)
  return f"{value}:{lookup.get(value, '未定義')}" if lookup is not None else value


# 防止試算表將外部文字當成公式。
def csv_value(value: str) -> str:
  return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value


# 共用分頁 SQL，確保顯示的語法與實際查詢完全相同。
def page_query(filters: ItemFilters) -> str:
  base = base_query(filters)
  ordered = f"SELECT b.*, COUNT(*) OVER () AS total_count FROM ({base}) b ORDER BY {filters.sort_by} {filters.sort_direction}, part_no ASC"
  start = (filters.page - 1) * filters.page_size
  return f"SELECT * FROM (SELECT t.*, ROWNUM AS rn FROM ({ordered}) t WHERE ROWNUM <= {start + filters.page_size}) WHERE rn > {start}"


def detail_query(part_no: str) -> str:
  select = ", ".join(f"{column} AS {key}" for key, column in DETAIL_COLUMNS.items())
  # TT 系列描述畫面標示 tqa02a；實際 TQA_FILE 無此欄位，描述皆取 TQA02。
  # TQA03 區分品牌(2)與系列(3)，避免相同代碼 F 取得錯誤名稱。
  return (
    f"SELECT {select}, z.imz02 AS group_name, "
    "(SELECT g.gen02 FROM MWF.gen_file g WHERE g.gen01 = i.ima23 AND ROWNUM = 1) AS warehouse_keeper_name, "
    "(SELECT b.tqa02 FROM MWF.tqa_file b WHERE b.tqa01 = i.ima1005 AND b.tqa03 = '2' AND ROWNUM = 1) AS brand_name, "
    "(SELECT s.tqa02 FROM MWF.tqa_file s WHERE s.tqa01 = i.ima1006 AND s.tqa03 = '3' AND ROWNUM = 1) AS series_name "
    "FROM MWF.ima_file i LEFT JOIN MWF.imz_file z ON i.ima06 = z.imz01 "
    f"WHERE i.ima01 = {oracle_value(part_no)} AND ROWNUM = 1"
  )


class ItemSql(BaseModel):
  sql: str
  empty_page_count_sql: str


# 僅產生語法，不建立資料庫連線或執行任何查詢。
@router.get("/sql", response_model=ItemSql)
def item_sql(filters: Annotated[ItemFilters, Query()]) -> ItemSql:
  return ItemSql(sql=openquery(page_query(filters)), empty_page_count_sql=openquery(f"SELECT COUNT(*) AS n FROM ({base_query(filters)})"))


# 匿名讀取初次預覽或符合條件的頁面。
@router.get("/", response_model=ItemReport)
def read_items(connection: TtConnectionDep, filters: Annotated[ItemFilters, Query()]) -> ItemReport:
  base = base_query(filters)
  rows = fetch_rows(connection, page_query(filters))
  total = int(rows[0]["total_count"]) if rows else int(fetch_rows(connection, f"SELECT COUNT(*) AS n FROM ({base})")[0]["n"])
  return ItemReport(data=[ItemRow.model_validate(r) for r in rows], total=total, preview=filters.preview, page=filters.page, page_size=filters.page_size)


@router.get("/detail", response_model=ItemDetail)
def read_item_detail(
  connection: TtConnectionDep,
  part_no: Annotated[str, Query(min_length=1, max_length=40)],
) -> ItemDetail:
  cleaned = part_no.strip()
  if not cleaned or any(ord(c) < 32 for c in cleaned):
    raise HTTPException(422, "料件編號格式錯誤")
  rows = fetch_rows(connection, detail_query(cleaned))
  if not rows:
    raise HTTPException(404, "找不到指定料件")
  return ItemDetail.model_validate(rows[0])


# 取得有限數量的實際分類選項，避免把未出現的代碼當成資料。
@router.get("/options", response_model=ItemOptions)
def item_options(connection: TtConnectionDep) -> ItemOptions:
  global _options_cache
  with _options_lock:
    if _options_cache and monotonic() - _options_cache[0] < 300:
      return _options_cache[1]
    result = load_item_options(connection)
    _options_cache = (monotonic(), result)
    return result


# 分類最多 500 種，五分鐘快取避免匿名頁面重複掃描分類。
def load_item_options(connection) -> ItemOptions:
  result = {}
  for key in ("group_code", "source", "status", "origin"):
    column = COLUMNS[key]
    query = f"SELECT * FROM (SELECT DISTINCT {column} AS value FROM MWF.ima_file i WHERE {column} IS NOT NULL ORDER BY value) WHERE ROWNUM <= 501"
    rows = fetch_rows(connection, query)
    if len(rows) > 500:
      raise HTTPException(422, "分類選項超過上限，請聯絡管理者調整查詢")
    lookup = {"source": SOURCE_LABELS, "status": STATUS_LABELS}.get(key, {})
    result[key] = [ItemOption(value=r["value"], label=f"{r['value']}:{lookup.get(r['value'], '未定義')}" if key in ("source", "status") else r["value"]) for r in rows]
  return ItemOptions(**result)


# 匯出已套用條件及使用者選擇的可見欄位，不套用頁碼。
@router.get("/export", response_class=Response)
def export_items(connection: TtConnectionDep, filters: Annotated[ItemFilters, Query()]) -> Response:
  if filters.preview:
    raise HTTPException(422, "請先輸入至少一個條件並查詢，再匯出完整結果")
  base = base_query(filters)
  rows = fetch_rows(connection, f"SELECT * FROM (SELECT b.* FROM ({base}) b ORDER BY {filters.sort_by} {filters.sort_direction}, part_no ASC) WHERE ROWNUM <= 20001")
  if len(rows) > 20000:
    raise HTTPException(422, "結果超過 20,000 筆，請縮小條件；未產生截斷檔案")
  output = io.StringIO(newline="")
  writer = csv.writer(output, lineterminator="\r\n")
  writer.writerow([LABELS[k] for k in filters.columns])
  for raw in rows:
    row = ItemRow.model_validate(raw)
    writer.writerow([csv_value(display_value(row, k)) for k in filters.columns])
  try:
    content = output.getvalue().encode("big5")
  except UnicodeEncodeError:
    raise HTTPException(422, "匯出資料含 Big5 無法表示的字元，無法產生 CSV；請縮小範圍或調整匯出欄位") from None
  return Response(content, media_type="text/csv; charset=big5", headers={"Content-Disposition": f'attachment; filename="erp-item-readonly-{date.today()}.csv"'})
