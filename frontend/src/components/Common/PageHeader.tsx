import { ChevronRight, CircleHelp } from "lucide-react"
import { useState } from "react"

import type { TabKey } from "@/components/TabHeader/types"
import { Button } from "@/components/ui/button"
import { useVisibleMenuTree } from "@/hooks/useVisibleMenuTree"
import { findMenuLabelPath, findMenuNodeByKey } from "@/lib/menuTree"

type PageHeaderProps = {
  tabKey: TabKey
  title: string
  description?: string
}

// 統一頁面標題列：只顯示定位資訊，副標題用切換列展開，功能操作放回內容區。
export function PageHeader({
  tabKey,
  title,
  description,
}: PageHeaderProps) {
  const { data: menuTree = [] } = useVisibleMenuTree()
  const menuNode = findMenuNodeByKey(menuTree, tabKey)
  const labelPath = findMenuLabelPath(menuTree, tabKey)
  const breadcrumbLabels = labelPath?.slice(0, -1) ?? []
  const displayTitle = labelPath?.at(-1) ?? title
  const displayPath = menuNode?.path ?? "-"
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)

  return (
    <div className="-mx-6 -mt-4 border-b bg-sky-50/70 px-4 md:-mx-8 md:px-5">
      <div className="flex h-10 min-w-0 items-center gap-1.5 whitespace-nowrap">
        {breadcrumbLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <ChevronRight className="size-3.5 text-muted-foreground/70" />
          </div>
        ))}
        <h1 className="truncate text-base font-medium leading-tight tracking-tight">
          {displayTitle}
        </h1>
        {description && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 text-muted-foreground hover:text-foreground"
            aria-expanded={isDescriptionOpen}
            aria-label={isDescriptionOpen ? "收合頁面說明" : "展開頁面說明"}
            onClick={() => setIsDescriptionOpen((open) => !open)}
          >
            {isDescriptionOpen ? (
              <span className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-foreground" />
            ) : (
              <CircleHelp className="size-3.5" />
            )}
          </Button>
        )}
      </div>
      {description && isDescriptionOpen && (
        <div className="flex min-h-6 items-center gap-2 pb-2 text-xs leading-tight text-muted-foreground">
          <p>
            <span>{description}</span>
            <span> | key: {tabKey}</span>
            <span> | path: {displayPath}</span>
          </p>
        </div>
      )}
    </div>
  )
}
