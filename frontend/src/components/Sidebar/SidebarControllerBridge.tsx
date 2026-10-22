import { useCallback, useEffect } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import {
  type DodoSidebarController,
  registerDodoControllerSection,
} from "@/lib/dodo-controller"

// 將既有 SidebarProvider 狀態註冊到 DoDo 全域控制器
export function SidebarControllerBridge() {
  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar()

  // 展開桌面版 Sidebar
  const expand = useCallback(() => setOpen(true), [setOpen])

  // 收合桌面版 Sidebar
  const collapse = useCallback(() => setOpen(false), [setOpen])

  // 開啟手機版 Sidebar 抽屜
  const openMobileSidebar = useCallback(
    () => setOpenMobile(true),
    [setOpenMobile],
  )

  // 關閉手機版 Sidebar 抽屜
  const closeMobileSidebar = useCallback(
    () => setOpenMobile(false),
    [setOpenMobile],
  )

  // 取得 Sidebar 對外狀態
  const getState = useCallback(
    () =>
      ({
        name: "sidebar",
        state,
        open,
        openMobile,
        isMobile,
      }) as const,
    [state, open, openMobile, isMobile],
  )

  useEffect(() => {
    const controller: DodoSidebarController = {
      name: "sidebar",
      expand,
      collapse,
      toggle: toggleSidebar,
      openMobile: openMobileSidebar,
      closeMobile: closeMobileSidebar,
      getState,
    }

    return registerDodoControllerSection("sidebar", controller)
  }, [
    expand,
    collapse,
    toggleSidebar,
    openMobileSidebar,
    closeMobileSidebar,
    getState,
  ])

  return null
}
