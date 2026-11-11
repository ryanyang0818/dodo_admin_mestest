"""ERP 工單維護作業（asfi301）唯讀查詢 API：TIPTOP sfb_file，經 MES 測試機 TOPPROD。"""
import calendar
import re
from collections.abc import Generator
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path
from app.core.tt_db import getTtConnection

MENU_KEY = "erp.wo-readonly"
MAX_DATE_RANGE_DAYS = 366
SAFE_TEXT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-erp-wo-readonly"],
)

# 匿名查詢連線只回傳一般錯誤，不揭露資料庫設定。
def wo_connection() -> Generator:
  try:
    yield from getTtConnection()
  except SQLAlchemyError:
    raise HTTPException(503, "ERP 暫時無法連線，請稍後再試") from None
  except HTTPException as error:
    if error.status_code == 503:
      raise HTTPException(503, "ERP 暫時無法連線，請稍後再試") from None
    raise


TtConnectionDep = Annotated[object, Depends(wo_connection)]


# 以台灣日期取得每次請求當下的月份範圍。
def current_month_start() -> date:
  return datetime.now(timezone(timedelta(hours=8))).date().replace(day=1)


# 計算當月最後一天，包含月底開單資料。
def current_month_end() -> date:
  start = current_month_start()
  return start.replace(day=calendar.monthrange(start.year, start.month)[1])


# 依使用者確認的 SFB04 欄位定義，不採用線上說明中相反的 2／3 對照。
WO_STATUS_LABELS = {
  "1": "確認生產工單(firm plan)",
  "2": "工單已發放,料表尚未列印",
  "3": "工單已發放,料表已列印",
  "4": "工單已發料",
  "5": "在製過程中",
  "6": "工單已完工,進入F.Q.C",
  "7": "完工入庫",
  "8": "結案",
}
WO_TYPE_LABELS = {
  1: "一般工單",
  2: "其他",
  5: "再加工工單",
  7: "委外工單",
  8: "重工委外工單",
  11: "拆件式工單",
  12: "其他",
  13: "預測工單",
  15: "試產工單",
}

# API 欄位 → Oracle 欄位（排序白名單同此表）
ORACLE_COLUMNS = {
  "wo": "sfb01",
  "wo_name": "smy.smydesc",
  "wo_type": "sfb02",
  "status": "sfb04",
  "confirmed": "sfb87",
  "part_no": "sfb05",
  "name": "i.ima02",
  "specification": "i.ima021",
  "issued_qty": "sfb081",
  "fqc": "sfb94",
  "plan_qty": "sfb08",
  "completed_qty": "sfb09",
  "scrap_qty": "sfb12",
  "plan_start_date": "sfb13",
  "plan_end_date": "sfb15",
  "line_no": "sfb102",
  "mes_flow_type": "sfbud10",
  "lot_no": "sfbud02",
  "input_date": "sfb81",
}


class ErpWoRow(SQLModel):
  wo: str
  wo_name: str | None = None
  wo_type: int | None = None
  status: str | None = None
  confirmed: str | None = None
  part_no: str | None = None
  name: str | None = None
  specification: str | None = None
  issued_qty: float | None = None
  fqc: str | None = None
  plan_qty: float | None = None
  completed_qty: float | None = None
  scrap_qty: float | None = None
  plan_start_date: date | None = None
  plan_end_date: date | None = None
  line_no: str | None = None
  mes_flow_type: int | None = None
  lot_no: str | None = None
  input_date: date | None = None


# 明細視窗額外欄位（對照 asfi301 畫面；Oracle 欄位 → API 欄位）
DETAIL_EXTRA_COLUMNS = {
  "approval_status": "sfb43",
  "need_sign": "sfbmksg",
  "close_status": "sfb28",
  "close_date": "sfb38",
  "applicant": "sfb44",
  "applicant_name": "gen.gen02",
  "change_no": "sfb101",
  "change_routing_no": "sfb103",
  "pbi_no": "sfb85",
  "parent_wo": "sfb86",
  "notice_no": "sfb91",
  "issue_labor_end_date": "sfb37",
  "backup_generated": "sfb23",
  "outsource_type": "sfb100",
  "custom_01": "sfbud01",
  "custom_04": "sfbud04",
  "custom_05": "sfbud05",
  "custom_06": "sfbud06",
  "custom_07": "sfbud07",
  "custom_08": "sfbud08",
  "custom_09": "sfbud09",
  "custom_11": "sfbud11",
  "custom_12": "sfbud12",
  "custom_13": "sfbud13",
  "custom_14": "sfbud14",
  "custom_15": "sfbud15",
  "completion_method": "sfb39",
  "cost_center": "sfb98",
  "cost_center_name": "gem.gem02",
  "vendor_dept": "sfb82",
  "order_no": "sfb22",
  "order_item": "sfb221",
  "bom_version": "sfb07",
  "structure_date": "sfb071",
  "has_routing": "sfb93",
  "routing_no": "sfb06",
  "unit": "i.ima55",
  "warehouse_check": "sfbud03",
  "export_country": "oea.oeaslk01",
  "export_country_name": "geb.geb02",
  "actual_start_date": "sfb25",
  "issue_end_date": "sfb36",
}
DETAIL_DATE_KEYS = ("custom_13", "custom_14", "custom_15", "issue_labor_end_date", "close_date", "structure_date", "actual_start_date", "issue_end_date")


class ErpWoDetail(ErpWoRow):
  approval_status: str | None = None
  need_sign: str | None = None
  close_status: str | None = None
  close_date: date | None = None
  applicant: str | None = None
  applicant_name: str | None = None
  change_no: str | None = None
  change_routing_no: str | None = None
  pbi_no: str | None = None
  parent_wo: str | None = None
  notice_no: str | None = None
  issue_labor_end_date: date | None = None
  backup_generated: str | None = None
  outsource_type: str | None = None
  custom_01: str | None = None
  custom_04: str | None = None
  custom_05: str | None = None
  custom_06: str | None = None
  custom_07: float | None = None
  custom_08: float | None = None
  custom_09: float | None = None
  custom_11: int | None = None
  custom_12: int | None = None
  custom_13: date | None = None
  custom_14: date | None = None
  custom_15: date | None = None
  completion_method: str | None = None
  cost_center: str | None = None
  cost_center_name: str | None = None
  vendor_dept: str | None = None
  order_no: str | None = None
  order_item: int | None = None
  bom_version: str | None = None
  structure_date: date | None = None
  has_routing: str | None = None
  routing_no: str | None = None
  unit: str | None = None
  warehouse_check: str | None = None
  export_country: str | None = None
  export_country_name: str | None = None
  actual_start_date: date | None = None
  issue_end_date: date | None = None


class ErpWoMaterial(SQLModel):
  replaced_part_no: str | None = None
  operation_no: str | None = None
  substitute_code: str | None = None
  substitute_rate: float | None = None
  part_no: str
  name: str | None = None
  specification: str | None = None
  source: str | None = None
  unit: str | None = None
  unit_rate: float | None = None
  flag: str | None = None
  std_qpa: float | None = None
  actual_qpa: float | None = None
  tolerance_rate: float | None = None
  required_qty: float | None = None
  outsource_buy_qty: float | None = None
  issued_qty: float | None = None
  over_issued_qty: float | None = None
  shortage_qty: float | None = None
  scrap_qty: float | None = None
  stock_loss_qty: float | None = None
  warehouse: str | None = None


class ErpWoResponse(SQLModel):
  data: list[ErpWoRow]
  count: int
  total: int
  page: int
  page_size: int
  sql: str
  params: dict[str, str | int]


class ErpWoSql(SQLModel):
  sql: str
  params: dict[str, str | int]


class ErpWoOption(SQLModel):
  value: str
  label: str


class ErpWoOptions(SQLModel):
  statuses: list[ErpWoOption]
  wo_types: list[ErpWoOption]


class ErpWoFilters(SQLModel):
  input_date_from: date = Field(default_factory=current_month_start)
  input_date_to: date = Field(default_factory=current_month_end)
  wo: str | None = Field(default=None, max_length=50)
  part_no: str | None = Field(default=None, max_length=50)
  status: Literal["1", "2", "3", "4", "5", "6", "7", "8"] | None = None
  wo_type: Literal[1, 2, 5, 7, 8, 11, 12, 13, 15] | None = None
  mes_flow_type: Literal["1", "2", "3", "4", "none"] | None = None
  sort_by: Literal[
    "wo", "wo_name", "wo_type", "status", "confirmed", "part_no", "plan_qty",
    "completed_qty", "scrap_qty", "plan_start_date", "plan_end_date", "line_no",
    "mes_flow_type", "lot_no", "input_date", "name", "specification", "issued_qty", "fqc",
  ] = "wo"
  sort_direction: Literal["asc", "desc"] = "asc"
  page: int = Field(default=1, ge=1)
  # 0 表示全部符合條件的資料；日期與其他篩選仍照常套用。
  page_size: Literal[0, 25, 50, 100] = 50

  # URL 查詢參數為字串，先轉換合法選項，再由 Literal 驗證。
  @field_validator("page_size", mode="before")
  @classmethod
  def parsePageSize(cls, value: object) -> object:
    if isinstance(value, str) and value in {"0", "25", "50", "100"}:
      return int(value)
    return value

  # 文字條件只允許安全字元，因 OPENQUERY 內無法使用 bind 參數
  @field_validator("wo", "part_no")
  @classmethod
  def validateSafeText(cls, value: str | None) -> str | None:
    if value is None or not value.strip():
      return None
    normalized = value.strip()
    if not SAFE_TEXT_PATTERN.fullmatch(normalized):
      raise ValueError("only letters, digits, '.', '_' and '-' are allowed")
    return normalized

  # 驗證日期順序與查詢範圍，避免大範圍掃描 TIPTOP
  @model_validator(mode="after")
  def validateDateRange(self) -> "ErpWoFilters":
    if self.input_date_to < self.input_date_from:
      raise ValueError("input_date_to must be on or after input_date_from")
    if (self.input_date_to - self.input_date_from).days > MAX_DATE_RANGE_DAYS:
      raise ValueError(f"date range cannot exceed {MAX_DATE_RANGE_DAYS} days")
    return self


ErpWoFiltersDep = Annotated[ErpWoFilters, Query()]


# 跳脫 Oracle LIKE 萬用字元（輸入已通過白名單，僅 _ 需處理）
def escapeOracleLike(value: str) -> str:
  return value.replace("\\", "\\\\").replace("_", "\\_")


# 依已驗證條件建立 Oracle 查詢，再包成 OPENQUERY(TOPPROD, ...)
def buildErpWoQuery(
  filters: ErpWoFilters,
  *,
  count_only: bool = False,
) -> tuple[str, dict[str, str | int]]:
  params: dict[str, str | int] = {
    "input_date_from": filters.input_date_from.isoformat(),
    "input_date_to": filters.input_date_to.isoformat(),
  }
  conditions = [
    f"sfb81 >= TO_DATE('{params['input_date_from']}', 'YYYY-MM-DD')",
    f"sfb81 < TO_DATE('{params['input_date_to']}', 'YYYY-MM-DD') + 1",
  ]
  for field_name, column_name in (("wo", "sfb01"), ("part_no", "sfb05")):
    value = getattr(filters, field_name)
    if value:
      params[field_name] = value
      conditions.append(f"{column_name} LIKE '{escapeOracleLike(value)}%' ESCAPE '\\'")
  if filters.status:
    params["status"] = filters.status
    conditions.append(f"sfb04 = '{filters.status}'")
  if filters.wo_type is not None:
    params["wo_type"] = filters.wo_type
    conditions.append(f"sfb02 = {int(filters.wo_type)}")
  if filters.mes_flow_type:
    params["mes_flow_type"] = filters.mes_flow_type
    conditions.append(
      "sfbud10 IS NULL" if filters.mes_flow_type == "none"
      else f"sfbud10 = {int(filters.mes_flow_type)}"
    )

  select_list = ", ".join(
    f"{oracle} AS {name}" for name, oracle in ORACLE_COLUMNS.items()
  )
  sort_column = ORACLE_COLUMNS[filters.sort_by]
  sort_direction = filters.sort_direction.upper()
  inner = (
    f"SELECT {select_list}, COUNT(*) OVER () AS total_count\n"
    "FROM MWF.sfb_file\n"
    "LEFT JOIN MWF.smy_file smy ON smy.smyslip = SUBSTR(sfb01, 1, INSTR(sfb01, '-') - 1)\n"
    "LEFT JOIN MWF.ima_file i ON i.ima01 = sfb05\n"
    "WHERE " + "\n  AND ".join(conditions) + "\n"
    f"ORDER BY {sort_column} {sort_direction}, sfb01 ASC"
  )
  if count_only:
    oracle_sql = "SELECT COUNT(*) AS total_count FROM MWF.sfb_file WHERE " + " AND ".join(conditions)
  elif filters.page_size == 0:
    oracle_sql = inner
    params["page_size"] = 0
  else:
    start = (filters.page - 1) * filters.page_size
    end = start + filters.page_size
    params["offset"] = start
    params["page_size"] = filters.page_size
    # Oracle 11g 以 ROWNUM 兩層分頁；不截斷可查詢的總筆數。
    oracle_sql = (
      "SELECT * FROM (\n"
      f"SELECT t.*, ROWNUM AS rn FROM (\n{inner}\n) t WHERE ROWNUM <= {end}\n"
      f") WHERE rn > {start}"
    )
  return "SELECT * FROM OPENQUERY(TOPPROD, '" + oracle_sql.replace("'", "''") + "')", params


# 將 OPENQUERY 結果轉成白名單模型
def erpWoRowFromMapping(row: dict[str, object]) -> ErpWoRow:
  data = {key.lower(): value for key, value in row.items()}
  for key in ("plan_start_date", "plan_end_date", "input_date"):
    value = data.get(key)
    if hasattr(value, "date"):
      data[key] = value.date()  # type: ignore[union-attr]
  for key in ("wo_type", "mes_flow_type"):
    if data.get(key) is not None:
      data[key] = int(data[key])  # type: ignore[call-overload]
  return ErpWoRow.model_validate({k: data.get(k) for k in ErpWoRow.model_fields})


# 只組出預計執行的 SQL，不連 TIPTOP
@router.get("/sql", response_model=ErpWoSql)
def readErpWoSql(filters: ErpWoFiltersDep) -> ErpWoSql:
  sql, params = buildErpWoQuery(filters)
  return ErpWoSql(sql=sql, params=params)


# 取得工單狀態與型態選項（靜態，不連資料庫）
@router.get("/options", response_model=ErpWoOptions)
def readErpWoOptions() -> ErpWoOptions:
  return ErpWoOptions(
    statuses=[ErpWoOption(value=k, label=f"{k} {v}") for k, v in WO_STATUS_LABELS.items()],
    wo_types=[
      ErpWoOption(value=str(k), label=f"{k} {v}")
      for k, v in WO_TYPE_LABELS.items()
      if v != "其他"
    ],
  )


# 驗證工單編號並回傳可安全放入 OPENQUERY 的字串
def cleanWo(wo: str) -> str:
  cleaned = wo.strip()
  if not SAFE_TEXT_PATTERN.fullmatch(cleaned):
    raise HTTPException(422, "工單編號格式錯誤")
  return cleaned


# 包成 OPENQUERY(TOPPROD, ...)
def openQuery(oracle_sql: str) -> str:
  return "SELECT * FROM OPENQUERY(TOPPROD, '" + oracle_sql.replace("'", "''") + "')"


# 依工單唯一鍵讀取明細（列表欄位 + asfi301 畫面額外欄位）。
@router.get("/detail", response_model=ErpWoDetail)
def readErpWoDetail(
  connection: TtConnectionDep,
  wo: Annotated[str, Query(min_length=1, max_length=50)],
) -> ErpWoDetail:
  cleaned = cleanWo(wo)
  columns = ", ".join(
    f"{column} AS {key}" for key, column in {**ORACLE_COLUMNS, **DETAIL_EXTRA_COLUMNS}.items()
  )
  oracle_sql = (
    f"SELECT {columns} FROM MWF.sfb_file "
    "LEFT JOIN MWF.smy_file smy ON smy.smyslip = SUBSTR(sfb01, 1, INSTR(sfb01, '-') - 1) "
    "LEFT JOIN MWF.ima_file i ON i.ima01 = sfb05 "
    "LEFT JOIN MWF.gen_file gen ON gen.gen01 = sfb44 "
    "LEFT JOIN MWF.gem_file gem ON gem.gem01 = sfb98 "
    "LEFT JOIN MWF.oea_file oea ON oea.oea01 = sfb22 "
    "LEFT JOIN MWF.geb_file geb ON geb.geb01 = oea.oeaslk01 "
    f"WHERE sfb01 = '{cleaned}'"
  )
  row = connection.execute(text(openQuery(oracle_sql))).mappings().first()
  if row is None:
    raise HTTPException(404, "找不到指定工單")
  data = {key.lower(): value for key, value in row.items()}
  for key in DETAIL_DATE_KEYS:
    if hasattr(data.get(key), "date"):
      data[key] = data[key].date()  # type: ignore[union-attr]
  for key in ("order_item", "custom_11", "custom_12"):
    if data.get(key) is not None:
      data[key] = int(data[key])  # type: ignore[call-overload]
  base = erpWoRowFromMapping(data).model_dump()
  extra = {k: data.get(k) for k in DETAIL_EXTRA_COLUMNS}
  return ErpWoDetail.model_validate({**base, **extra})


# 讀取工單用料明細（sfa_file），來源碼取自料件主檔 ima08。
@router.get("/materials", response_model=list[ErpWoMaterial])
def readErpWoMaterials(
  connection: TtConnectionDep,
  wo: Annotated[str, Query(min_length=1, max_length=50)],
) -> list[ErpWoMaterial]:
  cleaned = cleanWo(wo)
  oracle_sql = (
    "SELECT sfa27 AS replaced_part_no, sfa08 AS operation_no, sfa26 AS substitute_code, "
    "sfa28 AS substitute_rate, sfa03 AS part_no, i.ima02 AS name, i.ima021 AS specification, "
    "i.ima08 AS source, sfa12 AS unit, sfa13 AS unit_rate, sfa11 AS flag, "
    "sfa16 AS std_qpa, sfa161 AS actual_qpa, sfa100 AS tolerance_rate, "
    "sfa05 AS required_qty, sfa065 AS outsource_buy_qty, sfa06 AS issued_qty, "
    "sfa062 AS over_issued_qty, GREATEST(sfa05 - sfa06, 0) AS shortage_qty, "
    "sfa063 AS scrap_qty, sfa064 AS stock_loss_qty, sfa30 AS warehouse "
    "FROM MWF.sfa_file LEFT JOIN MWF.ima_file i ON i.ima01 = sfa03 "
    f"WHERE sfa01 = '{cleaned}' ORDER BY sfa27, sfa03, sfa08"
  )
  rows = connection.execute(text(openQuery(oracle_sql))).mappings().all()
  items = []
  for row in rows:
    data = {key.lower(): value for key, value in row.items()}
    for key in ("replaced_part_no", "operation_no", "substitute_code", "unit", "name", "specification", "source", "flag", "warehouse"):
      if isinstance(data.get(key), str):
        data[key] = data[key].strip() or None
    items.append(ErpWoMaterial.model_validate(data))
  return items


# 依條件查詢 TIPTOP 工單檔（唯讀、分頁）
@router.get("/", response_model=ErpWoResponse)
def readErpWo(connection: TtConnectionDep, filters: ErpWoFiltersDep) -> ErpWoResponse:
  sql, params = buildErpWoQuery(filters)
  rows = [
    {key.lower(): value for key, value in row.items()}
    for row in connection.execute(text(sql)).mappings().all()
  ]
  if rows:
    total = int(rows[0]["total_count"])
  else:
    count_sql, _ = buildErpWoQuery(filters, count_only=True)
    total = int(connection.execute(text(count_sql)).scalar_one())
  data = [erpWoRowFromMapping(row) for row in rows]
  return ErpWoResponse(
    data=data,
    count=len(data),
    total=total,
    page=1 if filters.page_size == 0 else filters.page,
    page_size=filters.page_size,
    sql=sql,
    params=params,
  )
