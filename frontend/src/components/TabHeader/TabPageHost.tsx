import { getTabDefinition } from "@/components/TabHeader/tabRegistry"
import { useTabStore } from "@/stores/tabStore"

// 只渲染目前 active 頁籤的內容；切走即卸載、內部狀態不保留（無 keep-alive）
export function TabPageHost() {
  const tabs = useTabStore((s) => s.tabs)
  const activeId = useTabStore((s) => s.activeId)

  const activeTab = tabs.find((t) => t.id === activeId)
  const definition = activeTab ? getTabDefinition(activeTab.key) : undefined

  // 防呆：activeId 對不到頁籤、或 key 不在 registry 時不渲染內容
  if (!activeTab || !definition) {
    return null
  }

  const ActiveComponent = definition.component

  // key 綁定 activeTab.id：切換 active 必定卸載舊元件、掛載新元件（不沿用既有實例狀態）
  return <ActiveComponent key={activeTab.id} />
}
