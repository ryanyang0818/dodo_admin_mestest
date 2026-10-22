"""離線自我檢查；在 backend 目錄執行 python -m scripts.check_mes_inspection_query。

只檢查字串與條件驗證，不連線資料庫。依 SOP.go 本次保留但不執行。
"""
from pydantic import ValidationError
from unittest.mock import MagicMock

from app.api.routes.mes_inspection_query import (
  InspectionFilters, buildInspectionQuery, csvCell, literalInspectionSql, readInspectionLot,
)


# 檢查不可信條件留在參數、複製 SQL 正確跳脫，以及 CSV 不執行文字公式。
def checkInspectionQuery() -> None:
  filters = InspectionFilters(lot=" 26I133 ", insp_sid="form' OR 1=1--", qc_no="inspection-1")
  query, _, params = buildInspectionQuery("measurements", filters)
  assert params["lot"] == "26I133"
  assert filters.insp_sid not in query and filters.insp_sid == params["insp_sid"]
  copied = literalInspectionSql("measurements", filters)
  assert "N'form'' OR 1=1--'" in copied
  assert ":insp_sid" not in copied and ":qc_no" not in copied
  for value in ("T", "16.5", "-2.5", "巡線線別", ""):
    assert csvCell(value) == value
  assert csvCell("=1+1") == "'=1+1"
  assert csvCell("\t@SUM(1)").startswith("'")
  connection = MagicMock()
  connection.execute.return_value.mappings.return_value.all.return_value = [{"partno": " UG-DN71CF501M "}]
  lot_info = readInspectionLot(connection, " 26I133 ")
  assert lot_info.lot == "26I133" and lot_info.partno == "UG-DN71CF501M"
  assert connection.execute.call_args.args[1] == {"lot": "26I133"}
  try:
    InspectionFilters(lot="   ", insp_sid="form")
  except ValidationError:
    pass
  else:
    raise AssertionError("空白批號不可送出查詢")


if __name__ == "__main__":
  checkInspectionQuery()
  print("檢驗查詢離線檢查通過（未連線資料庫）")
