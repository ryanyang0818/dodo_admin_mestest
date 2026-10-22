import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  PageTodosService,
  type TodoPublic,
  type TodoStatus,
  type TodosPublic,
  type TodoUpdate,
} from "@/client"
import { STATUS_COLUMNS } from "@/components/Todos/constants"
import { TodoCardBody } from "@/components/Todos/TodoCard"
import TodoColumn from "@/components/Todos/TodoColumn"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

type TodoBoardProps = {
  todos: TodoPublic[]
}

// 欄內顯示排序：釘選優先，其次依 sort_order 升冪
function sortColumn(todos: TodoPublic[]): TodoPublic[] {
  return [...todos].sort((a, b) => {
    if ((a.is_pinned ? 1 : 0) !== (b.is_pinned ? 1 : 0)) {
      return a.is_pinned ? -1 : 1
    }
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

// 依插入位置的前後鄰居計算間隙排序值
function gapSortOrder(prev?: TodoPublic, next?: TodoPublic): number {
  if (prev && next) return ((prev.sort_order ?? 0) + (next.sort_order ?? 0)) / 2
  if (prev) return (prev.sort_order ?? 0) + 1
  if (next) return (next.sort_order ?? 0) - 1
  return 0
}

// Kanban 看板：三個狀態欄 + 拖曳結算（每次拖曳僅更新一筆）
const TodoBoard = ({ todos }: TodoBoardProps) => {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const [activeId, setActiveId] = useState<string | null>(null)

  // 滑鼠移動超過 8px 才視為拖曳（拖曳把手已獨立，此處主要防止手震誤觸）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : undefined

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const columns = STATUS_COLUMNS.map(({ status, label }) => ({
    status,
    label,
    todos: sortColumn(todos.filter((t) => (t.status ?? "todo") === status)),
  }))

  // 拖曳更新：optimistic 先改快取，失敗回滾
  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TodoUpdate }) =>
      PageTodosService.updateTodo({ id, requestBody: data }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] })
      const previous = queryClient.getQueryData<TodosPublic>(["todos"])
      queryClient.setQueryData<TodosPublic>(["todos"], (old) =>
        old
          ? {
              ...old,
              data: old.data.map((t) =>
                t.id === id ? ({ ...t, ...data } as TodoPublic) : t,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["todos"], context.previous)
      }
      handleError.call(showErrorToast, err as never)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
    },
  })

  // 拖曳結束：定位目標欄與插入點，計算間隙 sort_order 後送單筆更新
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeTodo = todos.find((t) => t.id === active.id)
    if (!activeTodo) return

    let targetStatus: TodoStatus
    let insertIndex: number

    const overId = String(over.id)
    if (overId.startsWith("column-")) {
      // 放到欄位空白處：附加到該欄最後
      targetStatus = overId.replace("column-", "") as TodoStatus
      insertIndex = Number.POSITIVE_INFINITY
    } else {
      // 放到某張卡片上：插入該卡片目前的位置
      const overTodo = todos.find((t) => t.id === overId)
      if (!overTodo || overTodo.id === activeTodo.id) return
      targetStatus = overTodo.status ?? "todo"
      const column = sortColumn(
        todos.filter(
          (t) =>
            (t.status ?? "todo") === targetStatus && t.id !== activeTodo.id,
        ),
      )
      insertIndex = column.findIndex((t) => t.id === overTodo.id)
      // 同欄往下拖時，插入點應在目標卡片之後
      if (
        (activeTodo.status ?? "todo") === targetStatus &&
        (activeTodo.sort_order ?? 0) < (overTodo.sort_order ?? 0)
      ) {
        insertIndex += 1
      }
    }

    const column = sortColumn(
      todos.filter(
        (t) => (t.status ?? "todo") === targetStatus && t.id !== activeTodo.id,
      ),
    )
    const index = Math.min(insertIndex, column.length)
    const newSortOrder = gapSortOrder(column[index - 1], column[index])

    const changedStatus = (activeTodo.status ?? "todo") !== targetStatus
    const changedOrder = newSortOrder !== (activeTodo.sort_order ?? 0)
    if (!changedStatus && !changedOrder) return

    mutation.mutate({
      id: activeTodo.id,
      data: { status: targetStatus, sort_order: newSortOrder },
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map(({ status, label, todos: columnTodos }) => (
          <TodoColumn
            key={status}
            status={status}
            label={label}
            todos={columnTodos}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTodo && (
          <div className="w-[280px] cursor-grabbing rounded-md border bg-card p-3 shadow-lg">
            <TodoCardBody todo={activeTodo} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default TodoBoard
