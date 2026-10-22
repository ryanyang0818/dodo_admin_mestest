// TableDemos 共用假資料：全部用索引推導，確保每次 render 內容固定

export type OrderStatus = "pending" | "processing" | "done" | "cancelled"

export type OrderRow = {
  id: string
  orderNo: string
  customer: string
  region: "北區" | "中區" | "南區" | "東區"
  category: string
  status: OrderStatus
  qty: number
  amount: number
  orderDate: string
}

const CUSTOMERS = [
  "大同精機",
  "永豐貿易",
  "昇陽科技",
  "全域物流",
  "光隆實業",
  "禾豐食品",
  "宏遠電子",
  "美德紡織",
]

const REGIONS = ["北區", "中區", "南區", "東區"] as const

const CATEGORIES = ["零件", "耗材", "設備", "服務"]

const STATUSES: OrderStatus[] = ["pending", "processing", "done", "cancelled"]

// 訂單狀態的顯示文字與 badge 樣式
export const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "待處理",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  processing: {
    label: "處理中",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  done: {
    label: "已完成",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelled: {
    label: "已取消",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
  },
}

// 金額千分位格式
export function money(n: number): string {
  return n.toLocaleString("zh-TW")
}

// 產生固定內容的訂單假資料（以索引推導，無隨機值）
export function makeOrders(count = 60): OrderRow[] {
  return Array.from({ length: count }, (_, i) => {
    const qty = ((i * 7) % 24) + 1
    const unit = 350 + ((i * 131) % 900)
    const month = ((i * 5) % 6) + 1
    const day = ((i * 3) % 28) + 1
    const mm = String(month).padStart(2, "0")
    return {
      id: `ord-${i + 1}`,
      orderNo: `SO-2026${mm}${String(i + 1).padStart(3, "0")}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      region: REGIONS[i % REGIONS.length],
      category: CATEGORIES[(i * 3) % CATEGORIES.length],
      status: STATUSES[(i * 7) % STATUSES.length],
      qty,
      amount: qty * unit,
      orderDate: `2026-${mm}-${String(day).padStart(2, "0")}`,
    }
  })
}

export const ORDERS = makeOrders()

// 階層資料：訂單 → 明細品項，給 expanding（subRows）示範用
export type OrderTreeRow = {
  id: string
  name: string
  kind: "訂單" | "品項"
  qty: number
  amount: number
  subRows?: OrderTreeRow[]
}

const ITEM_NAMES = ["軸承組", "潤滑油", "控制板", "感測器", "皮帶", "濾芯"]

// 由前幾筆訂單推導出帶明細的樹狀資料
export function makeOrderTree(orderCount = 6): OrderTreeRow[] {
  return ORDERS.slice(0, orderCount).map((order, i) => {
    const itemCount = (i % 3) + 2
    const subRows: OrderTreeRow[] = Array.from(
      { length: itemCount },
      (_, j) => {
        const qty = (((i + j) * 5) % 12) + 1
        const unit = 200 + ((i * 37 + j * 53) % 700)
        return {
          id: `${order.id}-item-${j + 1}`,
          name: ITEM_NAMES[(i + j) % ITEM_NAMES.length],
          kind: "品項",
          qty,
          amount: qty * unit,
        }
      },
    )
    return {
      id: order.id,
      name: order.orderNo,
      kind: "訂單",
      qty: subRows.reduce((s, r) => s + r.qty, 0),
      amount: subRows.reduce((s, r) => s + r.amount, 0),
      subRows,
    }
  })
}

export const ORDER_TREE = makeOrderTree()
