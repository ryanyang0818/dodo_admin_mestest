import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { toast } from "sonner"

import type { TabKey } from "@/components/TabHeader/types"
import { MAX_TABS, useTabStore } from "@/stores/tabStore"

type NavigateFn = ReturnType<typeof useNavigate>

// 非 hook 版本：供事件 handler 等非 React 環境呼叫，navigate 由呼叫端傳入
export function openTabImperative(key: TabKey, navigate: NavigateFn) {
  const opened = useTabStore.getState().openTab(key)
  if (!opened) {
    toast.error(`已達上限（${MAX_TABS}），請先關閉再開`)
  }
  navigate({ to: "/" })
}

// 包 store.openTab：成功或達上限都切回頁籤工作區（/），達上限時補 toast
export const useOpenTab = () => {
  const openTab = useTabStore((s) => s.openTab)
  const navigate = useNavigate()

  // 開啟指定 key 的頁籤；達上限時不新增頁籤，但仍導回工作區 /
  return useCallback(
    (key: TabKey) => {
      const opened = openTab(key)
      if (!opened) {
        toast.error(`已達上限（${MAX_TABS}），請先關閉再開`)
      }
      // 若目前在路由頁（/admin 等），切回首頁工作區才看得到頁籤內容；已在 / 則為 no-op
      navigate({ to: "/" })
    },
    [openTab, navigate],
  )
}
