import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  type DodoVisibilityController,
  registerDodoControllerSection,
} from "@/lib/dodo-controller"

type HeaderVisibilityState = {
  appMenuVisible: boolean
  userHeaderVisible: boolean
}

type HeaderVisibilityControls = HeaderVisibilityState & {
  hideAppMenu: () => void
  showAppMenu: () => void
  toggleAppMenu: () => void
  hideUserHeader: () => void
  showUserHeader: () => void
  toggleUserHeader: () => void
  hideAll: () => void
  showAll: () => void
}

export type HeaderControlsApi = Omit<
  HeaderVisibilityControls,
  keyof HeaderVisibilityState
> & {
  getState: () => HeaderVisibilityState
}

declare global {
  interface Window {
    headerControls?: HeaderControlsApi
  }
}

const HeaderVisibilityContext = createContext<HeaderVisibilityControls | null>(
  null,
)

// 提供雙層 Header 的顯示狀態與外部 JavaScript 控制介面
export function HeaderVisibilityProvider({
  children,
}: {
  children: ReactNode
}) {
  const [appMenuVisible, setAppMenuVisible] = useState(false)
  const [userHeaderVisible, setUserHeaderVisible] = useState(true)

  const hideAppMenu = useCallback(() => setAppMenuVisible(false), [])
  const showAppMenu = useCallback(() => setAppMenuVisible(true), [])
  const toggleAppMenu = useCallback(
    () => setAppMenuVisible((visible) => !visible),
    [],
  )
  const hideUserHeader = useCallback(() => setUserHeaderVisible(false), [])
  const showUserHeader = useCallback(() => setUserHeaderVisible(true), [])
  const toggleUserHeader = useCallback(
    () => setUserHeaderVisible((visible) => !visible),
    [],
  )
  const hideAll = useCallback(() => {
    setAppMenuVisible(false)
    setUserHeaderVisible(false)
  }, [])
  const showAll = useCallback(() => {
    setAppMenuVisible(true)
    setUserHeaderVisible(true)
  }, [])

  // 取得 App Header 對外顯示狀態
  const getAppHeaderState = useCallback(
    () => ({ name: "appHeader", visible: appMenuVisible }) as const,
    [appMenuVisible],
  )

  // 取得 User Header 對外顯示狀態
  const getUserHeaderState = useCallback(
    () => ({ name: "userHeader", visible: userHeaderVisible }) as const,
    [userHeaderVisible],
  )

  const value = useMemo(
    () => ({
      appMenuVisible,
      userHeaderVisible,
      hideAppMenu,
      showAppMenu,
      toggleAppMenu,
      hideUserHeader,
      showUserHeader,
      toggleUserHeader,
      hideAll,
      showAll,
    }),
    [
      appMenuVisible,
      userHeaderVisible,
      hideAppMenu,
      showAppMenu,
      toggleAppMenu,
      hideUserHeader,
      showUserHeader,
      toggleUserHeader,
      hideAll,
      showAll,
    ],
  )

  useEffect(() => {
    const controls: HeaderControlsApi = {
      hideAppMenu,
      showAppMenu,
      toggleAppMenu,
      hideUserHeader,
      showUserHeader,
      toggleUserHeader,
      hideAll,
      showAll,
      getState: () => ({ appMenuVisible, userHeaderVisible }),
    }
    const appHeaderController: DodoVisibilityController = {
      name: "appHeader",
      show: showAppMenu,
      hide: hideAppMenu,
      toggle: toggleAppMenu,
      getState: getAppHeaderState,
    }
    const userHeaderController: DodoVisibilityController = {
      name: "userHeader",
      show: showUserHeader,
      hide: hideUserHeader,
      toggle: toggleUserHeader,
      getState: getUserHeaderState,
    }
    const unregisterAppHeader = registerDodoControllerSection(
      "appHeader",
      appHeaderController,
    )
    const unregisterUserHeader = registerDodoControllerSection(
      "userHeader",
      userHeaderController,
    )

    window.headerControls = controls

    return () => {
      unregisterAppHeader()
      unregisterUserHeader()

      if (window.headerControls === controls) {
        delete window.headerControls
      }
    }
  }, [
    appMenuVisible,
    userHeaderVisible,
    hideAppMenu,
    showAppMenu,
    toggleAppMenu,
    hideUserHeader,
    showUserHeader,
    toggleUserHeader,
    hideAll,
    showAll,
    getAppHeaderState,
    getUserHeaderState,
  ])

  return (
    <HeaderVisibilityContext.Provider value={value}>
      {children}
    </HeaderVisibilityContext.Provider>
  )
}

// 取得雙層 Header 的顯示狀態與控制方法
export function useHeaderVisibility() {
  const context = useContext(HeaderVisibilityContext)

  if (!context) {
    throw new Error(
      "useHeaderVisibility must be used within HeaderVisibilityProvider",
    )
  }

  return context
}
