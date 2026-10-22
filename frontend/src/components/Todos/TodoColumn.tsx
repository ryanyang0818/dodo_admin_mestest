import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import type { TodoPublic, TodoStatus } from "@/client"
import TodoCard from "@/components/Todos/TodoCard"

type TodoColumnProps = {
  status: TodoStatus
  label: string
  todos: TodoPublic[]
}

// 單一狀態欄：欄標題 + 卡片數 + 可放置的卡片清單
const TodoColumn = ({ status, label, todos }: TodoColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` })

  return (
    <div
      className={`flex flex-col rounded-lg border-2 p-3 min-h-[200px] transition-colors ${
        isOver
          ? "border-primary bg-primary/5"
          : "border-transparent bg-muted/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">{todos.length}</span>
      </div>
      <SortableContext
        items={todos.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2">
          {todos.map((todo) => (
            <TodoCard key={todo.id} todo={todo} />
          ))}
          {todos.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              拖曳卡片到這裡
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default TodoColumn
