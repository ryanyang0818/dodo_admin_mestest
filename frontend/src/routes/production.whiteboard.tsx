import { createFileRoute } from "@tanstack/react-router"
import { ProductionWhiteboard } from "@/components/ProductionWhiteboard/ProductionWhiteboard"

export const Route = createFileRoute("/production/whiteboard")({
  component: ProductionWhiteboardPage,
  head: () => ({ meta: [{ title: "生產白板" }] }),
})

function ProductionWhiteboardPage() {
  return (
    <main className="min-h-screen p-6 pt-8 md:p-8">
      <ProductionWhiteboard />
    </main>
  )
}
