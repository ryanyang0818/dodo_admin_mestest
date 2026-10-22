import { ChevronRight, ExternalLink } from "lucide-react"
import { useMemo, useState } from "react"

import type { MenuTreeNodePublic } from "@/client"
import { hasTabDefinition } from "@/components/TabHeader/tabRegistry"
import type { TabKey } from "@/components/TabHeader/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  useSidebar,
} from "@/components/ui/sidebar"
import { useOpenTab } from "@/hooks/useOpenTab"
import { getMenuIcon } from "@/lib/getMenuIcon"
import { cn } from "@/lib/utils"
import { useTabStore } from "@/stores/tabStore"

interface TreeMenuProps {
  data: MenuTreeNodePublic[]
  isError?: boolean
  isLoading?: boolean
  search: string
}

type MenuNodeItemProps = {
  activeTabKey?: TabKey
  forceOpen: boolean
  level: number
  node: MenuTreeNodePublic
  openNodeIds: Set<string>
  onSelectTab: (tabKey: TabKey) => void
  onToggleNode: (nodeId: string) => void
}

// 取得節點子層，統一處理後端可能省略 children 的狀況
function getMenuChildren(node: MenuTreeNodePublic): MenuTreeNodePublic[] {
  return node.children ?? []
}

// 依 sortOrder 與 label 排序，避免前端渲染順序受資料輸入順序影響
function sortMenuTree(nodes: MenuTreeNodePublic[]): MenuTreeNodePublic[] {
  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((node) => ({
      ...node,
      children: sortMenuTree(getMenuChildren(node)),
    }))
}

// 判斷節點是否符合搜尋條件
function matchMenuNode(node: MenuTreeNodePublic, query: string): boolean {
  return [node.label, node.key, node.path ?? ""].some((value) =>
    value.toLowerCase().includes(query),
  )
}

// 過濾選單樹，保留符合條件的父子路徑
function filterSortedMenuTree(
  nodes: MenuTreeNodePublic[],
  query: string,
): MenuTreeNodePublic[] {
  if (!query) return nodes

  return nodes
    .map((node): MenuTreeNodePublic | null => {
      const matchedChildren = filterSortedMenuTree(getMenuChildren(node), query)

      if (matchMenuNode(node, query) || matchedChildren.length > 0) {
        return {
          ...node,
          children: matchedChildren,
        }
      }

      return null
    })
    .filter((node): node is MenuTreeNodePublic => node !== null)
}

// 收集指定選單樹內所有可展開節點 id
function collectExpandableNodeIds(nodes: MenuTreeNodePublic[]): string[] {
  return nodes.flatMap((node) => {
    const children = getMenuChildren(node)
    const childIds = collectExpandableNodeIds(children)

    if (children.length === 0) return childIds

    return [node.id, ...childIds]
  })
}

// 在瀏覽器分頁開啟 standalone route
function openBrowserTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer")
}

// 顯示選單載入中的骨架畫面
function TreeMenuLoading() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {Array.from({ length: 8 }).map((_, index) => (
            <SidebarMenuSkeleton key={index} showIcon />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// 顯示選單空狀態或 API 失敗時的安全畫面
function TreeMenuEmpty({ message }: { message: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <p className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {message}
        </p>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// 渲染單一後端選單節點，支援任意層級遞迴
function MenuNodeItem({
  activeTabKey,
  forceOpen,
  level,
  node,
  openNodeIds,
  onSelectTab,
  onToggleNode,
}: MenuNodeItemProps) {
  const children = getMenuChildren(node)
  const hasChildren = children.length > 0
  const open = forceOpen || openNodeIds.has(node.id)
  const isClickable =
    !hasChildren && Boolean(node.path) && hasTabDefinition(node.key)
  const isDisabled = !hasChildren && !isClickable
  const Icon = getMenuIcon(node.icon)
  const isActive = node.key === activeTabKey
  const canOpenBrowserTab = isClickable && Boolean(node.path)

  const menuButton = (
    <SidebarMenuButton
      aria-expanded={hasChildren ? open : undefined}
      data-state={hasChildren && open ? "open" : "closed"}
      disabled={isDisabled}
      isActive={isActive}
      onClick={() => {
        if (hasChildren) {
          onToggleNode(node.id)
          return
        }

        if (isClickable) {
          onSelectTab(node.key)
        }
      }}
      size={level === 0 ? "default" : "sm"}
      tooltip={level === 0 ? node.label : undefined}
      className={cn(
        "relative gap-1.5 transition-colors",
        level === 0 &&
          "border border-transparent bg-sidebar-accent/20 font-medium hover:border-sidebar-border/70 hover:bg-sidebar-accent/55 data-[state=open]:border-sidebar-border/70 data-[state=open]:bg-sidebar-accent/70",
        level > 0 &&
          "h-7 pl-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
        isActive &&
          "bg-sky-50 text-sky-950 hover:bg-sky-50 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-sky-600",
        isDisabled && "cursor-default opacity-70",
      )}
    >
      {hasChildren && (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            level === 0 && "group-data-[collapsible=icon]:hidden",
            open && "rotate-90",
          )}
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          level > 0 && "text-sidebar-foreground/60",
          isActive && "text-sky-700",
        )}
      />
      <span className={cn("flex-1 truncate", level === 0 && "font-medium")}>
        {node.label}
      </span>
    </SidebarMenuButton>
  )

  const menuContent = canOpenBrowserTab ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{menuButton}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => openBrowserTab(node.path ?? "/")}>
          <ExternalLink />
          <span>在瀏覽器分頁開啟</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ) : (
    menuButton
  )

  return (
    <SidebarMenuItem>
      {menuContent}
      {hasChildren && open && (
        <SidebarMenuSub>
          <SidebarMenu>
            {children.map((child) => (
              <MenuNodeItem
                activeTabKey={activeTabKey}
                forceOpen={forceOpen}
                key={child.id}
                level={level + 1}
                node={child}
                openNodeIds={openNodeIds}
                onSelectTab={onSelectTab}
                onToggleNode={onToggleNode}
              />
            ))}
          </SidebarMenu>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

// 樹狀選單根元件，資料來源為後端 MenuTreeNodePublic
export function TreeMenu({
  data,
  isError = false,
  isLoading = false,
  search,
}: TreeMenuProps) {
  const openTab = useOpenTab()
  const { isMobile, setOpenMobile } = useSidebar()
  const tabs = useTabStore((state) => state.tabs)
  const activeId = useTabStore((state) => state.activeId)
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set())
  const activeTabKey = tabs.find((tab) => tab.id === activeId)?.key
  const normalizedSearch = search.trim().toLowerCase()
  const isSearching = normalizedSearch.length > 0
  const filtered = useMemo(() => {
    const sorted = sortMenuTree(data)
    return filterSortedMenuTree(sorted, normalizedSearch)
  }, [data, normalizedSearch])
  const workspaceNodes = filtered.filter(
    (node) => getMenuChildren(node).length === 0,
  )
  const moduleNodes = filtered.filter(
    (node) => getMenuChildren(node).length > 0,
  )
  const expandableModuleNodeIds = useMemo(
    () => collectExpandableNodeIds(moduleNodes),
    [moduleNodes],
  )
  const hasOpenModules = expandableModuleNodeIds.some((id) =>
    openNodeIds.has(id),
  )

  if (isLoading) {
    return <TreeMenuLoading />
  }

  if (isError) {
    return <TreeMenuEmpty message="選單暫時無法載入" />
  }

  if (filtered.length === 0) {
    return <TreeMenuEmpty message="沒有可用選單" />
  }

  // 選取頁籤並在手機版收起 sidebar
  const handleSelectTab = (tabKey: TabKey) => {
    openTab(tabKey)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // 切換單一可展開選單節點
  const handleToggleNode = (nodeId: string) => {
    setOpenNodeIds((current) => {
      const next = new Set(current)

      if (next.has(nodeId)) {
        next.delete(nodeId)
        return next
      }

      next.add(nodeId)
      return next
    })
  }

  // 依目前 Modules 狀態全部展開或全部收合
  const handleToggleAllModules = () => {
    if (isSearching) return

    setOpenNodeIds((current) => {
      const next = new Set(current)

      if (hasOpenModules) {
        expandableModuleNodeIds.forEach((id) => {
          next.delete(id)
        })
        return next
      }

      expandableModuleNodeIds.forEach((id) => {
        next.add(id)
      })
      return next
    })
  }

  return (
    <>
      {workspaceNodes.length > 0 && (
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {workspaceNodes.map((node) => (
                <MenuNodeItem
                  activeTabKey={activeTabKey}
                  forceOpen={isSearching}
                  key={node.id}
                  level={0}
                  node={node}
                  openNodeIds={openNodeIds}
                  onSelectTab={handleSelectTab}
                  onToggleNode={handleToggleNode}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {moduleNodes.length > 0 && (
        <SidebarGroup className="pt-1">
          {workspaceNodes.length > 0 && (
            <div className="mx-2 mb-1 h-px bg-sidebar-border/70 group-data-[collapsible=icon]:hidden" />
          )}
          <SidebarGroupLabel className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            <button
              type="button"
              aria-label={
                hasOpenModules
                  ? "收合所有 Modules 選單"
                  : "展開所有 Modules 選單"
              }
              title={
                isSearching
                  ? "搜尋時會自動展開符合項目"
                  : hasOpenModules
                    ? "收合所有 Modules 選單"
                    : "展開所有 Modules 選單"
              }
              disabled={isSearching || expandableModuleNodeIds.length === 0}
              onClick={handleToggleAllModules}
              className="flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform duration-150",
                  hasOpenModules && "rotate-90",
                )}
              />
            </button>
            <span>Modules</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {moduleNodes.map((node) => (
                <MenuNodeItem
                  activeTabKey={activeTabKey}
                  forceOpen={isSearching}
                  key={node.id}
                  level={0}
                  node={node}
                  openNodeIds={openNodeIds}
                  onSelectTab={handleSelectTab}
                  onToggleNode={handleToggleNode}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  )
}
