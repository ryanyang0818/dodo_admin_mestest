import { createFileRoute } from "@tanstack/react-router"
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react"
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

export const Route = createFileRoute("/_layout/table-demos/sorting-filtering")({
  component: SortingFilteringDemo,
  head: () => ({
    meta: [{ title: "Sorting & Filtering - DoDo Admin" }],
  }),
})

// 可排序的表頭按鈕：依排序狀態切換箭頭圖示
function SortableHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string
  sorted: false | "asc" | "desc"
  onToggle: (event: React.MouseEvent) => void
}) {
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 gap-1.5"
      onClick={onToggle}
    >
      {label}
      <Icon
        className={
          sorted
            ? "size-3.5 text-foreground"
            : "size-3.5 text-muted-foreground/50"
        }
      />
    </Button>
  )
}

const COLUMNS: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "orderNo",
    header: ({ column }) => (
      <SortableHeader
        label="訂單編號"
        sorted={column.getIsSorted()}
        onToggle={(e) => column.toggleSorting(undefined, e.shiftKey)}
      />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.orderNo}</span>
    ),
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <SortableHeader
        label="客戶"
        sorted={column.getIsSorted()}
        onToggle={(e) => column.toggleSorting(undefined, e.shiftKey)}
      />
    ),
  },
  {
    accessorKey: "region",
    header: "區域",
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
    filterFn: "equals",
  },
  {
    accessorKey: "qty",
    header: ({ column }) => (
      <SortableHeader
        label="數量"
        sorted={column.getIsSorted()}
        onToggle={(e) => column.toggleSorting(undefined, e.shiftKey)}
      />
    ),
    cell: ({ row }) => <span className="tabular-nums">{row.original.qty}</span>,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <SortableHeader
        label="金額 NT$"
        sorted={column.getIsSorted()}
        onToggle={(e) => column.toggleSorting(undefined, e.shiftKey)}
      />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: "orderDate",
    header: ({ column }) => (
      <SortableHeader
        label="訂單日期"
        sorted={column.getIsSorted()}
        onToggle={(e) => column.toggleSorting(undefined, e.shiftKey)}
      />
    ),
  },
]

// 排序與過濾示範頁：多欄排序、欄位過濾、全域搜尋
function SortingFilteringDemo() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data: ORDERS,
    columns: COLUMNS,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string) ?? "all"
  const rowCount = table.getRowModel().rows.length

  return (
    <div>
      <FeatureIntro
        title="Sorting & Filtering"
        description="點表頭排序（再點切換方向、第三次取消），按住 Shift 點擊可多欄排序；上方提供全域搜尋與狀態過濾。"
        features={[
          {
            name: "欄位排序",
            api: "getSortedRowModel",
            note: "column.toggleSorting；Shift 點擊啟用 multi-sort",
          },
          {
            name: "欄位過濾",
            api: "getFilteredRowModel",
            note: '狀態欄用 filterFn: "equals" 做精確比對',
          },
          {
            name: "全域搜尋",
            api: "globalFilter",
            note: "預設 includesString，比對所有欄位",
          },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="全域搜尋…"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            table
              .getColumn("status")
              ?.setFilterValue(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(globalFilter || columnFilters.length > 0 || sorting.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1"
            onClick={() => {
              setGlobalFilter("")
              setColumnFilters([])
              setSorting([])
            }}
          >
            <X className="size-3.5" />
            清除條件
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {rowCount} / {ORDERS.length} 筆
        </span>
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
            {rowCount ? (
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
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  沒有符合條件的資料
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
