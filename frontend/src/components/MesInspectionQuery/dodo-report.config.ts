export const dodoReportConfig = {
  reportKey: "mes.inspection-query",
  reportTitle: "檢驗量測查詢",
  reportDescription: "依批號與檢驗表單查詢檢驗單、原始量測值及現行參數，提供 SQL 與 CSV。",
  enableExport: true,
  enableFilters: true,
  enablePagination: true,
  pageSize: 50,
  // ponytail: 第一版採固定順序與欄位；需要跨頁排序時再擴充後端白名單。
  enableGlobalSearch: false,
  enableSorting: false,
  enableColumnVisibility: false,
  enableColumnOrder: false,
  enableColumnPinning: false,
  enableRowExpansion: false,
  enableGrouping: false,
  sheets: [
    ["qc_no", "檢驗單號"], ["insp_status", "檢驗狀態（原值）"],
    ["qc_result", "判定結果（原值）"], ["create_user", "建立人員"],
    ["create_date", "建立時間"], ["update_date", "更新時間"],
    ["lot_count", "關聯批號數"], ["description", "說明"],
  ],
  measurements: [
    ["item_no", "項目代號"], ["item_name", "項目名稱"],
    ["qc_seq", "檢驗項目順序"], ["qc_data", "實際量測／輸入值"],
    ["operation", "工作站"], ["create_user", "建立人員"], ["create_date", "建立時間"],
  ],
  parameters: [
    ["para_no", "參數代號"], ["parameter", "參數名稱"], ["item_seq", "顯示順序"],
    ["datatype", "資料類別（原值）"], ["test_point", "收集點數"],
    ["tl", "目標值"], ["lsl", "規格下限"], ["usl", "規格上限"],
    ["lcl", "控制下限"], ["ucl", "控制上限"],
  ],
} as const
