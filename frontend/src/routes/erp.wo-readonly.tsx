import { createFileRoute } from "@tanstack/react-router"
import { ErpWoReadonly } from "@/components/ErpWoReadonly/ErpWoReadonly"

export const Route = createFileRoute("/erp/wo-readonly")({
  component: WoReadonlyPage,
  head: () => ({ meta: [{ title: "工單查詢" }] }),
})

// 公開入口與登入頁、Workspace 共用相同報表元件。
function WoReadonlyPage() {
  return (
    <main className="min-h-screen p-6 pt-8 md:p-8">
      <ErpWoReadonly />
    </main>
  )
}
