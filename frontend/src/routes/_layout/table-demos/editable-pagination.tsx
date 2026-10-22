import { createFileRoute } from "@tanstack/react-router"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { FeatureIntro } from "@/components/TableDemos/FeatureIntro"
import {
  makeOrders,
  money,
  type OrderRow,
  STATUS_META,
} from "@/components/TableDemos/mockData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute(
  "/_layout/table-demos/editable-pagination",
)({
  component: EditablePaginationDemo,
  head: () => ({
    meta: [{ title: "Editable & Pagination - DoDo Admin" }],
  }),
})

// 模擬的後端資料庫：整份資料存在模組層，跨分頁保留編輯結果
const serverDb = makeOrders(45)

// 模擬 server-side 分頁 API：延遲 300ms 回傳指定頁的資料切片
function fetchOrders(pageIndex: number, pageSize: number) {
  return new Promise<{ rows: OrderRow[]; total: number }>((resolve) => {
    setTimeout(() => {
      resolve({
        rows: serverDb.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
        total: serverDb.length,
      })
    }, 300)
  })
}

// 模擬 server-side 更新 API：把編輯寫回模組層資料庫
function updateOrder(id: string, patch: Partial<OrderRow>) {
  const target = serverDb.find((r) => r.id === id)
  if (target) Object.assign(target, patch)
}

// 可編輯儲存格：blur 或 Enter 時把值送回 table.options.meta
function EditableCell({
  value,
  type,
  onCommit,
}: {
  value: string | number
  type: "text" | "number"
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(String(value))

  // 外部資料變動（例如換頁）時同步草稿值
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  return (
    <Input
      value={draft}
      type={type}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      className="h-8 w-full max-w-40 bg-transparent"
    />
  )
}

// 擴充 meta 型別，讓 columnDef 能拿到 updateData
type TableMeta = {
  updateData: (rowId: string, key: keyof OrderRow, value: string) => void
}

const COLUMNS: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "orderNo",
    header: "訂單編號",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.orderNo}</span>
    ),
  },
  {
    accessorKey: "customer",
    header: "客戶（可編輯）",
    cell: ({ row, table }) => (
      <EditableCell
        value={row.original.customer}
        type="text"
        onCommit={(v) =>
          (table.options.meta as TableMeta).updateData(
            row.original.id,
            "customer",
            v,
          )
        }
      />
    ),
  },
  {
    accessorKey: "qty",
    header: "數量（可編輯）",
    cell: ({ row, table }) => (
      <EditableCell
        value={row.original.qty}
        type="number"
        onCommit={(v) =>
          (table.options.meta as TableMeta).updateData(
            row.original.id,
            "qty",
            v,
          )
        }
      />
    ),
  },
  {
    accessorKey: "amount",
    header: "金額 NT$",
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status]
      return (
        <Badge variant="outline" className={meta.className}>
          {meta.label}
        </Badge>
      )
    },
  },
]

// 可編輯儲存格與模擬 server-side 分頁示範頁
function EditablePaginationDemo() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // 分頁參數變動時，向「後端」要該頁資料
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchOrders(pagination.pageIndex, pagination.pageSize).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setTotal(res.total)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [pagination])

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    state: { pagination },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    meta: {
      // 編輯提交：更新本頁 state，同步寫回模擬後端
      updateData: (rowId, key, value) => {
        setRows((prev) =>
          prev.map((row) => {
            if (row.id !== rowId) return row
            const parsed = key === "qty" ? Number(value) || 0 : value
            const next = { ...row, [key]: parsed }
            updateOrder(rowId, { [key]: parsed })
            return next
          }),
        )
      },
    } satisfies TableMeta,
  })

  const { pageIndex, pageSize } = pagination

  return (
    <div>
      <FeatureIntro
        title="Editable & Pagination"
        description="客戶與數量欄可直接編輯（blur 或 Enter 提交），編輯結果換頁後仍保留；分頁採 manualPagination，以 300ms 延遲模擬 server-side API。"
        features={[
          {
            name: "可編輯儲存格",
            api: "meta.updateData",
            note: "table.options.meta 自訂 API，cell 內呼叫回寫資料",
          },
          {
            name: "手動分頁",
            api: "manualPagination",
            note: "資料由外部（模擬 API）供給，rowCount 告知總筆數",
          },
        ]}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} className="h-32">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    載入中…
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">每頁</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            筆，共 {total} 筆
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            第 {pageIndex + 1} / {table.getPageCount()} 頁
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage() || isLoading}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">上一頁</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage() || isLoading}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">下一頁</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
