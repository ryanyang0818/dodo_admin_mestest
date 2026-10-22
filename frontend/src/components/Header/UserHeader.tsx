import { useQuery } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import {
  Bell,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sun,
} from "lucide-react"

import { PageTodosService } from "@/client"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { siteConfig } from "@/site.config"
import { getInitials } from "@/utils"
import dodoIcon from "/assets/images/dodo-icon-light.svg"
import { useHeaderVisibility } from "./header-visibility"

const departmentTabs = []

// 顯示 DoDo Admin 的品牌列、部門分頁、搜尋與目前登入使用者
export function UserHeader() {
  const { user, logout } = useAuth()
  const { userHeaderVisible } = useHeaderVisibility()
  const { setTheme } = useTheme()
  const displayName = user?.full_name || user?.email || "User"
  const roleLabel = user?.is_superuser ? "Superuser" : "User"

  // 未完成待辦數量（供通知鈴鐺顯示），與 Todos 頁籤共用查詢快取
  const unfinishedTodosQuery = useQuery({
    queryKey: ["todos"],
    queryFn: () => PageTodosService.readTodos({ skip: 0, limit: 500 }),
    retry: false,
  })
  const unfinishedTodoCount =
    unfinishedTodosQuery.data?.data.filter((todo) => todo.status !== "done")
      .length ?? 0
  const unfinishedTodoBadge =
    unfinishedTodoCount > 99 ? "99+" : String(unfinishedTodoCount)

  if (!userHeaderVisible) return null

  return (
    <div
      data-dodo-section="userHeader"
      className="flex h-[var(--user-header-height)] min-w-0 items-center gap-4 overflow-hidden border-b border-slate-200 bg-white px-3 text-[13px] text-slate-800"
    >
      <SidebarTrigger className="size-8 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-950" />
      <RouterLink
        to="/"
        className="flex h-full shrink-0 items-center gap-2.5 border-r border-slate-200 pr-5"
      >
        <img src={dodoIcon} alt="DoDo Admin" className="size-[30px] rounded" />
        <div className="min-w-0 leading-tight">
          <div className="font-semibold text-slate-950">
            {siteConfig.appName}
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            {siteConfig.environment} · v{siteConfig.version}
          </div>
        </div>
      </RouterLink>

      <nav
        aria-label="部門切換"
        className="hidden h-full min-w-0 flex-1 items-stretch overflow-hidden md:flex"
      >
        {departmentTabs.map((tab) => {
          const active = tab === "採購"

          return (
            <button
              type="button"
              key={tab}
              className={`relative inline-flex h-full shrink-0 items-center px-2 font-medium transition-colors hover:text-slate-950 lg:px-3 ${
                active ? "text-blue-600" : "text-slate-600"
              }`}
            >
              {tab}
              {active && (
                <span className="absolute inset-x-3 bottom-[-1px] h-0.5 rounded-t bg-blue-600" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        <label className="hidden h-7 w-80 items-center gap-1.5 rounded border border-slate-200 bg-slate-100 px-2 text-slate-500 transition-colors focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 lg:flex">
          <Search className="size-3.5" />
          <input
            type="search"
            aria-label="全域搜尋"
            placeholder="搜尋文件..."
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-500"
          />
          <span className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-500">
            Ctrl+K
          </span>
        </label>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            aria-label="通知"
            title={`${unfinishedTodoCount} 項未完成待辦事項`}
            className="relative grid size-8 place-items-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <Bell className="size-3.5" />
            {unfinishedTodoCount > 0 && (
              <span className="absolute right-0.5 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                {unfinishedTodoBadge}
              </span>
            )}
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="theme-button"
                aria-label="主題外觀"
                title="調整主題顏色"
                className="relative grid size-8 place-items-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                <Sun className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">切換主題</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="light-mode"
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="dark-mode"
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-[22px] w-px bg-slate-200" />
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="開啟使用者選單"
              className="flex min-w-0 items-center gap-2 rounded-md py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-slate-100"
            >
              <Avatar className="size-[26px]">
                <AvatarFallback className="bg-orange-400 text-xs font-semibold text-white">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 text-left leading-tight sm:block">
                <span className="block max-w-32 truncate text-xs font-semibold text-slate-950">
                  {displayName}
                </span>
                <span className="block max-w-32 truncate text-[10px] text-slate-500">
                  {roleLabel}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="min-w-0 truncate font-normal">
              <span className="block truncate text-sm font-medium">
                {displayName}
              </span>
              {user?.email && (
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut />
              登出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
