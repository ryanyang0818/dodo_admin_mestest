import { useEffect } from "react"

import { useLeaderKeyListener } from "@/hooks/useLeaderKeyListener"
import { useLeaderStore } from "@/stores/leaderStore"
import { CommandPalette } from "./CommandPalette"
import { LeaderHintOverlay } from "./LeaderHintOverlay"

declare global {
  interface Window {
    leaderControls?: {
      getState: () => { phase: string }
    }
  }
}

// 掛載快捷鍵監聽器、提示浮層與 command palette；暴露 window.leaderControls 供測試讀取
export function KeyboardShortcutsProvider() {
  useLeaderKeyListener()

  useEffect(() => {
    window.leaderControls = {
      getState: () => ({ phase: useLeaderStore.getState().phase }),
    }
    return () => {
      delete window.leaderControls
    }
  }, [])

  return (
    <>
      <LeaderHintOverlay />
      <CommandPalette />
    </>
  )
}
