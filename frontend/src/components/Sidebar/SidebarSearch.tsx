import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar"

interface SidebarSearchProps {
  value: string
  onChange: (value: string) => void
}

// 側邊欄搜尋框，sidebar 收合時自動隱藏
export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 pt-2 pb-1.5">
      <SidebarGroupContent>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="dodo-sidebar-search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="搜尋功能..."
            className="h-8 rounded-lg border-sidebar-border/80 bg-background/90 pl-8 pr-7 text-xs shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="清除搜尋"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
