import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  PageTodosService,
  type TodoCreate,
  type TodoPublic,
  type TodoTerm,
} from "@/client"
import { TERM_META, TERM_OPTIONS } from "@/components/Todos/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const formSchema = z.object({
  content: z.string().min(1, { message: "內容必填" }).max(2000),
  term: z.enum([
    "long_term",
    "mid_term",
    "short_term",
    "tomorrow",
    "uncategorized",
  ]),
  due_date: z.string().optional(),
  tags: z.array(z.string()),
})

type FormData = z.infer<typeof formSchema>

type TodoFormDialogProps = {
  mode: "add" | "edit"
  todo?: TodoPublic
  // 獨立觸發（例如「新增待辦」按鈕）用 trigger；
  // 內嵌在其他選單/元件裡（例如卡片的下拉選單）改用 open/onOpenChange 外部控制開關
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// 依模式產生表單初始值：編輯帶入既有資料，新增給預設值
function getDefaultValues(todo?: TodoPublic): FormData {
  return {
    content: todo?.content ?? "",
    term: todo?.term ?? "uncategorized",
    due_date: todo?.due_date ?? "",
    tags: todo?.tags ?? [],
  }
}

// 新增/編輯共用的待辦表單對話框
const TodoFormDialog = ({
  mode,
  todo,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: TodoFormDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const isOpen = isControlled ? openProp : internalOpen
  const setIsOpen = isControlled
    ? (onOpenChangeProp ?? (() => {}))
    : setInternalOpen
  const [tagDraft, setTagDraft] = useState("")
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: getDefaultValues(todo),
  })

  const mutation = useMutation({
    mutationFn: (data: TodoCreate) =>
      mode === "add"
        ? PageTodosService.createTodo({ requestBody: data })
        : PageTodosService.updateTodo({
            id: todo?.id ?? "",
            requestBody: data,
          }),
    onSuccess: () => {
      showSuccessToast(mode === "add" ? "已新增待辦" : "已更新待辦")
      form.reset(getDefaultValues(mode === "add" ? undefined : todo))
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
    },
  })

  // 送出表單：空字串的到期日轉為 null
  const onSubmit = (data: FormData) => {
    mutation.mutate({
      content: data.content,
      term: data.term,
      due_date: data.due_date ? data.due_date : null,
      tags: data.tags,
    })
  }

  // 開關對話框：開啟時重設表單為當前資料（編輯模式帶最新值）
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      form.reset(getDefaultValues(todo))
      setTagDraft("")
    }
  }

  // 以 Enter 新增標籤，避免重複與空白
  const addTag = () => {
    const value = tagDraft.trim()
    if (!value) return
    const tags = form.getValues("tags")
    if (!tags.includes(value)) {
      form.setValue("tags", [...tags, value])
    }
    setTagDraft("")
  }

  // 移除指定標籤
  const removeTag = (tag: string) => {
    form.setValue(
      "tags",
      form.getValues("tags").filter((t) => t !== tag),
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "新增待辦" : "編輯待辦"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "記下任務內容，之後再發想討論。"
              : "調整這筆待辦的內容與分類。"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      內容 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="想到什麼就先記下來…"
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="term"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>期限類別</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TERM_OPTIONS.map((term: TodoTerm) => (
                            <SelectItem key={term} value={term}>
                              {TERM_META[term].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>到期日（選填）</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>標籤</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="輸入後按 Enter 新增標籤"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                      />
                    </FormControl>
                    {field.value.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {field.value.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                            <button
                              type="button"
                              className="ml-1"
                              onClick={() => removeTag(tag)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  取消
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                儲存
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default TodoFormDialog
