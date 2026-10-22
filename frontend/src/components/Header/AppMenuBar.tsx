import { useCallback, useEffect, useRef, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useHeaderVisibility } from "./header-visibility"

const revealDelayMs = 300
const discoveryHintStorageKey = "dodo-app-menu-discovery-hint-dismissed"

type AppMenuEntry =
  | {
      type: "item"
      label: string
      shortcut?: string
    }
  | {
      type: "separator"
    }
  | {
      type: "sub"
      label: string
      items: AppMenuEntry[]
    }

type AppMenuGroup = {
  label: string
  items: AppMenuEntry[]
}

const menuGroups: AppMenuGroup[] = [
  {
    label: "檔案",
    items: [
      { type: "item", label: "新增", shortcut: "Ctrl+N" },
      { type: "item", label: "開啟", shortcut: "Ctrl+O" },
      { type: "separator" },
      { type: "item", label: "儲存", shortcut: "Ctrl+S" },
      { type: "item", label: "另存新檔", shortcut: "Ctrl+Shift+S" },
      { type: "separator" },
      {
        type: "sub",
        label: "匯出",
        items: [
          { type: "item", label: "Excel" },
          { type: "item", label: "PDF" },
          { type: "item", label: "CSV" },
        ],
      },
      { type: "separator" },
      { type: "item", label: "列印", shortcut: "Ctrl+P" },
    ],
  },
  {
    label: "編輯",
    items: [
      { type: "item", label: "復原", shortcut: "Ctrl+Z" },
      { type: "item", label: "重做", shortcut: "Ctrl+Y" },
      { type: "separator" },
      { type: "item", label: "剪下", shortcut: "Ctrl+X" },
      { type: "item", label: "複製", shortcut: "Ctrl+C" },
      { type: "item", label: "貼上", shortcut: "Ctrl+V" },
      { type: "separator" },
      { type: "item", label: "尋找", shortcut: "Ctrl+F" },
    ],
  },
  {
    label: "檢視",
    items: [
      { type: "item", label: "重新整理", shortcut: "F5" },
      { type: "separator" },
      { type: "item", label: "顯示 Sidebar" },
      { type: "item", label: "顯示 Statusbar" },
      { type: "separator" },
      { type: "item", label: "放大", shortcut: "Ctrl++" },
      { type: "item", label: "縮小", shortcut: "Ctrl+-" },
    ],
  },
  {
    label: "工具",
    items: [
      { type: "item", label: "匯入資料" },
      { type: "item", label: "批次作業" },
      { type: "item", label: "系統設定" },
      { type: "separator" },
      { type: "item", label: "權限檢查" },
    ],
  },
  {
    label: "視窗",
    items: [
      { type: "item", label: "新增視窗" },
      { type: "item", label: "關閉視窗" },
      { type: "separator" },
      { type: "item", label: "下一個分頁", shortcut: "Ctrl+Tab" },
      { type: "item", label: "上一個分頁", shortcut: "Ctrl+Shift+Tab" },
    ],
  },
  {
    label: "說明",
    items: [
      { type: "item", label: "使用說明", shortcut: "F1" },
      { type: "item", label: "快捷鍵清單" },
      { type: "separator" },
      { type: "item", label: "關於 DoDo Admin" },
    ],
  },
]

// 輸出展示用選單點擊事件，日後可替換成真實命令
function handleMenuAction(menuLabel: string, itemLabel: string) {
  console.info(`[DoDo Admin] ${menuLabel} > ${itemLabel}`)
}

type MenuEntryProps = {
  entry: AppMenuEntry
  menuLabel: string
}

// 渲染單一選單項目，支援分隔線、快捷鍵與子選單
function MenuEntry({ entry, menuLabel }: MenuEntryProps) {
  const [subOpen, setSubOpen] = useState(false)

  if (entry.type === "separator") {
    return <DropdownMenuSeparator />
  }

  if (entry.type === "sub") {
    return (
      <DropdownMenuSub open={subOpen} onOpenChange={setSubOpen}>
        <DropdownMenuSubTrigger
          className="text-xs"
          onMouseEnter={() => setSubOpen(true)}
        >
          {entry.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-36 rounded-sm">
          {entry.items.map((child, childIndex) => (
            <MenuEntry
              key={`${entry.label}-${childIndex}-${child.type}`}
              entry={child}
              menuLabel={entry.label}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  return (
    <DropdownMenuItem
      className="text-xs"
      onClick={() => handleMenuAction(menuLabel, entry.label)}
    >
      <span>{entry.label}</span>
      {entry.shortcut && (
        <DropdownMenuShortcut className="text-[10px] tracking-normal">
          {entry.shortcut}
        </DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  )
}

// 顯示桌面程式風格的全域功能選單列
export function AppMenuBar() {
  const { appMenuVisible } = useHeaderVisibility()
  const [temporarilyVisible, setTemporarilyVisible] = useState(false)
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null)
  const [showDiscoveryHint, setShowDiscoveryHint] = useState(false)
  const appHeaderRef = useRef<HTMLDivElement | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 取消尚未執行的延遲顯示
  const cancelReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [])

  // 關閉首次功能選單提示並記錄狀態
  const dismissDiscoveryHint = useCallback(() => {
    setShowDiscoveryHint(false)
    window.localStorage.setItem(discoveryHintStorageKey, "true")
  }, [])

  // 由畫面頂端感應區暫時喚回功能列
  const revealTemporarily = useCallback(() => {
    cancelReveal()
    dismissDiscoveryHint()
    revealTimerRef.current = setTimeout(() => {
      setTemporarilyVisible(true)
      revealTimerRef.current = null
    }, revealDelayMs)
  }, [cancelReveal, dismissDiscoveryHint])

  // 收起暫時顯示的 AppMenuBar
  const hideTemporaryMenu = useCallback(() => {
    setOpenMenuLabel(null)
    setTemporarilyVisible(false)
  }, [])

  useEffect(() => {
    if (appMenuVisible) {
      cancelReveal()
      setTemporarilyVisible(false)
    }

    return () => {
      cancelReveal()
    }
  }, [appMenuVisible, cancelReveal])

  useEffect(() => {
    if (!temporarilyVisible || appMenuVisible) return

    // 點擊 AppMenuBar 外部時，明確關閉暫時顯示的功能列
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (appHeaderRef.current?.contains(target)) return

      hideTemporaryMenu()
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [appMenuVisible, hideTemporaryMenu, temporarilyVisible])

  useEffect(() => {
    const dismissed = window.localStorage.getItem(discoveryHintStorageKey)

    setShowDiscoveryHint(dismissed !== "true")
  }, [])

  const menuContent = (
    <nav aria-label="應用程式功能選單">
      <ul className="flex h-full items-center gap-1">
        {menuGroups.map((group) => (
          <li key={group.label} className="h-full">
            <DropdownMenu
              modal={false}
              open={openMenuLabel === group.label}
              onOpenChange={(open) =>
                setOpenMenuLabel(open ? group.label : null)
              }
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onMouseEnter={() => setOpenMenuLabel(group.label)}
                  className="flex h-full items-center rounded-sm px-2 text-xs transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {group.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={0}
                className="min-w-48 rounded-sm"
              >
                {group.items.map((entry, index) => (
                  <MenuEntry
                    key={`${group.label}-${index}-${entry.type}`}
                    entry={entry}
                    menuLabel={group.label}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </nav>
  )

  if (!appMenuVisible) {
    return (
      <>
        <div
          className="fixed inset-x-0 top-0 z-30 hidden h-3 md:block"
          onMouseEnter={revealTemporarily}
          onMouseLeave={cancelReveal}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] leading-none text-slate-400">
            ▾
          </span>
        </div>
        {showDiscoveryHint && !temporarilyVisible && (
          <div className="fixed left-1/2 top-3 z-30 hidden -translate-x-1/2 animate-[wiggle_1.8s_ease-in-out_infinite] items-center gap-2 rounded border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs text-orange-900 shadow-sm shadow-orange-200/70 md:flex [&]:[animation-delay:600ms]">
            <style>
              {`@keyframes wiggle {
                0%, 100% { transform: translateX(-50%); }
                8% { transform: translateX(calc(-50% - 2px)); }
                16% { transform: translateX(calc(-50% + 2px)); }
                24% { transform: translateX(-50%); }
              }`}
            </style>
            <span className="font-medium">滑過上緣開啟功能選單</span>
            <button
              type="button"
              className="rounded px-1 text-[11px] text-orange-700 transition-colors hover:bg-orange-100 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              onClick={dismissDiscoveryHint}
            >
              知道了
            </button>
          </div>
        )}
        {temporarilyVisible && (
          <div
            ref={appHeaderRef}
            data-dodo-section="appHeader"
            className="fixed inset-x-0 top-0 z-40 hidden h-[var(--app-menu-bar-height)] items-center border-b bg-muted px-4 text-xs text-foreground shadow-sm motion-safe:animate-in motion-safe:slide-in-from-top md:flex"
          >
            {menuContent}
          </div>
        )}
      </>
    )
  }

  return (
    <div
      ref={appHeaderRef}
      data-dodo-section="appHeader"
      className="hidden h-[var(--app-menu-bar-height)] items-center border-b bg-muted px-4 text-xs text-foreground md:flex"
    >
      {menuContent}
    </div>
  )
}
