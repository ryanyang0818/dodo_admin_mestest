import type { JSONContent } from "@tiptap/react"

import type { BulletinPostPublic } from "@/client"
import { BulletinEditor } from "@/components/Bulletins/BulletinEditor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type BulletinPreviewDialogProps = {
  post: BulletinPostPublic | null
  onOpenChange: (open: boolean) => void
}

// 以台灣常用格式顯示文章時間
function formatBulletinDate(value?: string | null) {
  if (!value) return ""
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

// 首頁與管理頁共用的公告唯讀預覽
export function BulletinPreviewDialog({
  post,
  onOpenChange,
}: BulletinPreviewDialogProps) {
  return (
    <Dialog open={Boolean(post)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {post && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl">{post.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{post.publisher_unit}</span>
                <span>建立者：{post.author_name}</span>
                <span>{formatBulletinDate(post.publish_at)}</span>
              </DialogDescription>
            </DialogHeader>
            <BulletinEditor readOnly value={post.content_json as JSONContent} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                關閉
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
