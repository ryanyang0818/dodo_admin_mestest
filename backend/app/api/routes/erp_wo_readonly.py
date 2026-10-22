"""ERP 工單維護作業（asfi301）唯讀查詢 API：TIPTOP sfb_file，經 MES 測試機 TOPPROD。"""
import csv
import io
import re
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import field_validator, model_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.tt_db import TtConnectionDep


MENU_KEY = "erp.wo-readonly"
MAX_DATE_RANGE_DAYS = 366
MAX_EXPORT_ROWS = 20_000
SAFE_TEXT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-erp-wo-readonly"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)

WO_STATUS_LABELS = {
  "1": "確認生產工單",
  "2": "已發放，料表未列印",
  "3": "已發放，料表已列印",
  "4": "已發料",
  "5": "在製過程中",
  "6": "已完工，進入 FQC",
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
  plan_qty: float | None = None
  completed_qty: float | None = None
  scrap_qty: float | None = None
  plan_start_date: date | None = None
  plan_end_date: date | None = None
  line_no: str | None = None
  mes_flow_type: int | None = None
  lot_no: str | None = None
  input_date: date | None = None


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
  input_date_from: date = Field(default_factory=lambda: date.today().replace(day=1))
  input_date_to: date = Field(default_factory=date.today)
  wo: str | None = Field(default=None, max_length=50)
  part_no: str | None = Field(default=None, max_length=50)
  status: Literal["1", "2", "3", "4", "5", "6", "7", "8"] | None = None
  wo_type: Literal[1, 2, 5, 7, 8, 11, 12, 13, 15] | None = None
  mes_flow_type: Literal["1", "2", "3", "4", "none"] | None = None
  line_no: str | None = Field(default=None, max_length=50)
  include_inactive: bool = False
  sort_by: Literal[
    "wo", "wo_name", "wo_type", "status", "confirmed", "part_no", "plan_qty",
    "completed_qty", "scrap_qty", "plan_start_date", "plan_end_date", "line_no",
    "mes_flow_type", "lot_no", "input_date",
  ] = "input_date"
  sort_direction: Literal["asc", "desc"] = "desc"
  page: int = Field(default=1, ge=1, le=10_000)
  page_size: int = Field(default=50, ge=10, le=100)

  # 文字條件只允許安全字元，因 OPENQUERY 內無法使用 bind 參數
  @field_validator("wo", "part_no", "line_no")
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
  export: bool = False,
) -> tuple[str, dict[str, str | int]]:
  params: dict[str, str | int] = {
    "input_date_from": filters.input_date_from.isoformat(),
    "input_date_to": filters.input_date_to.isoformat(),
  }
  conditions = [
    f"sfb81 >= TO_DATE('{params['input_date_from']}', 'YYYY-MM-DD')",
    f"sfb81 < TO_DATE('{params['input_date_to']}', 'YYYY-MM-DD') + 1",
  ]
  if not filters.include_inactive:
    conditions.append("sfbacti = 'Y'")
  for field_name, column_name in (("wo", "sfb01"), ("part_no", "sfb05")):
    value = getattr(filters, field_name)
    if value:
      params[field_name] = value
      conditions.append(f"{column_name} LIKE '%{escapeOracleLike(value)}%' ESCAPE '\\'")
  if filters.line_no:
    params["line_no"] = filters.line_no
    conditions.append(f"sfb102 = '{filters.line_no}'")
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
    "WHERE " + "\n  AND ".join(conditions) + "\n"
    f"ORDER BY {sort_column} {sort_direction}, sfb01 ASC"
  )
  if export:
    params["export_limit"] = MAX_EXPORT_ROWS + 1
    oracle_sql = f"SELECT * FROM (\n{inner}\n) WHERE ROWNUM <= {MAX_EXPORT_ROWS + 1}"
  else:
    start = (filters.page - 1) * filters.page_size
    end = start + filters.page_size
    params["offset"] = start
    params["page_size"] = filters.page_size
    # Oracle 11g 無 OFFSET/FETCH，以 ROWNUM 兩層分頁
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


# 依狀態代碼輸出人類可讀文字
def woStatusLabel(value: object) -> str:
  return WO_STATUS_LABELS.get(str(value), str(value or ""))


# 依確認碼輸出人類可讀文字
def confirmedLabel(value: object) -> str:
  return {"Y": "Y:確認", "N": "N:未確認", "X": "X:作廢"}.get(str(value), str(value or ""))


# 依工單型態代碼輸出人類可讀文字
def woTypeLabel(value: object) -> str:
  return WO_TYPE_LABELS.get(int(value), str(value)) if value is not None else ""


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


# 匯出完整篩選結果，避免只匯出目前分頁
@router.get("/export")
def exportErpWo(connection: TtConnectionDep, filters: ErpWoFiltersDep) -> Response:
  sql, _ = buildErpWoQuery(filters, export=True)
  rows = connection.execute(text(sql)).mappings().all()
  if len(rows) > MAX_EXPORT_ROWS:
    raise HTTPException(status_code=422, detail="匯出超過 20000 筆，請縮小查詢條件")

  output = io.StringIO(newline="")
  writer = csv.writer(output, lineterminator="\r\n")
  writer.writerow([
    "工單編號", "工單名稱", "工單型態", "確認否", "工單狀態", "料號", "生產數量", "完工入庫數量",
    "報廢數量", "預計開工日", "預計完工日", "生產線(MES報工預設)",
    "MES工單流程類型", "生產批號", "輸入日期",
  ])
  for raw in rows:
    row = erpWoRowFromMapping(dict(raw))
    writer.writerow([
      row.wo, row.wo_name, woTypeLabel(row.wo_type), confirmedLabel(row.confirmed),
      woStatusLabel(row.status), row.part_no,
      row.plan_qty, row.completed_qty, row.scrap_qty, row.plan_start_date,
      row.plan_end_date, row.line_no, row.mes_flow_type, row.lot_no, row.input_date,
    ])
  filename = f"erp-wo-readonly-{date.today().isoformat()}.csv"
  return Response(
    content="﻿" + output.getvalue(),
    media_type="text/csv; charset=utf-8",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
  )


# 依條件查詢 TIPTOP 工單檔（唯讀、分頁）
@router.get("/", response_model=ErpWoResponse)
def readErpWo(connection: TtConnectionDep, filters: ErpWoFiltersDep) -> ErpWoResponse:
  sql, params = buildErpWoQuery(filters)
  rows = [
    {key.lower(): value for key, value in row.items()}
    for row in connection.execute(text(sql)).mappings().all()
  ]
  total = int(rows[0]["total_count"]) if rows else 0
  data = [erpWoRowFromMapping(row) for row in rows]
  return ErpWoResponse(
    data=data,
    count=len(data),
    total=total,
    page=filters.page,
    page_size=filters.page_size,
    sql=sql,
    params=params,
  )
