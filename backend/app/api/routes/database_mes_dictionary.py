"""資料庫字典（MES 正式區）：查詢資料表與欄位的中文說明，只讀系統目錄，不讀資料內容。"""
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import field_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.mes_db import MesConnectionDep


MENU_KEY = "database.mes-dictionary"
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_$#]{1,128}$")
# 一次回傳全部資料表（MES 約 800 張）；仍設上限避免異常資料量
MAX_TABLES = 5_000

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-database-mes-dictionary"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)

# 只讀系統目錄；說明存在 MS_Description 擴充屬性。搜尋值全部用 bind 參數。
MES_TABLES_QUERY = text(f"""
SELECT TOP ({MAX_TABLES})
  s.name AS schema_name,
  t.name AS table_name,
  CAST(tep.value AS NVARCHAR(500)) AS table_label,
  (SELECT SUM(p.rows) FROM sys.partitions p
    WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)) AS row_count,
  CASE WHEN :pattern IS NULL THEN 0 ELSE (
    SELECT COUNT(*) FROM sys.columns c
    LEFT JOIN sys.extended_properties cep
      ON cep.class = 1 AND cep.major_id = c.object_id AND cep.minor_id = c.column_id
     AND cep.name = N'MS_Description'
    WHERE c.object_id = t.object_id
      AND (c.name LIKE :pattern ESCAPE '\\' OR CAST(cep.value AS NVARCHAR(500)) LIKE :pattern ESCAPE '\\')
  ) END AS matched_columns,
  COUNT(*) OVER () AS total_count
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
LEFT JOIN sys.extended_properties tep
  ON tep.class = 1 AND tep.major_id = t.object_id AND tep.minor_id = 0
 AND tep.name = N'MS_Description'
WHERE t.is_ms_shipped = 0
  AND (:pattern IS NULL
    OR t.name LIKE :pattern ESCAPE '\\'
    OR CAST(tep.value AS NVARCHAR(500)) LIKE :pattern ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM sys.columns c
      LEFT JOIN sys.extended_properties cep
        ON cep.class = 1 AND cep.major_id = c.object_id AND cep.minor_id = c.column_id
       AND cep.name = N'MS_Description'
      WHERE c.object_id = t.object_id
        AND (c.name LIKE :pattern ESCAPE '\\' OR CAST(cep.value AS NVARCHAR(500)) LIKE :pattern ESCAPE '\\')
    ))
ORDER BY t.name
""")

MES_COLUMNS_QUERY = text("""
SELECT
  c.column_id,
  c.name AS column_name,
  CAST(cep.value AS NVARCHAR(MAX)) AS description,
  ty.name AS data_type,
  c.max_length,
  c.precision AS data_precision,
  c.scale AS data_scale,
  c.is_nullable,
  c.is_identity,
  CASE WHEN EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    WHERE i.object_id = c.object_id AND i.is_primary_key = 1 AND ic.column_id = c.column_id
  ) THEN 1 ELSE 0 END AS is_primary_key,
  CAST(tep.value AS NVARCHAR(500)) AS table_label
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties cep
  ON cep.class = 1 AND cep.major_id = c.object_id AND cep.minor_id = c.column_id
 AND cep.name = N'MS_Description'
LEFT JOIN sys.extended_properties tep
  ON tep.class = 1 AND tep.major_id = t.object_id AND tep.minor_id = 0
 AND tep.name = N'MS_Description'
WHERE s.name = :schema_name AND t.name = :table_name
ORDER BY c.column_id
""")


class MesTableRow(SQLModel):
  schema_name: str
  table_name: str
  table_label: str | None = None
  row_count: int | None = None
  matched_columns: int = 0


class MesTablesResponse(SQLModel):
  data: list[MesTableRow]
  count: int
  total: int


class MesColumnRow(SQLModel):
  column_id: int
  column_name: str
  column_label: str | None = None
  type_display: str
  nullable: bool
  is_primary_key: bool
  is_identity: bool


class MesColumnsResponse(SQLModel):
  schema_name: str
  table_name: str
  table_label: str | None = None
  data: list[MesColumnRow]
  count: int


class MesTableFilters(SQLModel):
  q: str | None = Field(default=None, max_length=50)

  # 清理搜尋字串；搜尋值用 bind 參數，不需限制字元
  @field_validator("q")
  @classmethod
  def normalizeQuery(cls, value: str | None) -> str | None:
    if value is None or not value.strip():
      return None
    return value.strip()


MesTableFiltersDep = Annotated[MesTableFilters, Query()]


# 跳脫 SQL Server LIKE 萬用字元，讓輸入只做字面比對
def escapeLike(value: str) -> str:
  for char in ("\\", "%", "_", "["):
    value = value.replace(char, f"\\{char}")
  return value


# 把型別與長度組成易讀文字，例如 varchar(50)、decimal(18,2)、nvarchar(max)
def formatType(data_type: str, max_length: int, precision: int, scale: int) -> str:
  lowered = data_type.lower()
  if lowered in {"varchar", "char", "varbinary", "binary"}:
    return f"{lowered}({'max' if max_length == -1 else max_length})"
  if lowered in {"nvarchar", "nchar"}:
    return f"{lowered}({'max' if max_length == -1 else max_length // 2})"
  if lowered in {"decimal", "numeric"}:
    return f"{lowered}({precision},{scale})"
  return lowered


# 搜尋 MES 資料表（表名、表說明、欄位名、欄位說明）
@router.get("/tables", response_model=MesTablesResponse)
def readMesTables(connection: MesConnectionDep, filters: MesTableFiltersDep) -> MesTablesResponse:
  pattern = f"%{escapeLike(filters.q)}%" if filters.q else None
  rows = connection.execute(MES_TABLES_QUERY, {"pattern": pattern}).mappings().all()
  total = int(rows[0]["total_count"]) if rows else 0
  data = [
    MesTableRow(
      schema_name=row["schema_name"],
      table_name=row["table_name"],
      table_label=row["table_label"],
      row_count=int(row["row_count"]) if row["row_count"] is not None else None,
      matched_columns=int(row["matched_columns"]),
    )
    for row in rows
  ]
  return MesTablesResponse(data=data, count=len(data), total=total)


# 取得單一資料表的欄位清單與說明
@router.get("/tables/{table_name}/columns", response_model=MesColumnsResponse)
def readMesColumns(
  table_name: str,
  connection: MesConnectionDep,
  schema_name: str = "dbo",
) -> MesColumnsResponse:
  if not IDENTIFIER_PATTERN.fullmatch(table_name) or not IDENTIFIER_PATTERN.fullmatch(schema_name):
    raise HTTPException(status_code=422, detail="資料表名稱格式不正確")
  rows = connection.execute(
    MES_COLUMNS_QUERY,
    {"schema_name": schema_name, "table_name": table_name},
  ).mappings().all()
  if not rows:
    raise HTTPException(status_code=404, detail="資料表不存在")
  data = [
    MesColumnRow(
      column_id=int(row["column_id"]),
      column_name=row["column_name"],
      column_label=row["description"],
      type_display=formatType(
        row["data_type"], int(row["max_length"]), int(row["data_precision"]), int(row["data_scale"]),
      ),
      nullable=bool(row["is_nullable"]),
      is_primary_key=bool(row["is_primary_key"]),
      is_identity=bool(row["is_identity"]),
    )
    for row in rows
  ]
  return MesColumnsResponse(
    schema_name=schema_name,
    table_name=table_name,
    table_label=rows[0]["table_label"],
    data=data,
    count=len(data),
  )
