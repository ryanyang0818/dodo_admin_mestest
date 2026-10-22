import { useState } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { useVisibleMenuTree } from "@/hooks/useVisibleMenuTree"
import { SidebarSearch } from "./SidebarSearch"
import { TreeMenu } from "./TreeMenu"
import { User } from "./User"

// 組合登入後頁面的後端選單、外觀設定與使用者資訊
export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState("")
  const {
    data: menuTree = [],
    isError: isMenuError,
    isLoading: isMenuLoading,
  } = useVisibleMenuTree()

  return (
    <Sidebar
      collapsible="icon"
      data-dodo-section="sidebar"
      className="top-[var(--user-header-layout-height)] h-[calc(100svh-var(--user-header-layout-height)-var(--app-footer-layout-height))] md:top-[calc(var(--app-menu-layout-height)+var(--user-header-layout-height))] md:h-[calc(100svh-var(--app-menu-layout-height)-var(--user-header-layout-height)-var(--app-footer-layout-height))]"
    >
      <SidebarContent className="gap-1 bg-sidebar">
        <SidebarSearch value={search} onChange={setSearch} />
        <TreeMenu
          data={menuTree}
          isError={isMenuError}
          isLoading={isMenuLoading}
          search={search}
        />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 bg-sidebar/95 px-2 py-2">
        <User user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default AppSidebar
