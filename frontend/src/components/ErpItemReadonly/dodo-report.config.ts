export const dodoReportConfig = {
  reportKey: "erp.item-readonly",
  reportTitle: "料號基本資料",
  reportDescription:
    "查詢 ERP 料號基本資料。初次顯示料號升冪前 500 筆；輸入條件可查詢其他料號。",
  fields: {
    part_no: { label: "料件編號", width: 145 },
    name: { label: "品名", width: 235 },
    specification: { label: "規格", width: 235 },
    group_code: { label: "分群碼", width: 125 },
    source: { label: "來源碼", width: 110 },
    sales_characteristic: { label: "產品銷售特性", width: 132 },
    material_category: { label: "材料類別", width: 100 },
    stock_unit: { label: "庫存單位", width: 95 },
    replenishment_strategy: { label: "補貨策略", width: 140 },
    status: { label: "狀況", width: 140 },
    active_code: { label: "資料有效碼", width: 150 },
    origin: { label: "資料來源", width: 100 },
  },
} as const
export type ItemField = keyof typeof dodoReportConfig.fields
export const itemFields = Object.keys(dodoReportConfig.fields) as ItemField[]
export const sourceLabels: Record<string, string> = {
  C: "規格組件",
  T: "最後規格料件",
  D: "特性料件",
  A: "族群料件",
  M: "自製料件",
  P: "採購料件",
  X: "虛擬料件",
  K: "配件虛擬料件",
  U: "自製大宗料件",
  V: "採購大宗料件",
  R: "在製途料件",
  Z: "雜項料件",
  S: "廠外加工料件",
}
export const salesCharacteristicLabels: Record<string, string> = {
  "0": "非產品",
  "1": "一般產品",
  "2": "PHASE OUT",
}
export const replenishmentLabels: Record<string, string> = {
  "0": "再訂購點",
  "1": "MPS",
  "2": "MRP",
  "3": "FAS",
  "4": "訂單式生產",
  "5": "期間採購",
}
export const statusLabels: Record<string, string> = { "1": "確認" }
export const activeCodeLabels: Record<string, string> = { Y: "確認" }
export const vendorControlLabels: Record<string, string> = {
  "0": "不管制",
  "1": "請購單需管制",
  "2": "採購單需管制",
  "3": "二者皆需管制",
}
