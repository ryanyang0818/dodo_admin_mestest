import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpDown, Columns3, ListTree, PencilLine, Pin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_layout/table-demos/")({
  component: TableDemosIndex,
  head: () => ({
    meta: [{ title: "Table Demos - DoDo Admin" }],
  }),
})

const DEMOS = [
  {
    to: "/table-demos/sorting-filtering",
    icon: ArrowUpDown,
    title: "Sorting & Filtering",
    description: "欄位排序（含 Shift 多欄）、欄位過濾與全域搜尋",
    features: ["getSortedRowModel", "getFilteredRowModel", "globalFilter"],
  },
  {
    to: "/table-demos/selection-visibility",
    icon: Columns3,
    title: "Selection & Visibility",
    description: "列勾選（跨頁保留）、欄位顯示/隱藏與欄位順序調整",
    features: ["rowSelection", "columnVisibility", "columnOrder"],
  },
  {
    to: "/table-demos/pinning-sizing",
    icon: Pin,
    title: "Pinning & Sizing",
    description: "欄位左右凍結（sticky）與欄寬拖拉調整",
    features: ["columnPinning", "columnSizing"],
  },
  {
    to: "/table-demos/expanding-grouping",
    icon: ListTree,
    title: "Expanding & Grouping",
    description: "子列展開（訂單 → 明細）、分組與聚合統計",
    features: ["getExpandedRowModel", "getGroupedRowModel", "aggregationFn"],
  },
  {
    to: "/table-demos/editable-pagination",
    icon: PencilLine,
    title: "Editable & Pagination",
    description: "可編輯儲存格（meta.updateData）與模擬 server-side 手動分頁",
    features: ["meta.updateData", "manualPagination"],
  },
] as const

// Table Demos 索引頁：卡片列出所有 @tanstack/react-table 示範頁
function TableDemosIndex() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Table Demos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          @tanstack/react-table v8 能力展示。每頁開頭列出該頁使用的
          features，資料皆為前端 mock。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEMOS.map((demo) => (
          <Link key={demo.to} to={demo.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <demo.icon className="size-4 text-muted-foreground" />
                  {demo.title}
                </CardTitle>
                <CardDescription>{demo.description}</CardDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {demo.features.map((f) => (
                    <Badge
                      key={f}
                      variant="secondary"
                      className="font-mono text-xs font-normal"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
