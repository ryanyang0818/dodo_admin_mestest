import { createFileRoute } from "@tanstack/react-router"
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  type GroupingState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { FeatureIntro } from "@/components/TableDemos/FeatureIntro"
import {
  money,
  ORDER_TREE,
  ORDERS,
  type OrderRow,
  type OrderTreeRow,
} from "@/components/TableDemos/mockData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/table-demos/expanding-grouping")(
  {
    component: ExpandingGroupingDemo,
    head: () => ({
      meta: [{ title: "Expanding & Grouping - DoDo Admin" }],
    }),
  },
)

// ---------- Section A：子列展開（訂單 → 明細品項） ----------

const TREE_COLUMNS: ColumnDef<OrderTreeRow>[] = [
  {
    accessorKey: "name",
    header: "訂單 / 品項",
    cell: ({ row }) => (
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: `${row.depth * 1.5}rem` }}
      >
        {row.getCanExpand() ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            <span className="sr-only">展開</span>
          </Button>
        ) : (
          <span className="inline-block size-6" />
        )}
        <span className={cn(row.depth === 0 && "font-medium")}>
          {row.original.name}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "kind",
    header: "類型",
    cell: ({ row }) => (
      <Badge variant={row.depth === 0 ? "default" : "secondary"}>
        {row.original.kind}
      </Badge>
    ),
  },
  {
    accessorKey: "qty",
    header: "數量",
    cell: ({ row }) => <span className="tabular-nums">{row.original.qty}</span>,
  },
  {
    accessorKey: "amount",
    header: "金額 NT$",
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
  },
]

// 子列展開示範：getSubRows 取樹狀資料
function ExpandingSection() {
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data: ORDER_TREE,
    columns: TREE_COLUMNS,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">子列展開（subRows）</h2>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => table.toggleAllRowsExpanded()}
        >
          {table.getIsAllRowsExpanded() ? "全部收合" : "全部展開"}
        </Button>
      </div>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(row.depth > 0 && "bg-muted/30")}
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
    </section>
  )
}

// ---------- Section B：分組與聚合 ----------

const GROUP_COLUMNS: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "region",
    header: "區域",
  },
  {
    accessorKey: "category",
    header: "分類",
  },
  {
    accessorKey: "orderNo",
    header: "訂單編號",
    aggregationFn: "count",
    aggregatedCell: ({ getValue }) => (
      <span className="text-muted-foreground">共 {String(getValue())} 筆</span>
    ),
  },
  {
    accessorKey: "qty",
    header: "數量",
    aggregationFn: "sum",
    cell: ({ row }) => <span className="tabular-nums">{row.original.qty}</span>,
    aggregatedCell: ({ getValue }) => (
      <span className="font-medium tabular-nums">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "金額 NT$",
    aggregationFn: "sum",
    cell: ({ row }) => (
      <span className="tabular-nums">{money(row.original.amount)}</span>
    ),
    aggregatedCell: ({ getValue }) => (
      <span className="font-medium tabular-nums">
        {money(getValue<number>())}
      </span>
    ),
  },
]

// 分組聚合示範：依區域或分類分組，數量與金額做 sum
function GroupingSection() {
  const [grouping, setGrouping] = useState<GroupingState>(["region"])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data: ORDERS,
    columns: GROUP_COLUMNS,
    state: { grouping, expanded },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">分組與聚合（grouping）</h2>
        <Select
          value={grouping[0]}
          onValueChange={(v) => {
            setGrouping([v])
            setExpanded({})
          }}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="region">依區域分組</SelectItem>
            <SelectItem value="category">依分類分組</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(row.getIsGrouped() && "bg-muted/40")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {cell.getIsGrouped() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-7 gap-1 font-medium"
                        onClick={row.getToggleExpandedHandler()}
                      >
                        {row.getIsExpanded() ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        {String(cell.getValue())}
                        <span className="text-muted-foreground">
                          ({row.subRows.length})
                        </span>
                      </Button>
                    ) : cell.getIsAggregated() ? (
                      flexRender(
                        cell.column.columnDef.aggregatedCell,
                        cell.getContext(),
                      )
                    ) : cell.getIsPlaceholder() ? null : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// 子列展開與分組聚合示範頁
function ExpandingGroupingDemo() {
  return (
    <div>
      <FeatureIntro
        title="Expanding & Grouping"
        description="上半部示範訂單展開明細品項（樹狀資料）；下半部示範依欄位分組，數量與金額自動加總。"
        features={[
          {
            name: "子列展開",
            api: "getExpandedRowModel",
            note: "getSubRows 讀取樹狀資料，row.depth 做縮排",
          },
          {
            name: "分組",
            api: "getGroupedRowModel",
            note: "grouping state 決定分組欄位，群組列可展開",
          },
          {
            name: "聚合",
            api: "aggregationFn",
            note: "sum / count，aggregatedCell 自訂群組列的呈現",
          },
        ]}
      />
      <div className="flex flex-col gap-8">
        <ExpandingSection />
        <GroupingSection />
      </div>
    </div>
  )
}
