import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Download,
  EllipsisVertical,
  Eye,
  MoveLeft,
  MoveRight,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/Common/PageHeader"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  CATEGORIES,
  CURRENCY_OPTIONS,
  HANDLERS,
  type ItemRow,
  type ItemStatus,
  MOCK_ITEMS,
  money,
  PRIORITY_OPTIONS,
  STATUS_CONFIG,
  STATUS_ORDER,
  TERMS,
  TODAY_STR,
} from "./mockData"

// 狀態欄：彩色圓點 + 文字
function StatusCell({ status }: { status: ItemStatus }) {
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

const COLUMN_LABELS: Record<string, string> = {
  code: "編號",
  name: "名稱",
  category: "分類",
  handler: "負責人",
  createdDate: "建立日期",
  dueDate: "預計日期",
  qty: "數量",
  amount: "金額 NT$",
  terms: "付款條件",
  status: "狀態",
}

const DEFAULT_COLUMN_ORDER = [
  "select",
  "code",
  "name",
  "category",
  "handler",
  "createdDate",
  "dueDate",
  "qty",
  "amount",
  "terms",
  "status",
  "actions",
]

const RIGHT_ALIGNED_COLUMNS = new Set(["qty", "amount"])

// 可排序表頭：只給編號與數字欄位使用
function SortableHeader({
  label,
  column,
}: {
  label: string
  column: Column<ItemRow, unknown>
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc" ? ChevronUp : sorted === "desc" ? ChevronDown : ArrowUpDown
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-7 gap-1 px-2 text-xs",
        RIGHT_ALIGNED_COLUMNS.has(column.id) && "ml-auto -mr-2",
      )}
      onClick={(e) => column.toggleSorting(undefined, e.shiftKey)}
    >
      {label}
      <Icon
        className={cn(
          "size-3",
          sorted ? "text-foreground" : "text-muted-foreground/50",
        )}
      />
    </Button>
  )
}

// 依欄位類型回傳表格儲存格對齊與固定尺寸
function getCellClassName(columnId: string): string {
  return cn(
    "h-8 px-2 whitespace-nowrap",
    columnId === "select" && "w-9",
    columnId === "actions" && "w-9 text-right",
    RIGHT_ALIGNED_COLUMNS.has(columnId) ? "text-right" : "text-left",
  )
}

// 單筆資料展示佔位內容：先確認滿版 panel 互動語意
function DetailPlaceholder({ row }: { row?: ItemRow }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-md border bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">目前選取資料</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <h3 className="text-2xl font-semibold tracking-tight">
            {row?.code ?? "未選取"}
          </h3>
          <span className="text-sm text-muted-foreground">
            {row?.name ?? "Placeholder"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {["主要資訊", "流程紀錄", "相關附件"].map((title) => (
          <div key={title} className="rounded-md border p-4">
            <h4 className="text-sm font-medium">{title}</h4>
            <div className="mt-4 h-28 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      <div className="min-h-64 flex-1 rounded-md border p-4">
        <h4 className="text-sm font-medium">明細區塊</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="h-36 rounded bg-muted/40" />
          <div className="h-36 rounded bg-muted/40" />
        </div>
      </div>
    </div>
  )
}

// 日期區間 chips 設定
const DATE_CHIPS = [
  { key: "all", label: "全部" },
  { key: "today", label: "今日" },
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
] as const
type ChipKey = (typeof DATE_CHIPS)[number]["key"]

// 將 YYYY/MM/DD 轉為 Date 以利日期比較
function parseDate(s: string): Date {
  return new Date(s.replace(/\//g, "-"))
}
const TODAY = parseDate(TODAY_STR)

// 判斷某列是否落在指定日期區間
function inDateChip(r: ItemRow, chip: ChipKey): boolean {
  if (chip === "all") return true
  if (chip === "today") return r.createdDate === TODAY_STR
  if (chip === "month")
    return r.createdDate.slice(0, 7) === TODAY_STR.slice(0, 7)
  const diffDays =
    (TODAY.getTime() - parseDate(r.createdDate).getTime()) / 86400000
  return diffDays >= 0 && diffDays <= 6
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// 面板預設/最小寬度（px）；最大寬度於拖拉時依容器寬度即時換算（容器的一半）
const PANEL_DEFAULT_WIDTH = 800
const PANEL_MIN_WIDTH = 360

// ItemsCRUD 主元件：純前端密集表格（假資料，列表操作會動、表單僅示範）
export function ItemsCRUD() {
  // 元件根容器：自訂面板用 absolute 定位侷限在此範圍內，不外溢到側邊欄/Header
  const hostRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  )
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH)
  // 面板的「視覺開啟」狀態，跟資料分開，讓關閉時能先播放收合動畫再卸載內容
  const [panelOpen, setPanelOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [chip, setChip] = useState<ChipKey>("all")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  // 新增/編輯/展示：自訂 Slide Panel 狀態；row 為 undefined 代表新增
  const [panel, setPanel] = useState<{
    mode: "add" | "edit" | "detail"
    row?: ItemRow
  } | null>(null)
  // 刪除：維持原本 Dialog 確認框；row 為 undefined 代表刪除目前已勾選的多筆
  const [deleteTarget, setDeleteTarget] = useState<{ row?: ItemRow } | null>(
    null,
  )

  // panel 開啟時：下一幀觸發滑入動畫；panel 關閉(null)時：立即收合（無需動畫，因內容已卸載）
  useEffect(() => {
    if (!panel) {
      setPanelOpen(false)
      return
    }
    const id = requestAnimationFrame(() => setPanelOpen(true))
    return () => cancelAnimationFrame(id)
  }, [panel])

  // 關閉面板：先播放滑出動畫，動畫結束後才卸載內容（與 CSS transition-duration 一致）
  const closePanel = useCallback(() => {
    setPanelOpen(false)
    window.setTimeout(() => setPanel(null), 200)
  }, [])

  // 收合面板：將目前寬度縮回最小寬度設定
  const collapsePanel = useCallback(() => {
    setPanelWidth(PANEL_MIN_WIDTH)
  }, [])

  // Esc 鍵關閉面板（拿掉遮罩後，這是唯一的鍵盤關閉手段）
  useEffect(() => {
    if (!panel) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [panel, closePanel])

  // 拖拉把手：依水平位移即時調整面板寬度，上限鎖在容器寬度的一半
  const handleResizeStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = { startX: e.clientX, startWidth: panelWidth }
  }
  const handleResizeMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current
    if (!drag) return
    const containerWidth = hostRef.current?.clientWidth ?? Infinity
    const maxWidth = Math.max(PANEL_MIN_WIDTH, containerWidth / 2)
    const next = drag.startWidth + (drag.startX - e.clientX)
    setPanelWidth(Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, next)))
  }
  const handleResizeEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragStateRef.current = null
  }

  // 各日期 chip 的筆數（顯示在 chip 上）
  const chipCounts = useMemo(() => {
    const map = {} as Record<ChipKey, number>
    for (const c of DATE_CHIPS)
      map[c.key] = MOCK_ITEMS.filter((r) => inDateChip(r, c.key)).length
    return map
  }, [])

  const chipRows = useMemo(
    () => MOCK_ITEMS.filter((r) => inDateChip(r, chip)),
    [chip],
  )

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="選取本頁全部"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={`選取 ${row.original.code}`}
          />
        ),
        enableHiding: false,
      },
      {
        accessorKey: "code",
        header: ({ column }) => <SortableHeader label="編號" column={column} />,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.code}
          </span>
        ),
        enableGlobalFilter: true,
        enableSorting: true,
        sortingFn: "alphanumeric",
      },
      {
        accessorKey: "name",
        header: "名稱",
        enableGlobalFilter: true,
      },
      { accessorKey: "category", header: "分類" },
      { accessorKey: "handler", header: "負責人" },
      { accessorKey: "createdDate", header: "建立日期" },
      { accessorKey: "dueDate", header: "預計日期" },
      {
        accessorKey: "qty",
        header: ({ column }) => <SortableHeader label="數量" column={column} />,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.qty}</span>
        ),
        enableSorting: true,
        sortingFn: "basic",
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <SortableHeader label="金額 NT$" column={column} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{money(row.original.amount)}</span>
        ),
        enableSorting: true,
        sortingFn: "basic",
      },
      { accessorKey: "terms", header: "付款條件" },
      {
        accessorKey: "status",
        header: "狀態",
        cell: ({ row }) => <StatusCell status={row.original.status} />,
        filterFn: "equals",
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setPanel({ mode: "detail", row: row.original })}
              >
                <Eye className="size-4" />
                展示單筆資料
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPanel({ mode: "edit", row: row.original })}
              >
                <Pencil className="size-4" />
                編輯
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteTarget({ row: row.original })}
              >
                <Trash2 className="size-4" />
                刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableHiding: false,
      },
    ],
    [],
  )

  // 將指定欄位在 columnOrder 中往左或往右移一格（select 與 actions 固定）
  function moveColumn(id: string, dir: -1 | 1) {
    setColumnOrder((order) => {
      const idx = order.indexOf(id)
      const target = idx + dir
      if (target < 1 || target >= order.length - 1) return order
      const next = [...order]
      next[idx] = next[target]
      next[target] = id
      return next
    })
  }

  const table = useReactTable({
    data: chipRows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: search,
      rowSelection,
      columnVisibility,
      columnOrder,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setSearch,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    defaultColumn: {
      enableGlobalFilter: false,
      enableSorting: false,
    },
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as ItemStatus | undefined) ??
    "all"
  const selectedCount = Object.keys(rowSelection).length
  const filteredCount = table.getFilteredRowModel().rows.length
  const pageCount = Math.max(1, table.getPageCount())
  const { pageIndex, pageSize } = table.getState().pagination

  // 將頁碼歸零，避免篩選後停在空頁
  const resetPage = () => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  // 唯一選取列（供「編輯」按鈕使用）
  const singleSelectedRow = (): ItemRow | undefined => {
    const ids = Object.keys(rowSelection)
    if (ids.length !== 1) return undefined
    const id = ids[0]
    return MOCK_ITEMS.find((r) => r.id === id)
  }

  // 示範用提示：實際不寫入資料
  const demoToast = (msg: string) =>
    toast.info(`（示範）${msg}，未實際變更資料`)

  const isDetailPanel = panel?.mode === "detail"
  const panelTitle =
    panel?.mode === "detail"
      ? "展示單筆資料"
      : panel?.mode === "edit"
        ? "編輯項目"
        : "新增項目"
  const panelDescription =
    panel?.mode === "detail"
      ? "滿版展示區塊，內容先以 placeholder 呈現。"
      : "此為示範表單，儲存不會寫入資料。"

  return (
    <div
      ref={hostRef}
      className="relative flex h-full min-h-0 flex-col text-sm"
    >
      <div className="flex flex-col gap-3">
        <PageHeader
          tabKey="items-crud"
          title="ItemsCRUD"
          description="密集表格示範（假資料，列表操作可用、表單僅展示）"
        />

        {/* 工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              className="h-8"
              onClick={() => setPanel({ mode: "add" })}
            >
              <Plus className="size-4" />
              新增
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={selectedCount !== 1}
              onClick={() =>
                setPanel({ mode: "edit", row: singleSelectedRow() })
              }
            >
              <Pencil className="size-4" />
              編輯
            </Button>
            {selectedCount > 0 && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={() => setDeleteTarget({})}
              >
                <Trash2 className="size-4" />
                刪除（{selectedCount}）
              </Button>
            )}
            {selectedCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setRowSelection({})}
              >
                清除選取
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => demoToast("匯出")}
            >
              <Download className="size-4" />
              匯出
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* 日期 chips */}
            <div className="flex items-center gap-1">
              {DATE_CHIPS.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => {
                    setChip(c.key)
                    resetPage()
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 h-8 text-xs transition-colors",
                    chip === c.key
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.label}
                  <span className="tabular-nums opacity-70">
                    {chipCounts[c.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* 狀態下拉 */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                table
                  .getColumn("status")
                  ?.setFilterValue(v === "all" ? undefined : v)
                resetPage()
              }}
            >
              <SelectTrigger size="sm" className="h-8 w-[120px]">
                <SelectValue placeholder="全部狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 搜尋 */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetPage()
                }}
                placeholder="搜尋編號 / 名稱…"
                className="h-8 w-[220px] pl-8"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Settings2 className="size-4" />
                  欄位設定
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>顯示與順序</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnOrder
                  .filter((id) => id !== "select" && id !== "actions")
                  .map((id) => {
                    const column = table.getColumn(id)
                    if (!column) return null
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-2 py-1.5"
                      >
                        <Checkbox
                          checked={column.getIsVisible()}
                          onCheckedChange={(v) => column.toggleVisibility(!!v)}
                          aria-label={`顯示${COLUMN_LABELS[id]}`}
                        />
                        <span className="flex-1 text-sm">
                          {COLUMN_LABELS[id]}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => moveColumn(id, -1)}
                        >
                          <MoveLeft className="size-3.5" />
                          <span className="sr-only">左移</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => moveColumn(id, 1)}
                        >
                          <MoveRight className="size-3.5" />
                          <span className="sr-only">右移</span>
                        </Button>
                      </div>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 密集表格 */}
        <div className="rounded-md border">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          getCellClassName(header.column.id),
                          "font-medium text-muted-foreground",
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={table.getVisibleFlatColumns().length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      查無資料
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/40",
                        row.getIsSelected() && "bg-primary/5",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={getCellClassName(cell.column.id)}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分頁列 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                共{" "}
                <span className="font-medium text-foreground">
                  {filteredCount}
                </span>{" "}
                筆
                {selectedCount > 0 && (
                  <span className="ml-1">· 已選 {selectedCount}</span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span>每頁</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    table.setPageSize(Number(v))
                    table.setPageIndex(0)
                  }}
                >
                  <SelectTrigger size="sm" className="h-7 w-[68px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span>
                第{" "}
                <span className="font-medium text-foreground">
                  {pageIndex + 1}
                </span>{" "}
                / {pageCount} 頁
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.setPageIndex(0)}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.setPageIndex(pageCount - 1)}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 刪除確認（示範用，不寫入資料） */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>刪除確認</DialogTitle>
            <DialogDescription>
              {deleteTarget?.row
                ? `將刪除「${deleteTarget.row.code}」。`
                : `將刪除已選取的項目。`}
              此為示範，不會真的刪除資料。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                demoToast("刪除")
                setDeleteTarget(null)
              }}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增 / 編輯：右側 Slide Panel（示範用，不寫入資料、不驗證） */}
      {/* 新增/編輯自訂 Slide Panel：absolute 侷限在本元件根容器內，無遮罩、可拖拉寬度 */}
      {panel !== null && (
        <div
          className="absolute inset-y-0 right-0 z-20 flex border-l bg-background shadow-xl transition-transform duration-200 ease-out"
          style={{
            width: isDetailPanel ? "100%" : panelWidth,
            transform: panelOpen ? "translateX(0)" : "translateX(100%)",
          }}
        >
          {/* 拖拉把手：與左側邊框線重疊的熱區，互動範圍與視覺邊界完全對齊（見 handleResizeMove） */}
          {!isDetailPanel && (
            <button
              type="button"
              aria-label="拖曳調整面板寬度"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              className="w-2 shrink-0 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
            />
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-2">
              {isDetailPanel ? (
                <span className="px-2 text-xs font-medium text-muted-foreground">
                  滿版展示
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={collapsePanel}
                >
                  <ChevronsRight className="size-4" />
                  <span className="sr-only">收合面板至最小寬度</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={closePanel}
              >
                <X className="size-4" />
                <span className="sr-only">關閉</span>
              </Button>
            </div>

            <div className="border-b px-4 py-4">
              <div>
                <h2 className="text-base font-semibold">{panelTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  {panelDescription}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isDetailPanel ? (
                <DetailPlaceholder row={panel.row} />
              ) : (
                <div className="flex flex-col gap-5">
                  <FormSection title="基本資料">
                    <Field
                      label="編號"
                      defaultValue={panel.row?.code}
                      disabled
                    />
                    <Field label="名稱" defaultValue={panel.row?.name} />
                    <SelectField
                      label="分類"
                      defaultValue={panel.row?.category}
                      options={CATEGORIES.map((v) => ({ value: v, label: v }))}
                    />
                    <SelectField
                      label="負責人"
                      defaultValue={panel.row?.handler}
                      options={HANDLERS.map((v) => ({ value: v, label: v }))}
                    />
                    <SelectField
                      label="優先度"
                      defaultValue={panel.row?.priority ?? "normal"}
                      options={PRIORITY_OPTIONS}
                    />
                    <SelectField
                      label="狀態"
                      defaultValue={panel.row?.status ?? "draft"}
                      options={STATUS_ORDER.map((s) => ({
                        value: s,
                        label: STATUS_CONFIG[s].label,
                      }))}
                    />
                  </FormSection>

                  <FormSection title="日期與聯絡">
                    <DateField
                      label="建立日期"
                      defaultValue={panel.row?.createdDate.replace(/\//g, "-")}
                    />
                    <DateField
                      label="預計到貨"
                      defaultValue={panel.row?.dueDate.replace(/\//g, "-")}
                    />
                    <DateField
                      label="預計出貨日"
                      defaultValue={panel.row?.expectedShipDate}
                    />
                    <Field
                      label="聯絡電話"
                      defaultValue={panel.row?.contactPhone}
                    />
                  </FormSection>

                  <FormSection title="金額與條件">
                    <Field
                      label="數量"
                      type="number"
                      defaultValue={panel.row ? String(panel.row.qty) : ""}
                    />
                    <SelectField
                      label="幣別"
                      defaultValue={panel.row?.currency ?? "TWD"}
                      options={CURRENCY_OPTIONS}
                    />
                    <Field
                      label="金額"
                      type="number"
                      defaultValue={panel.row ? String(panel.row.amount) : ""}
                    />
                    <SelectField
                      label="付款條件"
                      defaultValue={panel.row?.terms}
                      options={TERMS.map((v) => ({ value: v, label: v }))}
                    />
                    <Field
                      label="稅率 (%)"
                      type="number"
                      defaultValue={panel.row ? String(panel.row.taxRate) : ""}
                    />
                    <Field
                      label="折扣 (%)"
                      type="number"
                      defaultValue={panel.row ? String(panel.row.discount) : ""}
                    />
                  </FormSection>

                  <FormSection title="其他">
                    <TextareaField
                      label="交貨地址"
                      defaultValue={panel.row?.deliveryAddress}
                      span
                    />
                    <TextareaField
                      label="備註"
                      defaultValue={panel.row?.remark}
                      span
                    />
                  </FormSection>
                </div>
              )}
            </div>

            {/* 功能區塊：底色 + 上邊框明確區隔，之後新增取消以外的操作放這排 */}
            {!isDetailPanel && (
              <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
                <Button variant="outline" onClick={closePanel}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    demoToast("儲存")
                    closePanel()
                  }}
                >
                  儲存
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 表單分組區塊：標題 + 雙欄 grid，組與組間用上邊框分隔
function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

// 文字／數字欄位：label + input
function Field({
  label,
  defaultValue,
  type = "text",
  disabled,
}: {
  label: string
  defaultValue?: string
  type?: "text" | "number"
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-8"
      />
    </div>
  )
}

// 下拉選單欄位：label + Select（未受控，僅示範預填值）
function SelectField({
  label,
  defaultValue,
  options,
}: {
  label: string
  defaultValue?: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select defaultValue={defaultValue}>
        <SelectTrigger size="sm" className="h-8 w-full">
          <SelectValue placeholder="請選擇" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// 日期欄位：label + 原生 date input（瀏覽器原生日期選擇器，不需額外套件）
function DateField({
  label,
  defaultValue,
}: {
  label: string
  defaultValue?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="date" defaultValue={defaultValue} className="h-8" />
    </div>
  )
}

// 多行文字欄位：label + textarea（沿用 Input 同款邊框樣式）；span 時跨兩欄
function TextareaField({
  label,
  defaultValue,
  span,
}: {
  label: string
  defaultValue?: string
  span?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1", span && "col-span-2")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <textarea
        defaultValue={defaultValue}
        rows={2}
        className="border-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-full min-w-0 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}
