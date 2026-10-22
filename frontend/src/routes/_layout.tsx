import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { AppFooter } from "@/components/Footer/AppFooter"
import { AppMenuBar } from "@/components/Header/AppMenuBar"
import {
  HeaderVisibilityProvider,
  useHeaderVisibility,
} from "@/components/Header/header-visibility"
import { UserHeader } from "@/components/Header/UserHeader"
import { KeyboardShortcutsProvider } from "@/components/Keyboard/KeyboardShortcutsProvider"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { SidebarControllerBridge } from "@/components/Sidebar/SidebarControllerBridge"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"
import {
  type DodoMainContentController,
  registerDodoControllerSection,
} from "@/lib/dodo-controller"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

// 註冊登入後中央內容區的 Console 查詢介面
function MainContentController({ children }: { children: ReactNode }) {
  const mainContentRef = useRef<HTMLElement | null>(null)

  // 取得中央內容區對外狀態
  const getState = useCallback(
    () =>
      ({
        name: "mainContent",
        mounted: Boolean(mainContentRef.current),
      }) as const,
    [],
  )

  // 取得中央內容區 DOM element
  const getElement = useCallback(() => mainContentRef.current, [])

  useEffect(() => {
    const controller: DodoMainContentController = {
      name: "mainContent",
      getState,
      getElement,
    }

    return registerDodoControllerSection("mainContent", controller)
  }, [getElement, getState])

  return (
    <main
      ref={mainContentRef}
      data-dodo-section="mainContent"
      className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8"
    >
      {children}
    </main>
  )
}

// 依 Header 顯示狀態計算版面保留高度
function AuthenticatedLayout() {
  const { appMenuVisible, userHeaderVisible } = useHeaderVisibility()
  const [footerLayoutVisible, setFooterLayoutVisible] = useState(false)
  // 首頁（頁籤工作區）的內容區不套 max-w-7xl，讓 Tab Header 能滿版貼齊邊緣
  const isTabWorkspace = useRouterState({
    select: (s) => s.location.pathname === "/",
  })
  const appMenuLayoutHeight = appMenuVisible
    ? "var(--app-menu-bar-height)"
    : "0rem"
  const userHeaderLayoutHeight = userHeaderVisible
    ? "var(--user-header-height)"
    : "0rem"
  const footerLayoutHeight = footerLayoutVisible
    ? "var(--app-footer-height)"
    : "0rem"

  return (
    <SidebarProvider
      style={
        {
          "--app-menu-bar-height": "2rem",
          "--user-header-height": "3rem",
          "--app-footer-height": "1.75rem",
          "--app-menu-layout-height": appMenuLayoutHeight,
          "--user-header-layout-height": userHeaderLayoutHeight,
          "--app-footer-layout-height": footerLayoutHeight,
        } as CSSProperties
      }
      className="pt-[var(--user-header-layout-height)] md:pt-[calc(var(--app-menu-layout-height)+var(--user-header-layout-height))]"
    >
      <header className="fixed inset-x-0 top-0 z-20 bg-background">
        <AppMenuBar />
        <UserHeader />
      </header>
      <SidebarControllerBridge />
      <AppSidebar />
      <SidebarInset className="pb-[var(--app-footer-layout-height)]">
        <MainContentController>
          {isTabWorkspace ? (
            <Outlet />
          ) : (
            <div className="-mt-4 w-full min-w-0">
              <Outlet />
            </div>
          )}
        </MainContentController>
      </SidebarInset>
      <AppFooter onLayoutVisibilityChange={setFooterLayoutVisible} />
      <KeyboardShortcutsProvider />
    </SidebarProvider>
  )
}

// 建立登入後頁面共用的頂欄、側邊欄與內容版型
function Layout() {
  return (
    <HeaderVisibilityProvider>
      <AuthenticatedLayout />
    </HeaderVisibilityProvider>
  )
}

export default Layout
