import { useSuspenseQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { ItemsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { PageHeader } from "@/components/Common/PageHeader"
import AddItem from "@/components/Items/AddItem"
import { columns } from "@/components/Items/columns"
import PendingItems from "@/components/Pending/PendingItems"

// 取得 Items 列表查詢設定
function getItemsQueryOptions() {
  return {
    queryFn: () => ItemsService.readItems({ skip: 0, limit: 100 }),
    queryKey: ["items"],
  }
}

// 顯示 Items 資料表，空資料時顯示提示
function ItemsTableContent() {
  const { data: items } = useSuspenseQuery(getItemsQueryOptions())

  if (items.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">You don't have any items yet</h3>
        <p className="text-muted-foreground">Add a new item to get started</p>
      </div>
    )
  }

  return <DataTable columns={columns} data={items.data} />
}

// 以 Suspense 包裹 Items 資料表
function ItemsTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <ItemsTableContent />
    </Suspense>
  )
}

// Items 純內容元件（狀態驅動頁籤直接 render，無 keep-alive 探針）
export function ItemsView() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        tabKey="items"
        title="Items"
        description="Create and manage your items"
      />
      <div className="flex justify-end">
        <AddItem />
      </div>

      <ItemsTable />
    </div>
  )
}
