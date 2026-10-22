"""MES 正式區檢驗量測唯讀查詢。"""
import csv
import io
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from pydantic import field_validator
from sqlalchemy import Unicode, bindparam, text
from sqlalchemy.dialects import mssql
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.mes_db import MesConnectionDep

MENU_KEY = "mes.inspection-query"
EXPORT_LIMIT = 50000
router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-mes-inspection-query"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class InspectionFilters(SQLModel):
  lot: str = Field(min_length=1, max_length=255)
  insp_sid: str = Field(min_length=1, max_length=255)
  qc_no: str | None = Field(default=None, min_length=1, max_length=255)
  skip: int = Field(default=0, ge=0, le=1000000)
  limit: int = Field(default=50, ge=1, le=100)

  # 清理條件並拒絕只有空白的輸入。
  @field_validator("lot", "insp_sid", "qc_no", mode="before")
  @classmethod
  def trimCondition(cls, value: str | None) -> str | None:
    if value is None:
      return None
    value = value.strip()
    if not value:
      raise ValueError("查詢條件不可只有空白")
    return value


FiltersDep = Annotated[InspectionFilters, Query()]
Dataset = Literal["sheets", "measurements", "parameters"]


class InspectionForm(SQLModel):
  insp_sid: str
  insp_no: str
  insp_name: str | None = None


class InspectionForms(SQLModel):
  data: list[InspectionForm]


class InspectionLot(SQLModel):
  lot: str
  partno: str


class InspectionPage(SQLModel):
  data: list[dict[str, str | int | float | None]]
  count: int
  skip: int
  limit: int


class InspectionSql(SQLModel):
  sheets: str
  measurements: str | None = None
  parameters: str | None = None


SCOPE = """q.INSP_SID = :insp_sid
  AND EXISTS (
    SELECT 1 FROM MWF_GTIMES5.dbo.WP_IPQC_LOT link
    JOIN MWF_GTIMES5.dbo.WP_LOT lot ON lot.LOT_SID = link.LOT_SID
    WHERE link.QC_NO = q.QC_NO AND lot.LOT = :lot
  )"""

SHEETS_FROM = "FROM MWF_GTIMES5.dbo.WP_IPQC q WHERE " + SCOPE
SHEETS_SELECT = """q.QC_NO AS qc_no, q.INSP_STATUS AS insp_status,
  q.QC_RESULT AS qc_result, q.DESCRIPTION AS description,
  q.CREATE_USER AS create_user, q.CREATE_DATE AS create_date,
  q.UPDATE_DATE AS update_date,
  (SELECT COUNT_BIG(DISTINCT l.LOT_SID)
    FROM MWF_GTIMES5.dbo.WP_IPQC_LOT l WHERE l.QC_NO = q.QC_NO) AS lot_count,
  (SELECT STRING_AGG(CONVERT(nvarchar(max), lots.LOT), N'、')
    FROM (SELECT DISTINCT lot.LOT FROM MWF_GTIMES5.dbo.WP_IPQC_LOT link
      JOIN MWF_GTIMES5.dbo.WP_LOT lot ON lot.LOT_SID = link.LOT_SID
      WHERE link.QC_NO = q.QC_NO) lots) AS related_lots"""

RAW_FROM = """FROM MWF_GTIMES5.dbo.WP_IPQC_CHECKITEM item
JOIN MWF_GTIMES5.dbo.WP_IPQC_CHECKITEM_RAW raw
  ON raw.ACTION_LINK_SID = item.WP_IPQC_CHECKITEM_SID
JOIN MWF_GTIMES5.dbo.WP_IPQC q ON q.QC_NO = item.ACTION_LINK_SID
WHERE q.QC_NO = :qc_no AND """ + SCOPE
RAW_SELECT = """q.QC_NO AS qc_no, item.WP_IPQC_CHECKITEM_SID AS checkitem_sid,
  item.ITEM_NO AS item_no, item.ITEM AS item_name,
  raw.QC_SEQ AS qc_seq, raw.QC_DATA AS qc_data,
  raw.OPERATION AS operation, raw.CREATE_USER AS create_user,
  raw.CREATE_DATE AS create_date"""

PARAMETERS_FROM = """FROM MWF_GTIMES5.dbo.WP_IPQC_CHECKITEM item
JOIN MWF_GTIMES5.dbo.QC_INSP_EDC edc ON edc.INSP_EDC_SID = item.INSP_EDC_SID
JOIN MWF_GTIMES5.dbo.FC_EDC_VER_PARAMETER para
  ON para.EDC_PARA_SID = edc.EDC_PARA_SID AND para.EDC_VER_SID = edc.EDC_VER_SID
JOIN MWF_GTIMES5.dbo.WP_IPQC q ON q.QC_NO = item.ACTION_LINK_SID
WHERE q.QC_NO = :qc_no AND """ + SCOPE
PARAMETERS_SELECT = """q.QC_NO AS qc_no, item.WP_IPQC_CHECKITEM_SID AS checkitem_sid,
  edc.INSP_EDC_SID AS insp_edc_sid, edc.EDC_VER_SID AS edc_ver_sid,
  edc.PARA_NO AS para_no, edc.PARAMETER AS parameter,
  edc.DATATYPE AS datatype, edc.TEST_POINT AS test_point,
  edc.TL AS tl, edc.LSL AS lsl, edc.USL AS usl,
  edc.LCL AS lcl, edc.UCL AS ucl, para.ITEM_SEQ AS item_seq"""

DATASETS = {
  "sheets": (SHEETS_SELECT, SHEETS_FROM, "q.UPDATE_DATE DESC, q.QC_NO DESC"),
  "measurements": (RAW_SELECT, RAW_FROM,
    "item.WP_IPQC_CHECKITEM_SID, raw.QC_SEQ, raw.CREATE_DATE, raw.QC_DATA, raw.OPERATION, raw.CREATE_USER, raw.QC_ITEM_SID"),
  "parameters": (PARAMETERS_SELECT, PARAMETERS_FROM,
    "item.WP_IPQC_CHECKITEM_SID, para.ITEM_SEQ, para.EDC_VER_PARA_SID, edc.INSP_EDC_SID"),
}


# 使用固定欄位白名單組出查詢；前端無法傳入 SQL 或欄位名稱。
def buildInspectionQuery(dataset: Dataset, filters: InspectionFilters) -> tuple[str, str, dict]:
  if dataset != "sheets" and not filters.qc_no:
    raise HTTPException(status_code=422, detail="請先選取檢驗單")
  columns, source, order = DATASETS[dataset]
  sql = f"SELECT {columns}\n{source}\nORDER BY {order}\nOFFSET :skip ROWS FETCH NEXT :limit ROWS ONLY"
  return sql, f"SELECT COUNT_BIG(*) {source}", filters.model_dump()


# 依頁讀取明確白名單欄位，日期保留 MES 原始本地時間，不虛構 UTC。
def readInspectionPage(connection, dataset: Dataset, filters: InspectionFilters) -> InspectionPage:
  sql, count_sql, params = buildInspectionQuery(dataset, filters)
  count = connection.execute(text(count_sql), params).scalar_one()
  rows = connection.execute(text(sql), params).mappings().all()
  return InspectionPage(data=jsonable_encoder([dict(row) for row in rows]),
    count=count, skip=filters.skip, limit=filters.limit)


# 精確查詢批號料號；空料號或同批號對應不同料號時不猜測。
@router.get("/lot", response_model=InspectionLot)
def readInspectionLot(
  connection: MesConnectionDep,
  lot: Annotated[str, Query(min_length=1, max_length=255)],
) -> InspectionLot:
  lot = lot.strip()
  if not lot:
    raise HTTPException(status_code=422, detail="請輸入批號")
  rows = connection.execute(text("""SELECT DISTINCT TOP (2) PARTNO AS partno
    FROM MWF_GTIMES5.dbo.WP_LOT WHERE LOT = :lot"""), {"lot": lot}).mappings().all()
  if not rows:
    raise HTTPException(status_code=404, detail="查無此批號")
  if len(rows) != 1:
    raise HTTPException(status_code=409, detail="此批號對應不同料號，無法自動篩選表單")
  partno = (rows[0]["partno"] or "").strip()
  if not partno:
    raise HTTPException(status_code=422, detail="此批號未設定料號")
  return InspectionLot(lot=lot, partno=partno)


# 列出全部表單，包含停用表單，供前端依批號料號篩選名稱。
@router.get("/forms", response_model=InspectionForms)
def readInspectionForms(connection: MesConnectionDep) -> InspectionForms:
  rows = connection.execute(text("""SELECT INSP_SID AS insp_sid,
    INSP_NO AS insp_no, INSP_NAME AS insp_name
    FROM MWF_GTIMES5.dbo.QC_INSP ORDER BY INSP_NO, INSP_NAME, INSP_SID""")).mappings()
  return InspectionForms(data=[InspectionForm.model_validate(dict(row)) for row in rows])


# 查詢批號與表單對應的檢驗單，每單只出現一次。
@router.get("/", response_model=InspectionPage)
def readInspectionSheets(connection: MesConnectionDep, filters: FiltersDep) -> InspectionPage:
  return readInspectionPage(connection, "sheets", filters)


# 查詢所選檢驗單原始量測值，保留文字與布林原值。
@router.get("/measurements", response_model=InspectionPage)
def readInspectionMeasurements(connection: MesConnectionDep, filters: FiltersDep) -> InspectionPage:
  return readInspectionPage(connection, "measurements", filters)


# 查詢現行參數，不使用它重新判定歷史量測值。
@router.get("/parameters", response_model=InspectionPage)
def readInspectionParameters(connection: MesConnectionDep, filters: FiltersDep) -> InspectionPage:
  return readInspectionPage(connection, "parameters", filters)


# 以 SQLAlchemy 編譯同一查詢的字面值版本，正確跳脫字串且不執行。
def literalInspectionSql(dataset: Dataset, filters: InspectionFilters) -> str:
  sql, count_sql, params = buildInspectionQuery(dataset, filters)
  statements = []
  for query in (count_sql, sql):
    statement = text(query)
    required = statement.compile().params
    values = [bindparam(key, value, type_=Unicode() if isinstance(value, str) else None)
      for key, value in params.items() if key in required]
    statements.append(str(statement.bindparams(*values).compile(
      dialect=mssql.dialect(), compile_kwargs={"literal_binds": True})))
  return ";\n\n".join(statements) + ";"


# 提供三段與畫面相同條件、相同分頁的 SQL；選單之前只提供第一段。
@router.get("/sql", response_model=InspectionSql)
def readInspectionSql(filters: FiltersDep) -> InspectionSql:
  return InspectionSql(
    sheets=literalInspectionSql("sheets", filters),
    measurements=literalInspectionSql("measurements", filters) if filters.qc_no else None,
    parameters=literalInspectionSql("parameters", filters) if filters.qc_no else None,
  )


# 防止試算表將文字量測值當成公式，數字字串維持原值。
def csvCell(value: object) -> str:
  output = "" if value is None else str(value)
  if output.lstrip().startswith(("=", "+", "-", "@")):
    try:
      float(output)
    except ValueError:
      return "'" + output
  return output


# 匯出所選檢驗單全部量測值，超過五萬筆明確拒絕，不截斷。
@router.get("/export")
def exportInspectionMeasurements(connection: MesConnectionDep, filters: FiltersDep) -> Response:
  _, count_sql, params = buildInspectionQuery("measurements", filters)
  if connection.execute(text(count_sql), params).scalar_one() > EXPORT_LIMIT:
    raise HTTPException(status_code=413, detail="量測資料超過 50,000 筆，無法一次匯出")
  sql = f"SELECT TOP ({EXPORT_LIMIT + 1}) {RAW_SELECT}\n{RAW_FROM}\nORDER BY {DATASETS['measurements'][2]}"
  rows = connection.execute(text(sql), params).mappings().all()
  if len(rows) > EXPORT_LIMIT:
    raise HTTPException(status_code=413, detail="量測資料超過 50,000 筆，無法一次匯出")
  output = io.StringIO(newline="")
  writer = csv.writer(output)
  writer.writerow(["檢驗單號", "檢驗項目識別碼", "項目代號", "項目名稱", "檢驗項目順序",
    "實際輸入值", "工作站", "建立使用者", "建立時間（MES 原值）"])
  for row in rows:
    writer.writerow([csvCell(value) for value in row.values()])
  return Response(content=("\ufeff" + output.getvalue()).encode("utf-8"), media_type="text/csv",
    headers={"Content-Disposition": 'attachment; filename="mes-inspection-measurements.csv"'})
