import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { openTabImperative } from "@/hooks/useOpenTab"
import { useLeaderStore } from "@/stores/leaderStore"
import { useTabStore } from "@/stores/tabStore"

const LEADER_KEY = "d"
const DOUBLE_PRESS_MS = 300
const LEADER_TIMEOUT_MS = 1200

// 全域鍵盤監聽：偵測雙擊 D 進入 leader 模式，再比對第二鍵執行動作
export function useLeaderKeyListener() {
  const navigate = useNavigate()
  const lastKeyTimeRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 跳到搜尋：先展開 sidebar 再 focus 搜尋框
    function focusSidebarSearch() {
      window.dodo?.controller?.sidebar?.expand()
      setTimeout(() => {
        document.getElementById("dodo-sidebar-search")?.focus()
      }, 50)
    }

    // 跳到首頁：切換 active 至 dashboard 固定頁籤並導回 /
    function goHome() {
      useTabStore.getState().openTab("dashboard")
      navigate({ to: "/" })
    }

    // 開啟 command palette
    function openCommandPalette() {
      useLeaderStore.getState().openCommandPalette()
    }

    // 複製目前 active 頁籤的 key 開新頁籤
    function openTabLikeActive() {
      const { activeId, tabs } = useTabStore.getState()
      const active = tabs.find((t) => t.id === activeId)
      if (active) {
        openTabImperative(active.key, navigate)
      }
    }

    // 關閉目前 active 頁籤（固定頁籤不可關）
    function closeActiveTab() {
      const { activeId, closeTab } = useTabStore.getState()
      closeTab(activeId)
    }

    const actions: Record<string, () => void> = {
      s: focusSidebarSearch,
      h: goHome,
      p: openCommandPalette,
      n: openTabLikeActive,
      w: closeActiveTab,
      "]": () => useTabStore.getState().cycleTab("next"),
      "[": () => useTabStore.getState().cycleTab("prev"),
    }

    function handler(e: KeyboardEvent) {
      // 長按重複事件忽略，避免誤判成雙擊
      if (e.repeat) return

      // 輸入框內不觸發任何快捷鍵
      const el = document.activeElement
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
        return

      const { phase, cancel, enterLeaderMode } = useLeaderStore.getState()

      if (phase === "waitingSecondKey") {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        const action = actions[e.key]
        if (action) {
          e.preventDefault()
          cancel()
          action()
        } else {
          cancel()
        }
        return
      }

      // 偵測雙擊 D（不含修飾鍵，避免與 Ctrl/Cmd 快捷鍵衝突）
      if (
        e.key.toLowerCase() === LEADER_KEY &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const now = Date.now()
        if (now - lastKeyTimeRef.current <= DOUBLE_PRESS_MS) {
          lastKeyTimeRef.current = 0
          enterLeaderMode()
          timeoutRef.current = setTimeout(() => {
            useLeaderStore.getState().cancel()
            timeoutRef.current = null
          }, LEADER_TIMEOUT_MS)
        } else {
          lastKeyTimeRef.current = now
        }
      }
    }

    document.addEventListener("keydown", handler)
    return () => {
      document.removeEventListener("keydown", handler)
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [navigate])
}
