"""ERP 功能表程式清單唯讀 API：TIPTOP zm_file（目錄檔）對 gaz_file（程式名稱檔），同一程式只顯示一次。"""
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import field_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.tt_db import TtConnectionDep


MENU_KEY = "erp.menu-readonly"
# 文字條件只允許文字（含中日韓）、數字、空白與少數符號；OPENQUERY 內無法使用 bind 參數
SAFE_TEXT_PATTERN = re.compile(r"^[\w .\-()（）/]+$")

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-erp-menu-readonly"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)

# API 欄位 → Oracle 欄位（排序白名單同此表）
ORACLE_COLUMNS = {
  "program_code": "z.zm04",
  "program_name": "g.gaz03",
  "purpose": "g.gaz04",
}


class ErpMenuRow(SQLModel):
  program_code: str
  program_name: str | None = None
  purpose: str | None = None


class ErpMenuResponse(SQLModel):
  data: list[ErpMenuRow]
  count: int
  total: int
  page: int
  page_size: int


class ErpMenuFilters(SQLModel):
  program_code: str | None = Field(default=None, max_length=50)
  program_name: str | None = Field(default=None, max_length=50)
  sort_by: Literal["program_code", "program_name"] = "program_code"
  sort_direction: Literal["asc", "desc"] = "asc"
  page: int = Field(default=1, ge=1, le=10_000)
  page_size: int = Field(default=50, ge=10, le=100)

  # 文字條件只允許安全字元，避免注入 OPENQUERY 字串
  @field_validator("program_code", "program_name")
  @classmethod
  def validateSafeText(cls, value: str | None) -> str | None:
    if value is None or not value.strip():
      return None
    normalized = value.strip()
    if not SAFE_TEXT_PATTERN.fullmatch(normalized):
      raise ValueError("only letters, digits, spaces and . _ - ( ) / are allowed")
    return normalized


ErpMenuFiltersDep = Annotated[ErpMenuFilters, Query()]


# 跳脫 Oracle LIKE 萬用字元
def escapeOracleLike(value: str) -> str:
  return value.replace("\\", "\\\\").replace("_", "\\_")


# 依已驗證條件建立 Oracle 查詢，再包成 OPENQUERY(TOPPROD, ...)
def buildErpMenuQuery(filters: ErpMenuFilters) -> str:
  conditions = ["1 = 1"]
  for value, column in ((filters.program_code, "z.zm04"), (filters.program_name, "g.gaz03")):
    if value:
      conditions.append(
        f"LOWER({column}) LIKE '%{escapeOracleLike(value.lower())}%' ESCAPE '\\'"
      )
  select_list = ", ".join(f"{oracle} AS {name}" for name, oracle in ORACLE_COLUMNS.items())
  sort_column = ORACLE_COLUMNS[filters.sort_by]
  sort_direction = filters.sort_direction.upper()
  inner = (
    f"SELECT {select_list}, COUNT(*) OVER () AS total_count\n"
    "FROM (SELECT DISTINCT zm04 FROM MWF.zm_file) z\n"
    "LEFT JOIN MWF.gaz_file g ON g.gaz01 = z.zm04 AND g.gaz02 = '0'\n"
    "WHERE " + "\n  AND ".join(conditions) + "\n"
    f"ORDER BY {sort_column} {sort_direction}, z.zm04 ASC"
  )
  start = (filters.page - 1) * filters.page_size
  end = start + filters.page_size
  # Oracle 11g 無 OFFSET/FETCH，以 ROWNUM 兩層分頁
  oracle_sql = (
    "SELECT * FROM (\n"
    f"SELECT t.*, ROWNUM AS rn FROM (\n{inner}\n) t WHERE ROWNUM <= {end}\n"
    f") WHERE rn > {start}"
  )
  return "SELECT * FROM OPENQUERY(TOPPROD, '" + oracle_sql.replace("'", "''") + "')"


# 查詢功能表與程式名稱（唯讀、分頁）
@router.get("/", response_model=ErpMenuResponse)
def readErpMenu(connection: TtConnectionDep, filters: ErpMenuFiltersDep) -> ErpMenuResponse:
  rows = [
    {key.lower(): value for key, value in row.items()}
    for row in connection.execute(text(buildErpMenuQuery(filters))).mappings().all()
  ]
  total = int(rows[0]["total_count"]) if rows else 0
  data = [
    ErpMenuRow(
      program_code=row["program_code"],
      program_name=row["program_name"],
      purpose=row["purpose"],
    )
    for row in rows
  ]
  return ErpMenuResponse(
    data=data,
    count=len(data),
    total=total,
    page=filters.page,
    page_size=filters.page_size,
  )
