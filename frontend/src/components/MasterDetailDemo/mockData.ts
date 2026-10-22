// MasterDetailDemo 假資料層：一筆主檔（Master）+ 四組明細（Detail）
// 主檔欄位刻意涵蓋多種型別（文字 / 日期 / 金額 / 長文字），明細重用 ItemsCRUD 的 MOCK_ITEMS

import {
  type ItemPriority,
  type ItemRow,
  type ItemStatus,
  MOCK_ITEMS,
} from "@/components/ItemsCRUD/mockData"

// 主檔資料型別：分四個語意群組（訂單 / 供應商 / 金額 / 物流）
export type MasterRecord = {
  orderNo: string
  docType: string
  createdDate: string
  expectedDate: string
  department: string
  priority: ItemPriority
  status: ItemStatus
  supplierCode: string
  supplierName: string
  taxId: string
  contact: string
  contactPhone: string
  currency: string
  amountUntaxed: number
  taxRate: number
  taxAmount: number
  amountTotal: number
  terms: string
  discount: number
  deliveryAddress: string
  remark: string
}

// 這一筆要被「Master 區」聚焦呈現的主檔（固定假資料）
export const MASTER_RECORD: MasterRecord = {
  orderNo: "PO-2026-0518-001",
  docType: "標準採購",
  createdDate: "2026/05/18",
  expectedDate: "2026/05/25",
  department: "資訊部",
  priority: "high",
  status: "approved",
  supplierCode: "V-00231",
  supplierName: "鴻海精密工業股份有限公司",
  taxId: "04541302",
  contact: "陳大為",
  contactPhone: "02-2268-0080",
  currency: "TWD 新台幣",
  amountUntaxed: 1190476,
  taxRate: 5,
  taxAmount: 59524,
  amountTotal: 1250000,
  terms: "月結 30 天",
  discount: 3,
  deliveryAddress: "台北市內湖區瑞光大道一段 89 號",
  remark:
    "本批為年度框架合約首次拉貨，請供應商隨貨附上進料檢驗報告（IQC）與出廠保證書。",
}

// 明細頁籤一：品項明細 — 直接取 MOCK_ITEMS 前 8 筆當這張採購單的品項
export const LINE_ITEMS: ItemRow[] = MOCK_ITEMS.slice(0, 8)

// 附件型別（明細頁籤二）
export type Attachment = {
  id: string
  name: string
  kind: "pdf" | "excel" | "image" | "word"
  size: string
  uploader: string
  uploadedAt: string
}

// 附件假資料：刻意混合不同檔案類型，展示 icon / 大小 / 上傳資訊的多樣性
export const ATTACHMENTS: Attachment[] = [
  {
    id: "att-1",
    name: "採購合約_鴻海_2026.pdf",
    kind: "pdf",
    size: "1.8 MB",
    uploader: "李小華",
    uploadedAt: "2026/05/18 14:32",
  },
  {
    id: "att-2",
    name: "品項報價單_v3.xlsx",
    kind: "excel",
    size: "642 KB",
    uploader: "王志明",
    uploadedAt: "2026/05/17 09:10",
  },
  {
    id: "att-3",
    name: "供應商工廠實景.jpg",
    kind: "image",
    size: "3.2 MB",
    uploader: "陳怡君",
    uploadedAt: "2026/05/16 18:45",
  },
]

// 歷史紀錄型別（明細頁籤三）
export type HistoryEvent = {
  id: string
  time: string
  actor: string
  action: string
  detail: string
}

// 歷史紀錄假資料：一條由建立到財務核准的事件流，含一次退回補件
export const HISTORY: HistoryEvent[] = [
  {
    id: "h-1",
    time: "2026/05/18 14:32",
    actor: "李小華",
    action: "建立採購單",
    detail: "由詢價單 RFQ-2026-0501-007 轉入",
  },
  {
    id: "h-2",
    time: "2026/05/18 15:01",
    actor: "李小華",
    action: "送出簽核",
    detail: "金額逾 100 萬，進入二級簽核流程",
  },
  {
    id: "h-3",
    time: "2026/05/18 16:20",
    actor: "張凱翔",
    action: "部門主管核准",
    detail: "",
  },
  {
    id: "h-4",
    time: "2026/05/19 09:40",
    actor: "林佩蓉",
    action: "退回補件",
    detail: "缺少供應商最新統一編號證明",
  },
  {
    id: "h-5",
    time: "2026/05/19 11:05",
    actor: "李小華",
    action: "重新送審",
    detail: "已補上統一編號證明附件",
  },
  {
    id: "h-6",
    time: "2026/05/19 14:18",
    actor: "林佩蓉",
    action: "財務核准",
    detail: "付款條件確認為月結 30 天",
  },
]

// 簽核狀態（明細頁籤四）
export type ApprovalStatus = "approved" | "current" | "pending" | "rejected"

// 簽核關卡型別
export type ApprovalStep = {
  id: string
  stage: string
  approver: string
  role: string
  status: ApprovalStatus
  time: string
}

// 簽核流程假資料：前三關已過、第四關進行中、最後一關待處理
export const APPROVAL_FLOW: ApprovalStep[] = [
  {
    id: "ap-1",
    stage: "申請",
    approver: "李小華",
    role: "採購專員",
    status: "approved",
    time: "2026/05/18 15:01",
  },
  {
    id: "ap-2",
    stage: "部門主管",
    approver: "張凱翔",
    role: "資訊部經理",
    status: "approved",
    time: "2026/05/18 16:20",
  },
  {
    id: "ap-3",
    stage: "財務審核",
    approver: "林佩蓉",
    role: "財務副理",
    status: "approved",
    time: "2026/05/19 14:18",
  },
  {
    id: "ap-4",
    stage: "總經理核決",
    approver: "黃國華",
    role: "總經理",
    status: "current",
    time: "",
  },
  {
    id: "ap-5",
    stage: "採購執行",
    approver: "—",
    role: "採購專員",
    status: "pending",
    time: "",
  },
]
