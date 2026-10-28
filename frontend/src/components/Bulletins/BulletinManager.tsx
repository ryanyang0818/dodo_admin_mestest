import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { Edit3, Eye, Megaphone, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type BulletinPostCreate,
  type BulletinPostPublic,
  type BulletinPostUpdate,
  BulletinsService,
} from "@/client"
import {
  BulletinEditor,
  EMPTY_BULLETIN_CONTENT,
} from "@/components/Bulletins/BulletinEditor"
import { BulletinPreviewDialog } from "@/components/Bulletins/BulletinPreviewDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z
  .object({
    title: z.string().trim().min(1, "標題必填").max(200),
    summary: z.string().trim().max(500).optional(),
    publisher_unit: z.string().trim().min(1, "發布單位必填").max(100),
    status: z.enum(["draft", "published", "archived"]),
    is_pinned: z.boolean(),
    pin_order: z.number().int().min(0),
    publish_at: z.string().optional(),
    expire_at: z.string().optional(),
  })
  .refine(
    (value) =>
      !value.publish_at ||
      !value.expire_at ||
      new Date(value.expire_at) > new Date(value.publish_at),
    { message: "到期時間必須晚於發布時間", path: ["expire_at"] },
  )

type FormData = z.infer<typeof formSchema>

type BulletinEditorDialogProps = {
  open: boolean
  post: BulletinPostPublic | null
  onOpenChange: (open: boolean) => void
  onPostCreated: (post: BulletinPostPublic) => void
}

// 將 API ISO 時間轉成 datetime-local 可使用的本機時間
function toDateTimeInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

// 將 datetime-local 值轉成 API 使用的 ISO 時間
function toApiDateTime(value?: string) {
  return value ? new Date(value).toISOString() : null
}

// 依文章產生表單預設值
function getDefaults(post: BulletinPostPublic | null): FormData {
  return {
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    publisher_unit: post?.publisher_unit ?? "",
    status: post?.status ?? "draft",
    is_pinned: post?.is_pinned ?? false,
    pin_order: post?.pin_order ?? 0,
    publish_at: toDateTimeInput(post?.publish_at),
    expire_at: toDateTimeInput(post?.expire_at),
  }
}

// 顯示文章狀態中文
function statusLabel(status?: string) {
  if (status === "published") return "已發布"
  if (status === "archived") return "已封存"
  return "草稿"
}

// 新增與編輯共用的文章對話框
function BulletinEditorDialog({
  open,
  post,
  onOpenChange,
  onPostCreated,
}: BulletinEditorDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [content, setContent] = useState<JSONContent>(
    (post?.content_json as JSONContent) ?? EMPTY_BULLETIN_CONTENT,
  )
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(post),
  })

  useEffect(() => {
    form.reset(getDefaults(post))
    setContent((post?.content_json as JSONContent) ?? EMPTY_BULLETIN_CONTENT)
  }, [form, post])

  const mutation = useMutation({
    mutationFn: (requestBody: BulletinPostCreate | BulletinPostUpdate) =>
      post
        ? BulletinsService.updateBulletin({ id: post.id, requestBody })
        : BulletinsService.createBulletin({
            requestBody: requestBody as BulletinPostCreate,
          }),
    onSuccess: (savedPost) => {
      showSuccessToast(post ? "公告已更新" : "草稿已建立，可繼續插入圖片")
      onPostCreated(savedPost)
      queryClient.invalidateQueries({ queryKey: ["bulletins"] })
      queryClient.invalidateQueries({ queryKey: ["public-bulletins"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  // 儲存表單欄位與 Tiptap JSON
  const onSubmit = (data: FormData) => {
    mutation.mutate({
      title: data.title,
      summary: data.summary || null,
      publisher_unit: data.publisher_unit,
      content_json: content as Record<string, unknown>,
      status: data.status,
      is_pinned: data.is_pinned,
      pin_order: data.pin_order,
      publish_at: toApiDateTime(data.publish_at),
      expire_at: toApiDateTime(data.expire_at),
    })
  }

  // 上傳圖片並回傳 Tiptap image node 所需屬性
  const uploadImage = async (file: File) => {
    if (!post) throw new Error("請先儲存草稿，再插入圖片")
    try {
      const asset = await BulletinsService.uploadBulletinAsset({
        id: post.id,
        formData: { file: file as unknown as string },
      })
      return { id: asset.id, url: asset.url }
    } catch (error) {
      handleError.call(showErrorToast, error as never)
      throw error
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{post ? "編輯公告" : "新增公告"}</DialogTitle>
          <DialogDescription>
            {!post
              ? "第一次儲存後會建立草稿，接著即可在內文指定位置插入圖片。"
              : `建立者：${post.author_name}`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>標題</FormLabel>
                    <FormControl>
                      <Input maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="publisher_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>發布單位</FormLabel>
                    <FormControl>
                      <Input maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>狀態</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">草稿</SelectItem>
                        <SelectItem value="published">發布</SelectItem>
                        <SelectItem value="archived">封存</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>摘要（選填）</FormLabel>
                    <FormControl>
                      <Input maxLength={500} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="publish_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>發布時間（選填）</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expire_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>到期時間（選填）</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_pinned"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(value) =>
                          field.onChange(value === true)
                        }
                      />
                    </FormControl>
                    <FormLabel>置頂公告</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pin_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>置頂順序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>內文</FormLabel>
              <BulletinEditor
                value={content}
                onChange={setContent}
                onUploadImage={post ? uploadImage : undefined}
              />
              {!post && (
                <p className="text-xs text-muted-foreground">
                  請先儲存草稿，圖片按鈕才會啟用。
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                關閉
              </Button>
              <LoadingButton type="submit" loading={mutation.isPending}>
                {post ? "儲存變更" : "建立草稿"}
              </LoadingButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// 顯示登入後的佈告欄管理頁
export function BulletinManager() {
  const [keyword, setKeyword] = useState("")
  const [editing, setEditing] = useState<BulletinPostPublic | null>(null)
  const [previewing, setPreviewing] = useState<BulletinPostPublic | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const query = useQuery({
    queryKey: ["bulletins", keyword],
    queryFn: () =>
      BulletinsService.readBulletins({
        keyword: keyword || undefined,
        limit: 100,
      }),
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone className="size-6" />
            佈告欄管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理顯示在登入頁面的公開公告。
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus />
          新增公告
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜尋標題、發布單位或內文"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_7rem_10rem_8rem] gap-3 border-b bg-muted/50 px-4 py-3 text-sm font-medium">
          <span>標題</span>
          <span>發布單位</span>
          <span>狀態</span>
          <span>最後修改</span>
          <span>操作</span>
        </div>
        {query.isLoading && (
          <div className="p-6 text-sm text-muted-foreground">載入中…</div>
        )}
        {query.isError && (
          <div className="p-6 text-sm text-destructive">公告列表載入失敗</div>
        )}
        {query.data?.data.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            尚無公告
          </div>
        )}
        {query.data?.data.map((post) => (
          <div
            key={post.id}
            className="grid grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_7rem_10rem_8rem] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{post.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                建立者：{post.author_name}
              </div>
            </div>
            <span className="truncate">{post.publisher_unit}</span>
            <Badge
              variant={post.status === "published" ? "default" : "secondary"}
            >
              {statusLabel(post.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(post.updated_at).toLocaleString("zh-TW")}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewing(post)}
              >
                <Eye />
                預覽
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="編輯公告"
                onClick={() => {
                  setEditing(post)
                  setDialogOpen(true)
                }}
              >
                <Edit3 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <BulletinEditorDialog
        open={dialogOpen}
        post={editing}
        onOpenChange={setDialogOpen}
        onPostCreated={(post) => setEditing(post)}
      />
      <BulletinPreviewDialog
        post={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />
    </div>
  )
}
