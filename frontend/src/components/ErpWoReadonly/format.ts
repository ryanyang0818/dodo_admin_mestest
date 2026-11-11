import { ApiError } from "@/client"
import { dodoReportConfig, type ErpWoFieldKey } from "./dodo-report.config"

const woTypes: Record<string, string> = {
  "1": "一般工單",
  "2": "其他",
  "5": "再加工工單",
  "7": "委外工單",
  "8": "重工委外工單",
  "11": "拆件式工單",
  "12": "其他",
  "13": "預測工單",
  "15": "試產工單",
}

// 列表與明細共用 ERP 日期、數量及空值格式。
export function woText(key: ErpWoFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value == null || value === "") return field.emptyText
  if (field.format === "number")
    return Number(value).toLocaleString("en-US", {
      useGrouping: false,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  if (field.format === "date")
    return String(value).slice(0, 10).replaceAll("-", "/")
  if (field.format === "wo-type")
    return `${value}:${woTypes[String(value)] ?? "未定義"}`
  if (field.format === "confirmed")
    return `${value}:${({ Y: "確認", N: "未確認", X: "作廢" } as Record<string, string>)[String(value)] ?? "未定義"}`
  return String(value)
}

// 公開頁只呈現一般錯誤，不顯示原始連線或驗證內容。
export function woError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "找不到指定工單。"
    if (error.status === 422)
      return "查詢條件格式不正確，請確認日期範圍與輸入內容。"
    if (error.status === 503) return "ERP 暫時無法連線，請稍後再試。"
  }
  return "查詢失敗或連線逾時，請稍後重試。"
}
