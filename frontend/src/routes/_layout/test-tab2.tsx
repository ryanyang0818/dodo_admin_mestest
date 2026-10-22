import { createFileRoute } from "@tanstack/react-router"
import { Box, House, PanelsTopLeft, X } from "lucide-react"
import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const tabsExample = [
  {
    value: "tab-1",
    title: "Overview",
    icon: House,
    content: "Content for Tab 1",
    closable: false,
  },
  {
    value: "tab-2",
    title: "Projects",
    icon: PanelsTopLeft,
    content: "Content for Tab 2",
    closable: true,
  },
  {
    value: "tab-3",
    title: "Packages",
    icon: Box,
    content: "Content for Tab 3",
    closable: true,
  },
]

export const Route = createFileRoute("/_layout/test-tab2")({
  component: TestTab2,
  head: () => ({
    meta: [
      {
        title: "TestTab2 - DoDo Admin",
      },
    ],
  }),
})

// TestTab2 頁面（shadcn/ui Tabs 範例）
function TestTab2() {
  const [openTabs, setOpenTabs] = useState(tabsExample)
  const [activeTab, setActiveTab] = useState(tabsExample[0].value)

  // 關閉指定頁簽並切換到仍存在的鄰近頁簽
  function closeTab(value: string) {
    const closingTab = openTabs.find((tab) => tab.value === value)
    if (!closingTab?.closable) return

    const closingIndex = openTabs.findIndex((tab) => tab.value === value)
    const nextTabs = openTabs.filter((tab) => tab.value !== value)
    const fallbackTab =
      nextTabs[Math.max(0, closingIndex - 1)] ?? nextTabs[0] ?? tabsExample[0]

    setOpenTabs(nextTabs)

    if (activeTab === value) {
      setActiveTab(fallbackTab.value)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">TestTab2</h1>
        <p className="text-muted-foreground">
          A closable tabs example based on the demo tab pattern.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="mb-3 h-auto -space-x-px bg-background p-0 shadow-sm shadow-black/5 rtl:space-x-reverse">
            {openTabs.map((tab, index) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value

              return (
                <div
                  key={tab.value}
                  className={cn(
                    "relative flex shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-background text-muted-foreground transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5",
                    isActive &&
                      "bg-muted text-foreground after:bg-primary shadow-sm shadow-black/5",
                  )}
                >
                  <TabsTrigger
                    value={tab.value}
                    className={cn(
                      "relative rounded-none border-0 bg-transparent py-2 text-inherit shadow-none after:hidden hover:text-inherit data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none",
                      tab.closable ? "pe-2" : "pe-3",
                      index === 0 && "rounded-s",
                    )}
                  >
                    <Icon
                      className="-ms-0.5 me-1.5 opacity-60"
                      size={16}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {tab.title}
                  </TabsTrigger>
                  {tab.closable ? (
                    <button
                      type="button"
                      aria-label={`Close ${tab.title}`}
                      onClick={() => closeTab(tab.value)}
                      className="my-1 me-1 inline-flex size-6 items-center justify-center rounded-sm border-l border-border/80 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </TabsList>
        </div>
        {openTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <p className="p-4 pt-1 text-center text-xs text-muted-foreground">
              {tab.content}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
