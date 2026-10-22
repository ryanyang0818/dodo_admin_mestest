import { useSuspenseQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { Suspense, useMemo } from "react"

import { PageSystemMenusService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { PageHeader } from "@/components/Common/PageHeader"
import AddMenu from "@/components/Menus/AddMenu"
import { getMenuColumns } from "@/components/Menus/columns"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"

// 取得 Menu 管理列表查詢設定
function getMenusQueryOptions() {
  return {
    queryFn: () => PageSystemMenusService.readMenus({ skip: 0, limit: 100 }),
    queryKey: ["menus"],
  }
}

// 顯示 Menu 管理內容
function MenusContent() {
  const { data: menus } = useSuspenseQuery(getMenusQueryOptions())
  const columns = useMemo(() => getMenuColumns(menus.data), [menus.data])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        tabKey="system.menus"
        title="Menus"
        description="Manage navigation menus and visibility settings"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a href="/docs/all-icons.html" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2" />
            查看可用圖示
          </a>
        </Button>
        <AddMenu menus={menus.data} />
      </div>

      <DataTable columns={columns} data={menus.data} />
    </div>
  )
}

// 顯示 Menu 管理 tab 內容
export function MenusView() {
  return (
    <Suspense fallback={<PendingItems />}>
      <MenusContent />
    </Suspense>
  )
}
