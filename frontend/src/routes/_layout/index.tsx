import { createFileRoute } from "@tanstack/react-router"

import { TabHeaderController } from "@/components/TabHeader/TabHeaderController"

// 首頁＝頁籤工作區：渲染固定 Dashboard 頁籤與其餘狀態驅動頁籤（內容脫離 Router）
export const Route = createFileRoute("/_layout/")({
  component: TabHeaderController,
  head: () => ({
    meta: [
      {
        title: "Dashboard - DoDo Admin",
      },
    ],
  }),
})
