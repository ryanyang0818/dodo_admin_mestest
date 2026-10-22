import { createFileRoute } from "@tanstack/react-router"
import { Box, House, PanelsTopLeft } from "lucide-react"

import { ClosableTabs, type TabConfig } from "@/components/Common/ClosableTabs"

const DEMO_TABS: TabConfig[] = [
  {
    value: "tab-1",
    label: "Overview",
    icon: House,
    closable: false,
    content: (
      <p className="p-4 text-sm text-muted-foreground">Overview 內容區塊</p>
    ),
  },
  {
    value: "tab-2",
    label: "Projects",
    icon: PanelsTopLeft,
    closable: true,
    content: (
      <p className="p-4 text-sm text-muted-foreground">Projects 內容區塊</p>
    ),
  },
  {
    value: "tab-3",
    label: "Packages",
    icon: Box,
    closable: true,
    content: (
      <p className="p-4 text-sm text-muted-foreground">Packages 內容區塊</p>
    ),
  },
]

export const Route = createFileRoute("/_layout/test-tab")({
  component: TestTab,
  head: () => ({
    meta: [{ title: "TestTab - DoDo Admin" }],
  }),
})

// TestTab 示範頁面，展示 ClosableTabs 元件
function TestTab() {
  return <ClosableTabs initialTabs={DEMO_TABS} />
}
