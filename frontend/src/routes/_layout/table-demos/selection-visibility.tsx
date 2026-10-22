import { createFileRoute } from "@tanstack/react-router"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type RowSelectionState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  MoveLeft,
  MoveRight,
  Settings2,
} from "lucide-react"
import { useState } from "react"

import { FeatureIntro } from "@/components/TableDemos/FeatureIntro"
import {
  money,
  ORDERS,
  type OrderRow,
  STATUS_META,
} from "@/components/TableDemos/mockData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute(
  "/_layout/table-demos/selection-visibility",
)({
  component: SelectionVisibilityDemo,
  head: () => ({
    meta: [{ title: "Selection & Visibility - DoDo Admin" }],
  }),
})

const COLUMN_LABELS: Record<string, string> = {
  orderNo: "訂單編號",
  customer: "客戶",
  region: "區域",
  category: "分類",
  status: "狀態",
  amount: "金額 NT$",
}

const COLUMNS: ColumnDef<OrderRow>[] = [
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
        aria-label="選取此列"
      />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "orderNo",
    header: "訂單編號",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.orderNo}</span>
    ),
  },
  { accessorKey: "customer", header: "客戶" },
  { accessorKey: "region", header: "區域" },
  { accessorKey: "category", header: "分類" },
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
  {
    accessorKey: "amount",
    header: "金額 NT$",
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
  },
]

const DEFAULT_ORDER = [
  "select",
  "orderNo",
  "customer",
  "region",
  "category",
  "status",
  "amount",
]

// 列勾選、欄位顯示與欄位順序示範頁
function SelectionVisibilityDemo() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_ORDER)

  const table = useReactTable({
    data: ORDERS,
    columns: COLUMNS,
    state: { rowSelection, columnVisibility, columnOrder },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  // 將指定欄位在 columnOrder 中往左或往右移一格（select 欄固定在最前）
  function moveColumn(id: string, dir: -1 | 1) {
    setColumnOrder((order) => {
      const idx = order.indexOf(id)
      const target = idx + dir
      if (target < 1 || target >= order.length) return order
      const next = [...order]
      next[idx] = next[target]
      next[target] = id
      return next
    })
  }

  const selectedCount = Object.keys(rowSelection).length
  const { pageIndex } = table.getState().pagination

  return (
    <div>
      <FeatureIntro
        title="Selection & Visibility"
        description="勾選列（換頁後選取保留）、用「欄位設定」切換欄位顯示與調整順序。"
        features={[
          {
            name: "列勾選",
            api: "rowSelection",
            note: "getRowId 用資料 id 當 key，跨頁選取不會丟失",
          },
          {
            name: "欄位顯示/隱藏",
            api: "columnVisibility",
            note: "column.toggleVisibility；勾選欄 enableHiding: false",
          },
          {
            name: "欄位順序",
            api: "columnOrder",
            note: "以左右移動示範；拖拉版可再接 @dnd-kit",
          },
          {
            name: "分頁",
            api: "getPaginationRowModel",
            note: "搭配跨頁選取展示 toggleAllPageRowsSelected 只影響本頁",
          },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">
          已選取{" "}
          <span className="font-medium tabular-nums">{selectedCount}</span> 筆
        </span>
        {selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setRowSelection({})}
          >
            清除選取
          </Button>
        )}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Settings2 className="size-3.5" />
                欄位設定
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>顯示與順序</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder
                .filter((id) => id !== "select")
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-4">
        <span className="text-sm text-muted-foreground">
          第 {pageIndex + 1} / {table.getPageCount()} 頁
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">上一頁</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">下一頁</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
