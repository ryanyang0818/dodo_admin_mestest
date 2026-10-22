import { Link } from "@tanstack/react-router"
import { Megaphone, Table2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

// 顯示首頁公告與目前登入使用者的歡迎訊息（頁籤可重用的純內容元件）
export function DashboardView() {
  const { user: currentUser } = useAuth()

  return (
    <div className="space-y-6">
      <section className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">歡迎使用管理平台</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            你可以從左側選單開始管理 Items、帳號與個人設定。
          </p>
        </div>
      </section>

      <div>
        <h1 className="max-w-sm truncate text-2xl">
          Hello, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          Welcome back, nice to see you again!!!
          &熱重載測試成功！
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/table-demos" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Table2 className="size-4 text-muted-foreground" />
                Table Demos
              </CardTitle>
              <CardDescription>
                @tanstack/react-table v8
                能力展示：排序、過濾、勾選、凍結、分組、編輯等 5 個示範頁。
              </CardDescription>
              <div className="mt-2">
                <Badge
                  variant="secondary"
                  className="font-mono text-xs font-normal"
                >
                  /table-demos
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
