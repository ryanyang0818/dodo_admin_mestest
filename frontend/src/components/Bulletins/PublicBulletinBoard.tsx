import { useQuery } from "@tanstack/react-query"
import { CalendarDays, Megaphone, Pin } from "lucide-react"
import { useState } from "react"

import { type BulletinPostPublic, PublicBulletinsService } from "@/client"
import { BulletinPreviewDialog } from "@/components/Bulletins/BulletinPreviewDialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

// 以台灣常用格式顯示文章時間
function formatBulletinDate(value?: string | null) {
  if (!value) return ""
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

// 在登入頁顯示不需登入即可閱讀的佈告欄
export function PublicBulletinBoard() {
  const [selected, setSelected] = useState<BulletinPostPublic | null>(null)
  const query = useQuery({
    queryKey: ["public-bulletins"],
    queryFn: () => PublicBulletinsService.readPublicBulletins({ limit: 8 }),
  })

  return (
    <section className="flex h-full w-full flex-col bg-muted/40 p-5 lg:p-10">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">最新公告</h2>
            <p className="text-sm text-muted-foreground">不需登入即可查看</p>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          {query.isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          {query.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              公告暫時無法載入，請稍後再試。
            </div>
          )}
          {query.data?.data.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              目前沒有公告
            </div>
          )}
          {query.data?.data.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelected(post)}
              className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {post.is_pinned && (
                      <Pin className="size-4 shrink-0 text-primary" />
                    )}
                    <h3 className="truncate font-semibold">{post.title}</h3>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {post.summary || post.content_text || "點擊查看公告內容"}
                  </p>
                </div>
                {post.is_pinned && <Badge variant="secondary">置頂</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{post.publisher_unit}</span>
                <span>{post.author_name}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatBulletinDate(post.publish_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <BulletinPreviewDialog
        post={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </section>
  )
}
