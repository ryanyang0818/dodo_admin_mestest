import type { LucideIcon } from "lucide-react"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type TabConfig = {
  value: string
  label: string
  icon: LucideIcon
  closable: boolean
  content: ReactNode
}

type ClosableTabsProps = {
  initialTabs: TabConfig[]
  defaultValue?: string
}

// 可關閉頁籤元件，active tab 顯示 primary 顏色，其餘灰色
export function ClosableTabs({ initialTabs, defaultValue }: ClosableTabsProps) {
  const [tabs, setTabs] = useState<TabConfig[]>(initialTabs)
  const [activeTab, setActiveTab] = useState(
    defaultValue ?? initialTabs[0].value,
  )

  // 關閉指定頁籤，active tab 被關閉時自動切到前一個或第一個
  const closeTab = (value: string) => {
    const idx = tabs.findIndex((t) => t.value === value)
    if (idx === -1) return
    const next = tabs.filter((t) => t.value !== value)
    setTabs(next)
    if (activeTab === value) {
      setActiveTab(next[idx - 1]?.value ?? next[0].value)
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <ScrollArea className="border-b border-border">
        <TabsList className="h-auto justify-start gap-1 bg-background px-2 pt-1.5 pb-0 rounded-b-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value
            return (
              <div
                key={tab.value}
                className={cn(
                  "relative flex items-stretch overflow-hidden rounded-t border border-border transition-colors",
                  isActive
                    ? "bg-background border-border/60 shadow-sm"
                    : "bg-muted hover:bg-muted/40",
                )}
              >
                {/* 頂部 indicator，active 時顯示 primary 色 */}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-0.5 transition-colors",
                    isActive && "bg-primary",
                  )}
                />
                <TabsTrigger
                  value={tab.value}
                  className="rounded-none border-0 pt-2.5 pb-2 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <tab.icon
                    className={cn(
                      "-ms-0.5 me-1.5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {tab.label}
                </TabsTrigger>
                {tab.closable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.value)
                    }}
                    className="flex items-center px-1 text-muted-foreground/40 hover:bg-black/10 hover:text-foreground rounded-sm"
                    aria-label={`關閉 ${tab.label}`}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            )
          })}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
