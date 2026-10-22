import { useCallback, useEffect, useRef, useState } from "react"

import useAuth from "@/hooks/useAuth"
import {
  type DodoFooterController,
  registerDodoControllerSection,
} from "@/lib/dodo-controller"
import { siteConfig } from "@/site.config"

const footerStatus = {
  company: siteConfig.company,
  connectionStatus: siteConfig.connectionStatus,
  database: siteConfig.database,
  fiscalYear: siteConfig.fiscalYear,
  language: siteConfig.language,
} as const

const revealDelayMs = 200
const hideDelayMs = 400

type AppFooterProps = {
  onLayoutVisibilityChange?: (visible: boolean) => void
}

// 格式化 ERP footer 顯示時間
function formatFooterTime(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

// 顯示登入後 ERP 風格底部狀態列
export function AppFooter({ onLayoutVisibilityChange }: AppFooterProps) {
  const footerRef = useRef<HTMLElement | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useAuth()
  const [footerVisible, setFooterVisible] = useState(true)
  const [temporarilyVisible, setTemporarilyVisible] = useState(false)
  const [currentTime, setCurrentTime] = useState(() =>
    formatFooterTime(new Date()),
  )
  const userName = user?.full_name || user?.email || "User"
  const visible = footerVisible || temporarilyVisible

  // 取消尚未執行的延遲顯示
  const cancelReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [])

  // 取消尚未執行的延遲隱藏
  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  // 由畫面底部感應區暫時喚回 footer
  const revealTemporarily = () => {
    cancelHide()
    cancelReveal()
    revealTimerRef.current = setTimeout(() => {
      setTemporarilyVisible(true)
      revealTimerRef.current = null
    }, revealDelayMs)
  }

  // 滑鼠離開後延遲收起 footer
  const scheduleHide = () => {
    cancelReveal()
    cancelHide()
    hideTimerRef.current = setTimeout(() => {
      setTemporarilyVisible(false)
      hideTimerRef.current = null
    }, hideDelayMs)
  }

  // 固定顯示 footer
  const show = () => {
    cancelReveal()
    cancelHide()
    setTemporarilyVisible(false)
    setFooterVisible(true)
  }

  // 隱藏固定顯示的 footer
  const hide = () => {
    cancelReveal()
    cancelHide()
    setTemporarilyVisible(false)
    setFooterVisible(false)
  }

  // 切換 footer 固定顯示狀態
  const toggle = () => {
    if (footerVisible) {
      hide()
      return
    }

    show()
  }

  // 每秒更新 footer 顯示時間
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(formatFooterTime(new Date()))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    onLayoutVisibilityChange?.(visible)
  }, [onLayoutVisibilityChange, visible])

  useEffect(() => {
    return () => onLayoutVisibilityChange?.(false)
  }, [onLayoutVisibilityChange])

  // 取得 footer 對外狀態
  const getState = () =>
    ({
      name: "footer",
      mounted: Boolean(footerRef.current),
      visible,
      temporarilyVisible,
      ...footerStatus,
      userName,
      currentTime,
    }) as const

  // 取得 footer DOM element
  const getElement = () => footerRef.current

  useEffect(() => {
    const controller: DodoFooterController = {
      name: "footer",
      show,
      hide,
      toggle,
      getState,
      getElement,
    }

    return registerDodoControllerSection("footer", controller)
  })

  useEffect(() => {
    return () => {
      cancelReveal()
      cancelHide()
    }
  }, [cancelHide, cancelReveal])

  return (
    <>
      {!visible && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 h-1"
          onMouseEnter={revealTemporarily}
          onMouseLeave={cancelReveal}
          aria-hidden="true"
        />
      )}
      {visible && (
        <footer
          ref={footerRef}
          data-dodo-section="footer"
          className="fixed inset-x-0 bottom-0 z-40 h-[var(--app-footer-height)] overflow-hidden border-t border-slate-300 bg-slate-100 text-[11px] text-slate-800 shadow-sm motion-safe:animate-in motion-safe:slide-in-from-bottom"
        >
          <section
            aria-label="Footer status"
            className="flex h-full items-center justify-between gap-4 px-3"
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-700">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-emerald-600"
                />
                <span>{footerStatus.connectionStatus}</span>
              </span>
              <span className="shrink-0">DB: {footerStatus.database}</span>
              <span className="shrink-0">公司: {footerStatus.company}</span>
              <span className="shrink-0">
                會計年度: {footerStatus.fiscalYear}
              </span>
            </div>

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
              <span className="shrink-0">{footerStatus.language}</span>
              <span className="max-w-28 truncate">{userName}</span>
              <time
                className="shrink-0 font-mono text-[10px]"
                dateTime={currentTime}
              >
                {currentTime}
              </time>
            </div>
          </section>
        </footer>
      )}
    </>
  )
}
