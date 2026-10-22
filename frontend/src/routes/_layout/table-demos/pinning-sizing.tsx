import { createFileRoute } from "@tanstack/react-router"
import {
  type Column,
  type ColumnDef,
  type ColumnPinningState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Pin, PinOff } from "lucide-react"
import type { CSSProperties } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/table-demos/pinning-sizing")({
  component: PinningSizingDemo,
  head: () => ({
    meta: [{ title: "Pinning & Sizing - DoDo Admin" }],
  }),
})

// 依欄位凍結狀態產生 sticky 定位樣式
function getPinStyles(column: Column<OrderRow>): CSSProperties {
  const pinned = column.getIsPinned()
  return {
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: pinned ? "sticky" : "relative",
    width: `${column.getSize()}px`,
    zIndex: pinned ? 1 : 0,
  }
}

// 表頭：欄名 + 凍結選單 + 欄寬拖拉把手
function PinnableHeader({
  label,
  column,
}: {
  label: string
  column: Column<OrderRow>
}) {
  const pinned = column.getIsPinned()
  return (
    <div className="flex items-center gap-1">
      <span className="truncate">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-6 shrink-0",
              pinned ? "text-primary" : "text-muted-foreground/60",
            )}
          >
            <Pin className="size-3.5" />
            <span className="sr-only">凍結 {label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.pin("left")}>
            <Pin className="size-3.5" />
            凍結到左側
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.pin("right")}>
            <Pin className="size-3.5 rotate-90" />
            凍結到右側
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!pinned}
            onClick={() => column.pin(false)}
          >
            <PinOff className="size-3.5" />
            取消凍結
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const COLUMNS: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "orderNo",
    size: 150,
    header: ({ column }) => <PinnableHeader label="訂單編號" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.orderNo}</span>
    ),
  },
  {
    accessorKey: "customer",
    size: 140,
    header: ({ column }) => <PinnableHeader label="客戶" column={column} />,
  },
  {
    accessorKey: "region",
    size: 110,
    header: ({ column }) => <PinnableHeader label="區域" column={column} />,
  },
  {
    accessorKey: "category",
    size: 110,
    header: ({ column }) => <PinnableHeader label="分類" column={column} />,
  },
  {
    accessorKey: "status",
    size: 120,
    header: ({ column }) => <PinnableHeader label="狀態" column={column} />,
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
    accessorKey: "qty",
    size: 90,
    header: ({ column }) => <PinnableHeader label="數量" column={column} />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.qty}</span>,
  },
  {
    accessorKey: "amount",
    size: 130,
    header: ({ column }) => <PinnableHeader label="金額 NT$" column={column} />,
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: "orderDate",
    size: 130,
    header: ({ column }) => <PinnableHeader label="訂單日期" column={column} />,
  },
]

// 資料必須是穩定 reference：寫在 render 內每次都是新陣列，
// 拖拉欄寬時會造成 table 無限重渲染、頁面凍結
const PIN_ROWS = ORDERS.slice(0, 20)

// 欄位凍結與欄寬調整示範頁
function PinningSizingDemo() {
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["orderNo"],
    right: [],
  })

  const table = useReactTable({
    data: PIN_ROWS,
    columns: COLUMNS,
    state: { columnPinning },
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  })

  return (
    <div>
      <FeatureIntro
        title="Pinning & Sizing"
        description="點表頭圖釘把欄位凍結到左側或右側（水平捲動時 sticky 固定）；拖拉表頭右緣調整欄寬。預設已凍結「訂單編號」。"
        features={[
          {
            name: "欄位凍結",
            api: "columnPinning",
            note: "column.pin() + getStart()/getAfter() 算 sticky 偏移",
          },
          {
            name: "欄寬調整",
            api: "columnSizing",
            note: 'enableColumnResizing + columnResizeMode: "onChange"',
          },
        ]}
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table style={{ width: table.getTotalSize(), minWidth: "100%" }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={getPinStyles(header.column)}
                    className={cn(
                      "group/head bg-background",
                      header.column.getIsPinned() &&
                        "shadow-[inset_-1px_0_0_0_hsl(var(--border))]",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    <button
                      type="button"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                        "opacity-0 group-hover/head:opacity-100 bg-border",
                        header.column.getIsResizing() &&
                          "bg-primary opacity-100",
                      )}
                      aria-label="調整欄寬"
                    />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={getPinStyles(cell.column)}
                    className={cn(
                      "bg-background",
                      cell.column.getIsPinned() &&
                        "shadow-[inset_-1px_0_0_0_hsl(var(--border))]",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
