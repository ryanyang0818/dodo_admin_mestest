import { useQuery } from "@tanstack/react-query"

import { MenusService, type MenuTreeNodePublic } from "@/client"
import { isLoggedIn } from "@/hooks/useAuth"

export const visibleMenuTreeQueryKey = ["sidebarMenuTree"] as const

// 取得目前使用者可見的 menu tree，供 Sidebar、TabHeader 與 Router shell 共用。
export function useVisibleMenuTree() {
  return useQuery<MenuTreeNodePublic[], Error>({
    queryKey: visibleMenuTreeQueryKey,
    queryFn: () => MenusService.readMyMenuTree(),
    enabled: isLoggedIn(),
  })
}
