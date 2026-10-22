import { createFileRoute, useRouterState } from "@tanstack/react-router"

import NotFound from "@/components/Common/NotFound"
import { getTabDefinition } from "@/components/TabHeader/tabRegistry"
import { useVisibleMenuTree } from "@/hooks/useVisibleMenuTree"
import { findMenuNodeByPath } from "@/lib/menuTree"

export const Route = createFileRoute("/_layout/$")({
  component: StandaloneRoutePage,
})

// 共用 Router 薄殼：以完整 pathname 查可見 menu，再載入對應 tab component。
function StandaloneRoutePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { data: menuTree = [], isError, isLoading } = useVisibleMenuTree()
  const menuNode = findMenuNodeByPath(menuTree, pathname)
  const definition = menuNode ? getTabDefinition(menuNode.key) : undefined

  if (isLoading) {
    return null
  }

  if (isError || !menuNode || !definition) {
    return <NotFound />
  }

  const StandaloneComponent = definition.component

  return <StandaloneComponent />
}
