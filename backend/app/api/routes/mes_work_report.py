"""MES 報工唯讀報表 API（MES 正式區）。"""
import csv
import io
from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import model_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.mes_db import MesConnectionDep


MENU_KEY = "mes.work-report"
MAX_DATE_RANGE_DAYS = 366
MAX_EXPORT_ROWS = 20_000

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-mes-work-report"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class MesWorkReportRow(SQLModel):
  row_key: str
  wo: str | None = None
  lot: str
  part_no: str | None = None
  output_qty: float | None = None
  scrap_qty: float | None = None
  status: str
  report_user_num: float | None = None
  work_total: float | None = None
  equipment_total: float | None = None
  report_date: datetime
  line_no: str | None = None
  lot_status: str | None = None
  route_no: str | None = None
  operation_no: str | None = None
  operation: str | None = None
  start_time: datetime | None = None
  end_time: datetime | None = None
  erp_status: str | None = None
  erp_date: datetime | None = None
  erp_message: str | None = None
  mes_no: str | None = None
  note: str | None = None
  station_remark: str | None = None
  update_date: datetime | None = None


class MesWorkPersonnelRow(SQLModel):
  operation_no: str | None = None
  user_no: str
  start_time: datetime
  end_time: datetime | None = None
  total_seconds: float | None = None


class MesWorkReportDetails(SQLModel):
  report: MesWorkReportRow
  personnel: list[MesWorkPersonnelRow]


class MesWorkReportResponse(SQLModel):
  data: list[MesWorkReportRow]
  count: int
  total: int
  page: int
  page_size: int
  sql: str
  params: dict[str, str | int]


class MesWorkReportSql(SQLModel):
  sql: str
  params: dict[str, str | int]


class MesWorkOption(SQLModel):
  value: str
  label: str


class MesWorkReportOptions(SQLModel):
  statuses: list[MesWorkOption]
  erp_statuses: list[MesWorkOption]
  lines: list[MesWorkOption]


class MesWorkReportFilters(SQLModel):
  report_date_from: date = Field(default_factory=lambda: date.today().replace(day=1))
  report_date_to: date = Field(default_factory=date.today)
  wo: str | None = Field(default=None, max_length=255)
  lot: str | None = Field(default=None, max_length=255)
  part_no: str | None = Field(default=None, max_length=255)
  status: Literal["I", "N", "Y"] | None = None
  line_no: str | None = Field(default=None, max_length=255)
  erp_status: Literal["W", "D", "E", "U"] | None = None
  sort_by: Literal[
    "wo", "lot", "part_no", "output_qty", "scrap_qty", "status",
    "report_user_num", "work_total", "equipment_total", "report_date", "line_no",
    "lot_status", "route_no", "start_time", "end_time", "erp_status", "erp_date",
    "mes_no",
  ] = "report_date"
  sort_direction: Literal["asc", "desc"] = "desc"
  page: int = Field(default=1, ge=1)
  page_size: int = Field(default=50, ge=10, le=100)

  # 驗證日期順序與查詢範圍，避免正式區大範圍掃描
  @model_validator(mode="after")
  def validateDateRange(self) -> "MesWorkReportFilters":
    if self.report_date_to < self.report_date_from:
      raise ValueError("report_date_to must be on or after report_date_from")
    if (self.report_date_to - self.report_date_from).days > MAX_DATE_RANGE_DAYS:
      raise ValueError(f"date range cannot exceed {MAX_DATE_RANGE_DAYS} days")
    return self


MesWorkReportFiltersDep = Annotated[MesWorkReportFilters, Query()]

MES_WORK_REPORT_CTE = """WITH unified AS (
  SELECT
    CONCAT(N'erp:', e.SID) AS row_key,
    e.WO AS wo,
    e.LOT AS lot,
    e.PART_NO AS part_no,
    e.OUTPUT_QTY AS output_qty,
    e.SCRAP_QTY AS scrap_qty,
    e.STATUS AS status,
    e.REPORT_USER_NUM AS report_user_num,
    e.WORK_TOTAL AS work_total,
    e.EQUIPMENT_TOTAL AS equipment_total,
    e.REPORT_DATE AS report_date,
    e.LINE_NO AS line_no,
    e.ROUTE_NO AS route_no,
    e.ROUTE_VER_OPER_SID AS route_ver_oper_sid,
    e.ACTION_LINK_SID AS action_link_sid,
    e.START_TIME AS start_time,
    e.END_TIME AS end_time,
    e.ERP_STATUS AS erp_status,
    e.ERP_DATE AS erp_date,
    e.ERP_MESSAGE AS erp_message,
    e.MES_NO AS mes_no,
    e.NOTE AS note,
    e.UPDATE_DATE AS update_date
  FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_ERP_SUMMARY e

  UNION ALL

  SELECT
    CONCAT(N'draft:', s.SID) AS row_key,
    s.WO AS wo,
    s.LOT AS lot,
    s.PART_NO AS part_no,
    s.OUTPUT_QTY AS output_qty,
    CAST(0 AS decimal(18, 5)) AS scrap_qty,
    s.STATUS AS status,
    s.REPORT_USER_NUM AS report_user_num,
    s.WORK_TOTAL AS work_total,
    s.EQUIPMENT_TOTAL AS equipment_total,
    COALESCE(s.WORK_DATE, s.TX_DATE, s.CREATE_DATE) AS report_date,
    s.LINE_NO AS line_no,
    CAST(NULL AS nvarchar(255)) AS route_no,
    s.ROUTE_VER_OPER_SID AS route_ver_oper_sid,
    s.ACTION_LINK_SID AS action_link_sid,
    s.WORK_START_DATE AS start_time,
    s.WORK_DATE AS end_time,
    CAST(NULL AS char(1)) AS erp_status,
    CAST(NULL AS datetime) AS erp_date,
    CAST(NULL AS nvarchar(1000)) AS erp_message,
    CAST(NULL AS nvarchar(40)) AS mes_no,
    s.NOTE AS note,
    s.UPDATE_DATE AS update_date
  FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_SUMMARY s
  WHERE NOT EXISTS (
    SELECT 1
    FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_ERP_SUMMARY e
    WHERE e.ACTION_LINK_SID IS NOT NULL
      AND e.ACTION_LINK_SID = s.ACTION_LINK_SID
  )
),
enriched AS (
  SELECT
    r.*,
    lot_info.lot_status,
    COALESCE(r.route_no, operation_info.route_no) AS resolved_route_no,
    operation_info.operation_no,
    operation_info.operation,
    remark_info.station_remark
  FROM unified r
  OUTER APPLY (
    SELECT TOP (1) l.STATUS AS lot_status
    FROM MWF_GTIMES5.dbo.WP_LOT l
    WHERE l.LOT = r.lot
    ORDER BY l.UPDATE_DATE DESC
  ) lot_info
  OUTER APPLY (
    SELECT TOP (1)
      p.ROUTE_NO AS route_no,
      p.OPERATION_NO AS operation_no,
      p.OPERATION AS operation
    FROM MWF_GTIMES5.dbo.PF_ROUTE_VER_OPER p
    WHERE p.ROUTE_VER_OPER_SID = r.route_ver_oper_sid
  ) operation_info
  OUTER APPLY (
    SELECT TOP (1) rem.REMARK AS station_remark
    FROM MWF_GTIMES5.dbo.WP_LOT_REMARK rem
    WHERE rem.ACTION_LINK_SID = r.action_link_sid
    ORDER BY rem.CREATE_DATE DESC
  ) remark_info
)"""

REPORT_COLUMNS = """r.row_key, r.wo, r.lot, r.part_no, r.output_qty, r.scrap_qty,
  r.status, r.report_user_num, r.work_total, r.equipment_total, r.report_date,
  r.line_no, r.lot_status, r.resolved_route_no AS route_no,
  r.operation_no, r.operation, r.start_time, r.end_time,
  r.erp_status, r.erp_date, r.erp_message, r.mes_no, r.note,
  r.station_remark, r.update_date"""

SORT_COLUMNS = {
  "wo": "r.wo",
  "lot": "r.lot",
  "part_no": "r.part_no",
  "output_qty": "r.output_qty",
  "scrap_qty": "r.scrap_qty",
  "status": "r.status",
  "report_user_num": "r.report_user_num",
  "work_total": "r.work_total",
  "equipment_total": "r.equipment_total",
  "report_date": "r.report_date",
  "line_no": "r.line_no",
  "lot_status": "r.lot_status",
  "route_no": "r.resolved_route_no",
  "start_time": "r.start_time",
  "end_time": "r.end_time",
  "erp_status": "r.erp_status",
  "erp_date": "r.erp_date",
  "mes_no": "r.mes_no",
}

MES_WORK_LINES_QUERY = text("""
  SELECT value, value AS label
  FROM (
    SELECT DISTINCT LINE_NO AS value
    FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_ERP_SUMMARY
    WHERE LINE_NO IS NOT NULL AND LINE_NO <> N''
    UNION
    SELECT DISTINCT LINE_NO
    FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_SUMMARY
    WHERE LINE_NO IS NOT NULL AND LINE_NO <> N''
  ) lines
  ORDER BY value
""")


# 跳脫 SQL Server LIKE 萬用字元，讓輸入只做字面比對
def escapeLike(value: str) -> str:
  for char in ("\\", "%", "_", "["):
    value = value.replace(char, f"\\{char}")
  return value


# 依白名單條件建立完整報工查詢
def buildMesWorkReportQuery(
  filters: MesWorkReportFilters,
  *,
  export: bool = False,
) -> tuple[str, dict[str, str | int]]:
  conditions = [
    "r.report_date >= :report_date_from",
    "r.report_date < :report_date_to_exclusive",
  ]
  params: dict[str, str | int] = {
    "report_date_from": filters.report_date_from.isoformat(),
    "report_date_to_exclusive": (filters.report_date_to + timedelta(days=1)).isoformat(),
  }

  for field_name, column_name in (
    ("wo", "r.wo"),
    ("lot", "r.lot"),
    ("part_no", "r.part_no"),
  ):
    value = getattr(filters, field_name)
    if value and value.strip():
      conditions.append(f"{column_name} LIKE :{field_name} ESCAPE '\\'")
      params[field_name] = f"%{escapeLike(value.strip())}%"
  if filters.status:
    conditions.append("r.status = :status")
    params["status"] = filters.status
  if filters.line_no and filters.line_no.strip():
    conditions.append("r.line_no = :line_no")
    params["line_no"] = filters.line_no.strip()
  if filters.erp_status:
    conditions.append("r.erp_status = :erp_status")
    params["erp_status"] = filters.erp_status

  sort_column = SORT_COLUMNS[filters.sort_by]
  sort_direction = filters.sort_direction.upper()
  if export:
    params["export_limit"] = MAX_EXPORT_ROWS + 1
    select_clause = f"SELECT TOP (:export_limit) {REPORT_COLUMNS}"
  else:
    params["offset"] = (filters.page - 1) * filters.page_size
    params["page_size"] = filters.page_size
    select_clause = f"SELECT {REPORT_COLUMNS}, COUNT_BIG(*) OVER() AS total_count"

  sql = MES_WORK_REPORT_CTE + "\n" + select_clause
  sql += "\nFROM enriched r\nWHERE " + "\n  AND ".join(conditions)
  sql += f"\nORDER BY {sort_column} {sort_direction}, r.row_key ASC"
  if not export:
    sql += "\nOFFSET :offset ROWS FETCH NEXT :page_size ROWS ONLY"
  return sql, params


# 依安全 row key 建立單筆頭端查詢
def buildMesWorkDetailsQuery() -> str:
  return (
    MES_WORK_REPORT_CTE
    + f"\nSELECT {REPORT_COLUMNS}\nFROM enriched r\nWHERE r.row_key = :row_key"
  )


# 將資料列轉成報表白名單模型
def mesWorkRowFromMapping(row: dict[str, object]) -> MesWorkReportRow:
  data = dict(row)
  data.pop("total_count", None)
  return MesWorkReportRow.model_validate(data)


# 依狀態代碼輸出人類可讀文字
def statusLabel(value: object) -> str:
  return {"I": "維護中", "N": "待上傳", "Y": "已上傳"}.get(str(value), str(value or ""))


# 依 ERP 狀態代碼輸出人類可讀文字
def erpStatusLabel(value: object) -> str:
  return {
    "W": "待處理",
    "D": "已處理",
    "E": "錯誤",
    "U": "錯誤待重送",
  }.get(str(value), str(value or ""))


# 只組出預計執行的 SQL，不連 MES
@router.get("/sql", response_model=MesWorkReportSql)
def readMesWorkReportSql(filters: MesWorkReportFiltersDep) -> MesWorkReportSql:
  sql, params = buildMesWorkReportQuery(filters)
  return MesWorkReportSql(sql=sql, params=params)


# 取得報工狀態、ERP 狀態與線別選項
@router.get("/options", response_model=MesWorkReportOptions)
def readMesWorkReportOptions(connection: MesConnectionDep) -> MesWorkReportOptions:
  lines = connection.execute(MES_WORK_LINES_QUERY).mappings().all()
  return MesWorkReportOptions(
    statuses=[
      MesWorkOption(value="I", label="維護中"),
      MesWorkOption(value="N", label="待上傳"),
      MesWorkOption(value="Y", label="已上傳"),
    ],
    erp_statuses=[
      MesWorkOption(value="W", label="待處理"),
      MesWorkOption(value="D", label="已處理"),
      MesWorkOption(value="E", label="錯誤"),
      MesWorkOption(value="U", label="錯誤待重送"),
    ],
    lines=[MesWorkOption.model_validate(dict(row)) for row in lines],
  )


# 匯出完整篩選結果，避免只匯出目前分頁
@router.get("/export")
def exportMesWorkReport(
  connection: MesConnectionDep,
  filters: MesWorkReportFiltersDep,
) -> Response:
  sql, params = buildMesWorkReportQuery(filters, export=True)
  rows = connection.execute(text(sql), params).mappings().all()
  if len(rows) > MAX_EXPORT_ROWS:
    raise HTTPException(status_code=422, detail="匯出超過 20000 筆，請縮小查詢條件")

  output = io.StringIO(newline="")
  writer = csv.writer(output, lineterminator="\r\n")
  writer.writerow([
    "工單編號", "批號", "料號", "數量", "報廢數量", "狀態",
    "報工人數", "人時(分)", "機時(分)", "報工時間", "線別代碼",
    "批號狀態", "流程", "報工時間起", "報工時間迄", "ERP 介接狀態",
    "ERP 介接處理日期", "MES 單號", "說明", "過站說明",
  ])
  for row in rows:
    writer.writerow([
      row["wo"], row["lot"], row["part_no"], row["output_qty"], row["scrap_qty"],
      statusLabel(row["status"]), row["report_user_num"], row["work_total"],
      row["equipment_total"], row["report_date"], row["line_no"], row["lot_status"],
      row["route_no"], row["start_time"], row["end_time"],
      erpStatusLabel(row["erp_status"]), row["erp_date"], row["mes_no"],
      row["note"], row["station_remark"],
    ])
  filename = f"mes-work-report-{date.today().isoformat()}.csv"
  return Response(
    content="\ufeff" + output.getvalue(),
    media_type="text/csv; charset=utf-8",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
  )


# 取得單筆完整頭端與人員明細
@router.get("/{row_key}/details", response_model=MesWorkReportDetails)
def readMesWorkReportDetails(
  row_key: str,
  connection: MesConnectionDep,
) -> MesWorkReportDetails:
  source_type, separator, source_sid = row_key.partition(":")
  if not separator or source_type not in {"erp", "draft"} or not source_sid:
    raise HTTPException(status_code=404, detail="報工資料不存在")

  report_row = connection.execute(
    text(buildMesWorkDetailsQuery()),
    {"row_key": row_key},
  ).mappings().first()
  if report_row is None:
    raise HTTPException(status_code=404, detail="報工資料不存在")

  personnel_sql = text("""
    WITH target_erp AS (
      SELECT e.ACTION_LINK_SID
      FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_ERP_SUMMARY e
      WHERE :source_type = N'erp'
        AND e.SID = :source_sid
        AND e.ACTION_LINK_SID IS NOT NULL
    ),
    target_summary AS (
      SELECT s.SID, s.ACTION_LINK_SID, s.ACTION_LINK_SID_TRACE
      FROM MWF_GTIMES5.dbo.ZZ_OPER_WORKT_SUMMARY s
      WHERE (:source_type = N'draft' AND s.SID = :source_sid)
         OR (
           :source_type = N'erp'
           AND EXISTS (SELECT 1 FROM target_erp e WHERE e.ACTION_LINK_SID = s.ACTION_LINK_SID)
         )
    ),
    summary_links AS (
      SELECT ACTION_LINK_SID AS action_link_sid
      FROM target_erp
      UNION
      SELECT ACTION_LINK_SID AS action_link_sid
      FROM target_summary
      WHERE ACTION_LINK_SID IS NOT NULL
      UNION
      SELECT LTRIM(RTRIM(link.value))
      FROM target_summary s
      CROSS APPLY STRING_SPLIT(COALESCE(s.ACTION_LINK_SID_TRACE, N''), N';') link
      WHERE LTRIM(RTRIM(link.value)) <> N''
    )
    SELECT DISTINCT
      detail.OPER_NO AS operation_no,
      detail.USER_NO AS user_no,
      detail.START_TIME AS start_time,
      detail.END_TIME AS end_time,
      detail.TOTAL_TIME AS total_seconds
    FROM summary_links links
    JOIN MWF_GTIMES5.dbo.WP_USER_TRACE_IN detail
      ON detail.ACTION_LINK_SID = links.action_link_sid
    ORDER BY detail.START_TIME, detail.USER_NO
  """)
  personnel_rows = connection.execute(
    personnel_sql,
    {"source_type": source_type, "source_sid": source_sid},
  ).mappings().all()
  return MesWorkReportDetails(
    report=mesWorkRowFromMapping(dict(report_row)),
    personnel=[MesWorkPersonnelRow.model_validate(dict(row)) for row in personnel_rows],
  )


# 依條件查詢 MES 正式區完整報工資料集
@router.get("/", response_model=MesWorkReportResponse)
def readMesWorkReport(
  connection: MesConnectionDep,
  filters: MesWorkReportFiltersDep,
) -> MesWorkReportResponse:
  sql, params = buildMesWorkReportQuery(filters)
  rows = connection.execute(text(sql), params).mappings().all()
  total = int(rows[0]["total_count"]) if rows else 0
  data = [mesWorkRowFromMapping(dict(row)) for row in rows]
  return MesWorkReportResponse(
    data=data,
    count=len(data),
    total=total,
    page=filters.page,
    page_size=filters.page_size,
    sql=sql,
    params=params,
  )
