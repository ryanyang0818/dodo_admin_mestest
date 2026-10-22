"""資料庫字典（TIPTOP）：查詢資料表與欄位的中文說明，只查結構，不查資料內容。"""
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import field_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.tt_db import TtConnectionDep


MENU_KEY = "database.tt-dictionary"
# 搜尋字串只允許文字（含中日韓）、數字、空白、「.」「_」「-」；OPENQUERY 內無法使用 bind 參數
SAFE_TEXT_PATTERN = re.compile(r"^[\w .\-]+$")
TABLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_$#]{1,30}$")
# MWF 是 TIPTOP 的資料表擁有者；gat/gaq 的語言別 '0' 為繁體中文
SCHEMA_OWNER = "MWF"
LANGUAGE_TRADITIONAL = "0"
# 一次回傳全部資料表（MWF 約 2,300 張）；仍設上限避免異常資料量
MAX_TABLES = 5_000

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-database-tt-dictionary"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class TtTableRow(SQLModel):
  table_name: str
  table_label: str | None = None
  module: str | None = None
  row_estimate: int | None = None
  matched_columns: int = 0


class TtTablesResponse(SQLModel):
  data: list[TtTableRow]
  count: int
  total: int


class TtColumnRow(SQLModel):
  column_id: int
  column_name: str
  column_label: str | None = None
  data_type: str
  data_length: int | None = None
  data_precision: int | None = None
  data_scale: int | None = None
  nullable: bool
  description: str | None = None


class TtColumnsResponse(SQLModel):
  table_name: str
  table_label: str | None = None
  data: list[TtColumnRow]
  count: int


class TtTableFilters(SQLModel):
  q: str | None = Field(default=None, max_length=50)

  # 搜尋字串只允許安全字元，避免注入 OPENQUERY 字串
  @field_validator("q")
  @classmethod
  def validateSafeText(cls, value: str | None) -> str | None:
    if value is None or not value.strip():
      return None
    normalized = value.strip()
    if not SAFE_TEXT_PATTERN.fullmatch(normalized):
      raise ValueError("only letters, digits, spaces and . _ - are allowed")
    return normalized


TtTableFiltersDep = Annotated[TtTableFilters, Query()]


# 跳脫 Oracle LIKE 萬用字元
def escapeOracleLike(value: str) -> str:
  return value.replace("\\", "\\\\").replace("_", "\\_")


# 把 Oracle SQL 包成 OPENQUERY(TOPPROD, ...)，字串內單引號加倍
def wrapOpenQuery(oracle_sql: str) -> str:
  return "SELECT * FROM OPENQUERY(TOPPROD, '" + oracle_sql.replace("'", "''") + "')"


# 欄位比對條件：欄位代號或欄位中文名稱含關鍵字
def columnMatchCondition(pattern: str) -> str:
  return (
    f"(LOWER(c.column_name) LIKE '{pattern}' ESCAPE '\\' "
    f"OR a.gaq03 LIKE '{pattern}' ESCAPE '\\')"
  )


# 依搜尋字串建立資料表清單查詢（表名、表中文名、含關鍵字的欄位都算命中）
def buildTablesQuery(filters: TtTableFilters) -> str:
  column_join = (
    "FROM all_tab_columns c LEFT JOIN MWF.gaq_file a "
    f"ON LOWER(c.column_name) = a.gaq01 AND a.gaq02 = '{LANGUAGE_TRADITIONAL}'"
  )
  matched_select = "0"
  where = f"t.owner = '{SCHEMA_OWNER}'"
  if filters.q:
    pattern = f"%{escapeOracleLike(filters.q.lower())}%"
    column_condition = columnMatchCondition(pattern)
    matched_select = (
      f"(SELECT COUNT(*) {column_join} "
      f"WHERE c.owner = '{SCHEMA_OWNER}' AND c.table_name = t.table_name AND {column_condition})"
    )
    where += (
      f" AND (LOWER(t.table_name) LIKE '{pattern}' ESCAPE '\\'"
      f" OR g.gat03 LIKE '{pattern}' ESCAPE '\\'"
      f" OR EXISTS (SELECT 1 {column_join} "
      f"WHERE c.owner = '{SCHEMA_OWNER}' AND c.table_name = t.table_name AND {column_condition}))"
    )
  inner = (
    "SELECT t.table_name AS table_name, g.gat03 AS table_label, g.gat06 AS module, "
    f"t.num_rows AS row_estimate, {matched_select} AS matched_columns, "
    "COUNT(*) OVER () AS total_count\n"
    "FROM all_tables t\n"
    f"LEFT JOIN MWF.gat_file g ON LOWER(t.table_name) = g.gat01 AND g.gat02 = '{LANGUAGE_TRADITIONAL}'\n"
    f"WHERE {where}\n"
    "ORDER BY t.table_name"
  )
  oracle_sql = f"SELECT * FROM (\n{inner}\n) WHERE ROWNUM <= {MAX_TABLES}"
  return wrapOpenQuery(oracle_sql)


# 依資料表名稱建立欄位清單查詢（表名已通過白名單驗證）
def buildColumnsQuery(table_name: str) -> str:
  oracle_sql = (
    "SELECT c.column_id, c.column_name, c.data_type, c.data_length, c.data_precision, "
    "c.data_scale, c.nullable, a.gaq03 AS column_label, a.gaq05 AS description, "
    "g.gat03 AS table_label\n"
    "FROM all_tab_columns c\n"
    f"LEFT JOIN MWF.gaq_file a ON LOWER(c.column_name) = a.gaq01 AND a.gaq02 = '{LANGUAGE_TRADITIONAL}'\n"
    f"LEFT JOIN MWF.gat_file g ON LOWER(c.table_name) = g.gat01 AND g.gat02 = '{LANGUAGE_TRADITIONAL}'\n"
    f"WHERE c.owner = '{SCHEMA_OWNER}' AND c.table_name = '{table_name.upper()}'\n"
    "ORDER BY c.column_id"
  )
  return wrapOpenQuery(oracle_sql)


# 轉成整數；Oracle NUMBER 會回傳 float 或 Decimal
def toInt(value: object) -> int | None:
  return int(value) if value is not None else None  # type: ignore[call-overload]


# 搜尋 TIPTOP 資料表（表名、表中文名稱、欄位代號、欄位中文名稱）
@router.get("/tables", response_model=TtTablesResponse)
def readTtTables(connection: TtConnectionDep, filters: TtTableFiltersDep) -> TtTablesResponse:
  rows = [
    {key.lower(): value for key, value in row.items()}
    for row in connection.execute(text(buildTablesQuery(filters))).mappings().all()
  ]
  total = int(rows[0]["total_count"]) if rows else 0
  data = [
    TtTableRow(
      table_name=row["table_name"],
      table_label=row["table_label"],
      module=row["module"],
      row_estimate=toInt(row["row_estimate"]),
      matched_columns=toInt(row["matched_columns"]) or 0,
    )
    for row in rows
  ]
  return TtTablesResponse(
    data=data, count=len(data), total=total,
  )


# 取得單一資料表的欄位清單與中文說明
@router.get("/tables/{table_name}/columns", response_model=TtColumnsResponse)
def readTtColumns(table_name: str, connection: TtConnectionDep) -> TtColumnsResponse:
  if not TABLE_NAME_PATTERN.fullmatch(table_name):
    raise HTTPException(status_code=422, detail="資料表名稱格式不正確")
  rows = [
    {key.lower(): value for key, value in row.items()}
    for row in connection.execute(text(buildColumnsQuery(table_name))).mappings().all()
  ]
  if not rows:
    raise HTTPException(status_code=404, detail="資料表不存在")
  data = [
    TtColumnRow(
      column_id=int(row["column_id"]),
      column_name=row["column_name"],
      column_label=row["column_label"],
      data_type=row["data_type"],
      data_length=toInt(row["data_length"]),
      data_precision=toInt(row["data_precision"]),
      data_scale=toInt(row["data_scale"]),
      nullable=row["nullable"] == "Y",
      description=row["description"],
    )
    for row in rows
  ]
  return TtColumnsResponse(
    table_name=table_name.upper(),
    table_label=rows[0]["table_label"],
    data=data,
    count=len(data),
  )
