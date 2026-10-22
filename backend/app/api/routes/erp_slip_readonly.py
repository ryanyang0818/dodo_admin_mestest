"""ERP 單別查詢（TIPTOP smy_file）唯讀 API：單別與單據名稱，一次回傳全部。"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.tt_db import TtConnectionDep


MENU_KEY = "erp.slip-readonly"
# 單別檔筆數不多（約數百筆），仍設上限避免異常資料量
MAX_ROWS = 5_000

router = APIRouter(
  prefix=f"/page/{menu_key_to_path(MENU_KEY)}/report",
  tags=["page-erp-slip-readonly"],
  dependencies=[Depends(require_menu(MENU_KEY))],
)

# 固定 SQL，沒有任何使用者輸入
SLIP_QUERY = text(
  "SELECT * FROM OPENQUERY(TOPPROD, '"
  "SELECT * FROM (SELECT smyslip, smydesc FROM MWF.smy_file ORDER BY smyslip) "
  f"WHERE ROWNUM <= {MAX_ROWS}"
  "')"
)


class ErpSlipRow(SQLModel):
  slip: str
  name: str | None = None


class ErpSlipResponse(SQLModel):
  data: list[ErpSlipRow]
  count: int


# 查詢全部單別與單據名稱（唯讀）
@router.get("/", response_model=ErpSlipResponse)
def readErpSlips(connection: TtConnectionDep) -> ErpSlipResponse:
  rows = connection.execute(SLIP_QUERY).mappings().all()
  data = [
    ErpSlipRow(slip=row["SMYSLIP"], name=row["SMYDESC"])
    for row in rows
  ]
  return ErpSlipResponse(data=data, count=len(data))
