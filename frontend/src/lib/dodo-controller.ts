export type DodoSectionName =
  | "appHeader"
  | "userHeader"
  | "sidebar"
  | "mainContent"
  | "footer"

export type DodoVisibilityState = {
  name: "appHeader" | "userHeader"
  visible: boolean
}

export type DodoVisibilityController = {
  name: "appHeader" | "userHeader"
  show: () => void
  hide: () => void
  toggle: () => void
  getState: () => DodoVisibilityState
}

export type DodoSidebarState = {
  name: "sidebar"
  state: "expanded" | "collapsed"
  open: boolean
  openMobile: boolean
  isMobile: boolean
}

export type DodoSidebarController = {
  name: "sidebar"
  expand: () => void
  collapse: () => void
  toggle: () => void
  openMobile: () => void
  closeMobile: () => void
  getState: () => DodoSidebarState
}

export type DodoMainContentState = {
  name: "mainContent"
  mounted: boolean
}

export type DodoMainContentController = {
  name: "mainContent"
  getState: () => DodoMainContentState
  getElement: () => HTMLElement | null
}

export type DodoFooterState = {
  name: "footer"
  mounted: boolean
  visible: boolean
  temporarilyVisible: boolean
  connectionStatus: "已連線"
  database: "PROD-TPE-01"
  company: "DoDo 台北總公司"
  fiscalYear: 2026
  language: "繁體中文"
  userName: string
  currentTime: string
}

export type DodoFooterController = {
  name: "footer"
  show: () => void
  hide: () => void
  toggle: () => void
  getState: () => DodoFooterState
  getElement: () => HTMLElement | null
}

export type DodoController = {
  appHeader: DodoVisibilityController
  userHeader: DodoVisibilityController
  sidebar: DodoSidebarController
  mainContent: DodoMainContentController
  footer: DodoFooterController
}

declare global {
  interface Window {
    dodo?: {
      controller: DodoController
    }
  }
}

// 建立或取得 DoDo 全域控制器根物件
export function ensureDodoController() {
  if (!window.dodo) {
    window.dodo = {
      controller: {} as DodoController,
    }
  }

  return window.dodo.controller
}

// 註冊指定首頁區塊的 Console 控制器
export function registerDodoControllerSection<
  TKey extends keyof DodoController,
>(name: TKey, controller: DodoController[TKey]) {
  const dodoController = ensureDodoController()
  dodoController[name] = controller

  return () => {
    if (window.dodo?.controller[name] === controller) {
      delete (window.dodo.controller as Partial<DodoController>)[name]
    }
  }
}
