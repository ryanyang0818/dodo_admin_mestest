"""MES 工單唯讀報表 API（MES 正式區）。"""
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import model_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.mes_db import MesConnectionDep


MENU_KEY = "mes.wo"
ROW_LIMIT = 2000
MAX_DATE_RANGE_DAYS = 366

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-mes-wo-report"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class MesWoReportRow(SQLModel):
  wo: str
  status: str
  erp_status: str | None = None
  partno: str
  quantity: float | None = None
  unit: str | None = None
  route: str | None = None
  route_version: float | None = None
  wo_line: str | None = None
  schedule_date: datetime | None = None
  due_date: datetime | None = None
  release_date: datetime | None = None
  finish_date: datetime | None = None
  create_user: str | None = None
  create_date: datetime
  update_user: str | None = None
  update_date: datetime


class MesWoReportResponse(SQLModel):
  data: list[MesWoReportRow]
  count: int
  truncated: bool
  sql: str
  params: dict[str, str | int]


class MesWoReportSql(SQLModel):
  sql: str
  params: dict[str, str | int]


class MesWoOption(SQLModel):
  value: str
  label: str


class MesWoReportOptions(SQLModel):
  statuses: list[MesWoOption]
  routes: list[MesWoOption]


class MesWoReportFilters(SQLModel):
  create_date_from: date = Field(default_factory=lambda: date.today().replace(day=1))
  create_date_to: date = Field(default_factory=date.today)
  wo: str | None = Field(default=None, max_length=255)
  partno: str | None = Field(default=None, max_length=255)
  status: str | None = Field(default=None, max_length=255)
  route: str | None = Field(default=None, max_length=255)

  # 驗證日期順序與查詢範圍，避免不小心掃描過大區間
  @model_validator(mode="after")
  def validateDateRange(self) -> "MesWoReportFilters":
    if self.create_date_to < self.create_date_from:
      raise ValueError("create_date_to must be on or after create_date_from")
    if (self.create_date_to - self.create_date_from).days > MAX_DATE_RANGE_DAYS:
      raise ValueError(f"date range cannot exceed {MAX_DATE_RANGE_DAYS} days")
    return self


MesWoReportFiltersDep = Annotated[MesWoReportFilters, Query()]

MES_WO_SELECT = """SELECT TOP (:row_limit)
  w.WO AS wo,
  w.STATUS AS status,
  w.ERP_STATUS AS erp_status,
  w.PARTNO AS partno,
  w.QUANTITY AS quantity,
  w.UNIT AS unit,
  w.ROUTE AS route,
  w.ROUTE_VERSION AS route_version,
  w.WO_LINE AS wo_line,
  w.SCHEDULEDATE AS schedule_date,
  w.DUEDATE AS due_date,
  w.RELEASE_DATE AS release_date,
  w.FINISH_DATE AS finish_date,
  COALESCE(cu.USER_NAME, w.CREATE_USER) AS create_user,
  w.CREATE_DATE AS create_date,
  COALESCE(uu.USER_NAME, w.UPDATE_USER) AS update_user,
  w.UPDATE_DATE AS update_date
FROM MWF_GTIMES5.dbo.WP_WO w
LEFT JOIN MWF_GTIMES5.dbo.AD_USER cu ON cu.ACCOUNT_NO = w.CREATE_USER
LEFT JOIN MWF_GTIMES5.dbo.AD_USER uu ON uu.ACCOUNT_NO = w.UPDATE_USER"""

MES_WO_STATUS_OPTIONS_QUERY = text("""
  SELECT DISTINCT STATUS AS value, STATUS AS label
  FROM MWF_GTIMES5.dbo.WP_WO
  WHERE STATUS IS NOT NULL AND STATUS <> N''
  ORDER BY STATUS
""")

MES_WO_ROUTE_OPTIONS_QUERY = text("""
  SELECT DISTINCT ROUTE AS value, ROUTE AS label
  FROM MWF_GTIMES5.dbo.WP_WO
  WHERE ROUTE IS NOT NULL AND ROUTE <> N''
  ORDER BY ROUTE
""")


# 跳脫 SQL Server LIKE 萬用字元，讓輸入只做字面比對
def escapeLike(value: str) -> str:
  for char in ("\\", "%", "_", "["):
    value = value.replace(char, f"\\{char}")
  return value


# 依白名單條件組出參數化的 MES 工單查詢
def buildMesWoQuery(
  create_date_from: date,
  create_date_to: date,
  wo: str | None = None,
  partno: str | None = None,
  status: str | None = None,
  route: str | None = None,
) -> tuple[str, dict[str, str | int]]:
  conditions = [
    "w.CREATE_DATE >= :create_date_from",
    "w.CREATE_DATE < :create_date_to_exclusive",
  ]
  params: dict[str, str | int] = {
    "row_limit": ROW_LIMIT + 1,
    "create_date_from": create_date_from.isoformat(),
    "create_date_to_exclusive": (create_date_to + timedelta(days=1)).isoformat(),
  }

  if wo and wo.strip():
    conditions.append("w.WO LIKE :wo ESCAPE '\\'")
    params["wo"] = f"%{escapeLike(wo.strip())}%"
  if partno and partno.strip():
    conditions.append("w.PARTNO LIKE :partno ESCAPE '\\'")
    params["partno"] = f"%{escapeLike(partno.strip())}%"
  if status and status.strip():
    conditions.append("w.STATUS = :status")
    params["status"] = status.strip()
  if route and route.strip():
    conditions.append("w.ROUTE = :route")
    params["route"] = route.strip()

  sql = MES_WO_SELECT + "\nWHERE " + "\n  AND ".join(conditions)
  sql += "\nORDER BY w.CREATE_DATE DESC, w.WO DESC"
  return sql, params


# 只組出預計執行的 SQL，不連 MES
@router.get("/sql", response_model=MesWoReportSql)
def readMesWoReportSql(filters: MesWoReportFiltersDep) -> MesWoReportSql:
  sql, params = buildMesWoQuery(**filters.model_dump())
  return MesWoReportSql(sql=sql, params=params)


# 依條件查詢 MES 正式區工單報表
@router.get("/", response_model=MesWoReportResponse)
def readMesWoReport(
  connection: MesConnectionDep,
  filters: MesWoReportFiltersDep,
) -> MesWoReportResponse:
  sql, params = buildMesWoQuery(**filters.model_dump())
  rows = connection.execute(text(sql), params).mappings().all()
  data = [MesWoReportRow.model_validate(dict(row)) for row in rows[:ROW_LIMIT]]
  return MesWoReportResponse(
    data=data,
    count=len(data),
    truncated=len(rows) > ROW_LIMIT,
    sql=sql,
    params=params,
  )


# 取得 MES 工單狀態與流程下拉選項
@router.get("/options", response_model=MesWoReportOptions)
def readMesWoReportOptions(connection: MesConnectionDep) -> MesWoReportOptions:
  statuses = connection.execute(MES_WO_STATUS_OPTIONS_QUERY).mappings().all()
  routes = connection.execute(MES_WO_ROUTE_OPTIONS_QUERY).mappings().all()
  return MesWoReportOptions(
    statuses=[MesWoOption.model_validate(dict(row)) for row in statuses],
    routes=[MesWoOption.model_validate(dict(row)) for row in routes],
  )
