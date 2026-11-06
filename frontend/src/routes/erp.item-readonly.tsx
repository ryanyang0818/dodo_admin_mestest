import { createFileRoute } from "@tanstack/react-router"
import { ErpItemReadonly } from "@/components/ErpItemReadonly/ErpItemReadonly"

export const Route = createFileRoute("/erp/item-readonly")({
  component: ItemReadonlyPage,
  head: () => ({ meta: [{ title: "料號基本資料" }] }),
})

// 公開入口不使用登入 layout，與 Workspace 共用報表元件。
function ItemReadonlyPage() {
  return (
    <main className="min-h-screen p-6 pt-8 md:p-8">
      <ErpItemReadonly />
    </main>
  )
}
