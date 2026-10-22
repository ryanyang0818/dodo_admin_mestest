import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarDays,
  GripVertical,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import { PageTodosService, type TodoPublic } from "@/client"
import { TERM_META } from "@/components/Todos/constants"
import TodoFormDialog from "@/components/Todos/TodoFormDialog"
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

type TodoCardProps = {
  todo: TodoPublic
}

// 卡片視覺內容（實際卡片與 DragOverlay 共用；不含拖曳與操作邏輯）
export const TodoCardBody = ({
  todo,
  actions,
}: {
  todo: TodoPublic
  actions?: ReactNode
}) => {
  const term = TERM_META[todo.term ?? "uncategorized"]

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap break-words line-clamp-4 flex-1">
          {todo.content}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {todo.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
          {actions}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge className={term.className} variant="secondary">
          {term.label}
        </Badge>
        {(todo.tags ?? []).map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
        {todo.due_date && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {todo.due_date}
          </span>
        )}
      </div>
    </>
  )
}

// 單張待辦卡片：可拖曳，含期限徽章、標籤、到期日與操作選單
const TodoCard = ({ todo }: TodoCardProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id })

  // 切換釘選狀態
  const pinMutation = useMutation({
    mutationFn: () =>
      PageTodosService.updateTodo({
        id: todo.id,
        requestBody: { is_pinned: !todo.is_pinned },
      }),
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
    },
  })

  // 刪除這張卡片
  const deleteMutation = useMutation({
    mutationFn: () => PageTodosService.deleteTodo({ id: todo.id }),
    onSuccess: () => {
      showSuccessToast("已刪除待辦")
      setDeleteOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
    },
  })

  return (
    <div
      ref={setNodeRef}
      data-testid="todo-card"
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition,
      }}
      className={`flex gap-2 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      {/* 拖曳把手：只有這裡能觸發拖曳，卡片其餘區域維持一般點擊行為 */}
      <button
        type="button"
        aria-label="拖曳排序"
        className="flex shrink-0 cursor-grab touch-none items-center self-stretch text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <TodoCardBody
          todo={todo}
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => pinMutation.mutate()}>
                  {todo.is_pinned ? (
                    <>
                      <PinOff className="mr-2 h-4 w-4" />
                      取消釘選
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 h-4 w-4" />
                      釘選
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  編輯
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  刪除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>

      <TodoFormDialog
        mode="edit"
        todo={todo}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>刪除待辦</DialogTitle>
            <DialogDescription>
              確定要刪除這筆待辦嗎？此動作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleteMutation.isPending}>
                取消
              </Button>
            </DialogClose>
            <LoadingButton
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              刪除
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TodoCard
