import {
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  GripHorizontal,
  type LucideIcon,
  Truck,
  XCircle,
} from "lucide-react"
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react"

import {
  type ItemPriority,
  type ItemStatus,
  money,
  STATUS_CONFIG,
} from "@/components/ItemsCRUD/mockData"
import { PageHeader } from "@/components/Common/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  APPROVAL_FLOW,
  type ApprovalStatus,
  ATTACHMENTS,
  type Attachment,
  HISTORY,
  LINE_ITEMS,
  MASTER_RECORD,
} from "./mockData"

// 分隔線拖拉的高度界線（px）：Master 與 Detail 各自的最小可視高度、Master 預設高度
const MASTER_MIN_HEIGHT = 140
const DETAIL_MIN_HEIGHT = 180
const MASTER_DEFAULT_HEIGHT = 320

// 優先度 → 標籤與色彩（與狀態分流，給 Master 抬頭的 badge 用）
const PRIORITY_BADGE: Record<
  ItemPriority,
  { label: string; className: string }
> = {
  low: { label: "低", className: "bg-slate-100 text-slate-600" },
  normal: { label: "中", className: "bg-sky-100 text-sky-700" },
  high: { label: "高", className: "bg-orange-100 text-orange-700" },
  urgent: { label: "急件", className: "bg-rose-100 text-rose-700" },
}

// 附件種類 → lucide icon 對應
const ATTACHMENT_ICON: Record<Attachment["kind"], LucideIcon> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  image: FileImage,
  word: FileType,
}

// 簽核狀態 → icon / 色彩 / badge 樣式與文字
const APPROVAL_META: Record<
  ApprovalStatus,
  {
    icon: LucideIcon
    className: string
    label: string
    badge: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  approved: {
    icon: CheckCircle2,
    className: "text-emerald-600",
    label: "已核准",
    badge: "secondary",
  },
  current: {
    icon: Clock,
    className: "text-amber-600",
    label: "簽核中",
    badge: "default",
  },
  pending: {
    icon: Circle,
    className: "text-muted-foreground",
    label: "待簽核",
    badge: "outline",
  },
  rejected: {
    icon: XCircle,
    className: "text-rose-600",
    label: "已退回",
    badge: "destructive",
  },
}

// Master-Detail 示範頁：上方 Master 聚焦單筆主檔、下方 Detail 用內層頁籤延展，
// 中央分隔線可垂直拖拉調整上下兩區高度（沿用 Side Panel 的 Pointer Capture 手法）
export function MasterDetailDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  )
  const [masterHeight, setMasterHeight] = useState(MASTER_DEFAULT_HEIGHT)

  // 開始拖拉：鎖定指標、記住起點 Y 與當下 Master 高度
  const handleResizeStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = { startY: e.clientY, startHeight: masterHeight }
  }

  // 拖拉中：依垂直位移調整 Master 高度，夾在 [MIN, 容器高 - DETAIL_MIN] 之間
  const handleResizeMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current
    if (!drag) return
    const containerHeight = containerRef.current?.clientHeight ?? Infinity
    const maxHeight = Math.max(
      MASTER_MIN_HEIGHT,
      containerHeight - DETAIL_MIN_HEIGHT,
    )
    const next = drag.startHeight + (e.clientY - drag.startY)
    setMasterHeight(Math.min(maxHeight, Math.max(MASTER_MIN_HEIGHT, next)))
  }

  // 結束拖拉：釋放指標、清掉拖拉狀態
  const handleResizeEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragStateRef.current = null
  }

  const r = MASTER_RECORD
  const priority = PRIORITY_BADGE[r.priority]
  const status = STATUS_CONFIG[r.status]

  return (
    // 外殼 relative + 內層 absolute inset-0：脫離文檔流，避免 Master 變高時把整頁
    // 撐長（main 是 min-h-svh 內容驅動、無硬高度）。內層才拿到固定高度，flex-1 的
    // Detail 才有可收縮的天花板，分隔線拖拉才會「擠壓」而非「撐高」。
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 flex flex-col text-sm"
      >
        <PageHeader
          tabKey="master-detail"
          title="Master Detail"
          description="採購單主檔與明細頁籤的 Master-Detail 示範"
        />

        {/* ===== Master 區：固定在上方、聚焦呈現這一筆 ===== */}
        <section
          className="flex shrink-0 flex-col overflow-hidden rounded-lg border bg-card"
          style={{ height: masterHeight }}
        >
          {/* 主檔抬頭：單號 + 單據類型 + 狀態 / 優先度 badge */}
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                <h1 className="truncate text-lg font-bold tracking-tight">
                  {r.orderNo}
                </h1>
                <Badge variant="outline">{r.docType}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                供應商：{r.supplierName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  priority.className,
                )}
              >
                {priority.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  status.text,
                )}
              >
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </span>
            </div>
          </div>

          {/* 主檔欄位：四個語意群組，欄位涵蓋文字 / 日期 / 金額 / 長文字 */}
          <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 md:grid-cols-2 xl:grid-cols-4">
            <FieldGroup icon={<FileText className="size-4" />} title="訂單資訊">
              <FieldItem label="訂單編號" value={r.orderNo} />
              <FieldItem label="單據類型" value={r.docType} />
              <FieldItem label="建立日期" value={r.createdDate} />
              <FieldItem label="預計到貨" value={r.expectedDate} />
              <FieldItem label="採購部門" value={r.department} span />
            </FieldGroup>

            <FieldGroup
              icon={<Building2 className="size-4" />}
              title="供應商資訊"
            >
              <FieldItem label="供應商代碼" value={r.supplierCode} />
              <FieldItem label="統一編號" value={r.taxId} />
              <FieldItem label="供應商名稱" value={r.supplierName} span />
              <FieldItem label="聯絡人" value={r.contact} />
              <FieldItem label="聯絡電話" value={r.contactPhone} />
            </FieldGroup>

            <FieldGroup icon={<Coins className="size-4" />} title="金額與條件">
              <FieldItem label="幣別" value={r.currency} />
              <FieldItem label="折扣" value={`${r.discount}%`} />
              <FieldItem
                label="未稅金額"
                value={money(r.amountUntaxed)}
                align="right"
              />
              <FieldItem
                label={`稅額（${r.taxRate}%）`}
                value={money(r.taxAmount)}
                align="right"
              />
              <FieldItem
                label="含稅總金額"
                value={money(r.amountTotal)}
                align="right"
                highlight
                span
              />
              <FieldItem label="付款條件" value={r.terms} span />
            </FieldGroup>

            <FieldGroup icon={<Truck className="size-4" />} title="物流與備註">
              <FieldItem
                label="交貨地址"
                value={r.deliveryAddress}
                span
                multiline
              />
              <FieldItem label="備註" value={r.remark} span multiline />
            </FieldGroup>
          </div>
        </section>

        {/* ===== 可拖拉分隔線：垂直拖動調整上下兩區高度 ===== */}
        <button
          type="button"
          aria-label="拖曳調整上下區塊高度"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          className="group relative flex h-3 w-full shrink-0 cursor-row-resize touch-none items-center justify-center border-0 bg-transparent p-0"
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <span className="relative inline-flex items-center justify-center rounded bg-muted px-2 py-0.5 text-muted-foreground transition-colors group-hover:bg-primary/20 group-active:bg-primary/30">
            <GripHorizontal className="size-3.5" />
          </span>
        </button>

        {/* ===== Detail 區：用內層頁籤延展主檔的相關資訊 ===== */}
        <section className="flex min-h-0 flex-1 flex-col">
          <Tabs
            defaultValue="items"
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <TabsList className="w-fit">
              <TabsTrigger value="items">
                品項明細
                <Badge variant="secondary" className="ml-0.5 px-1.5">
                  {LINE_ITEMS.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="files">
                附件
                <Badge variant="secondary" className="ml-0.5 px-1.5">
                  {ATTACHMENTS.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history">歷史紀錄</TabsTrigger>
              <TabsTrigger value="approval">簽核流程</TabsTrigger>
            </TabsList>

            <TabsContent
              value="items"
              className="min-h-0 flex-1 overflow-auto rounded-lg border"
            >
              <LineItemsTable />
            </TabsContent>
            <TabsContent
              value="files"
              className="min-h-0 flex-1 overflow-auto rounded-lg border p-3"
            >
              <AttachmentList />
            </TabsContent>
            <TabsContent
              value="history"
              className="min-h-0 flex-1 overflow-auto rounded-lg border p-4"
            >
              <HistoryTimeline />
            </TabsContent>
            <TabsContent
              value="approval"
              className="min-h-0 flex-1 overflow-auto rounded-lg border p-4"
            >
              <ApprovalSteps />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  )
}

// 主檔欄位群組：小標題（icon + 文字）+ 內部雙欄欄位 grid
function FieldGroup({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
    </div>
  )
}

// 主檔單一欄位：label 在上、value 在下（仿輸入框外觀的唯讀盒）
// span 跨兩欄、multiline 放長文字、highlight 強調金額、align 控制數字靠右
function FieldItem({
  label,
  value,
  span,
  multiline,
  highlight,
  align,
}: {
  label: string
  value: string
  span?: boolean
  multiline?: boolean
  highlight?: boolean
  align?: "right"
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", span && "col-span-2")}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "rounded-md border px-2 py-1 text-sm",
          highlight
            ? "border-primary/30 bg-primary/10 font-semibold text-primary"
            : "bg-muted/30",
          multiline ? "whitespace-pre-wrap break-words" : "truncate",
          align === "right" && "text-right tabular-nums",
        )}
        title={value}
      >
        {value || "—"}
      </span>
    </div>
  )
}

// 狀態小標：彩色圓點 + 文字（與 ItemsCRUD 表格一致）
function StatusInline({ status }: { status: ItemStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-medium", c.text)}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  )
}

// 明細頁籤一：品項明細，重用 ItemsCRUD 假資料、密集表格呈現，表尾結算合計
function LineItemsTable() {
  const total = LINE_ITEMS.reduce((sum, it) => sum + it.amount, 0)
  return (
    <table className="w-full border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
        <tr className="border-b">
          <th className="h-8 px-2 text-left font-medium text-muted-foreground">
            品號
          </th>
          <th className="h-8 px-2 text-left font-medium text-muted-foreground">
            品名
          </th>
          <th className="h-8 px-2 text-left font-medium text-muted-foreground">
            分類
          </th>
          <th className="h-8 px-2 text-right font-medium text-muted-foreground">
            數量
          </th>
          <th className="h-8 px-2 text-right font-medium text-muted-foreground">
            單價
          </th>
          <th className="h-8 px-2 text-right font-medium text-muted-foreground">
            小計
          </th>
          <th className="h-8 px-2 text-left font-medium text-muted-foreground">
            狀態
          </th>
        </tr>
      </thead>
      <tbody>
        {LINE_ITEMS.map((it) => (
          <tr
            key={it.id}
            className="border-b transition-colors hover:bg-muted/40"
          >
            <td className="h-8 px-2 font-medium">{it.code}</td>
            <td className="h-8 px-2">{it.name}</td>
            <td className="h-8 px-2 text-muted-foreground">{it.category}</td>
            <td className="h-8 px-2 text-right tabular-nums">{it.qty}</td>
            <td className="h-8 px-2 text-right tabular-nums">
              {money(Math.round(it.amount / it.qty))}
            </td>
            <td className="h-8 px-2 text-right tabular-nums">
              {money(it.amount)}
            </td>
            <td className="h-8 px-2">
              <StatusInline status={it.status} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 bg-muted/40 backdrop-blur">
        <tr className="border-t font-medium">
          <td className="h-8 px-2" colSpan={5}>
            合計
          </td>
          <td className="h-8 px-2 text-right tabular-nums">{money(total)}</td>
          <td className="h-8 px-2" />
        </tr>
      </tfoot>
    </table>
  )
}

// 明細頁籤二：附件清單，每列檔案 icon + 名稱 + 資訊 + 下載鈕
function AttachmentList() {
  return (
    <ul className="flex flex-col gap-2">
      {ATTACHMENTS.map((a) => {
        const Icon = ATTACHMENT_ICON[a.kind]
        return (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.size} · {a.uploader} · {a.uploadedAt}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <Download className="size-4" />
              <span className="sr-only">下載</span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

// 明細頁籤三：歷史紀錄，左側時間軸 rail（圓點 + 連接線）+ 事件內容
function HistoryTimeline() {
  return (
    <ol className="flex flex-col">
      {HISTORY.map((h, i) => (
        <li key={h.id} className="flex gap-3">
          {/* 時間軸欄：圓點 + 往下延伸的連接線（最後一筆不畫線） */}
          <div className="flex flex-col items-center">
            <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-background bg-primary ring-1 ring-border" />
            {i < HISTORY.length - 1 && (
              <span className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-sm font-medium">{h.action}</span>
              <span className="text-xs text-muted-foreground">
                {h.actor} · {h.time}
              </span>
            </div>
            {h.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{h.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// 明細頁籤四：簽核流程，直式 stepper（狀態 icon + 連接線 + 關卡資訊）
function ApprovalSteps() {
  return (
    <ol className="flex flex-col">
      {APPROVAL_FLOW.map((s, i) => {
        const meta = APPROVAL_META[s.status]
        const Icon = meta.icon
        return (
          <li key={s.id} className="flex gap-3">
            {/* 狀態欄：狀態 icon + 往下延伸的連接線（最後一關不畫線） */}
            <div className="flex flex-col items-center">
              <Icon className={cn("size-5 shrink-0", meta.className)} />
              {i < APPROVAL_FLOW.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{s.stage}</span>
                <Badge variant={meta.badge}>{meta.label}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.approver} · {s.role}
                {s.time && ` · ${s.time}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
