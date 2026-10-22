import { useSuspenseQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { PageTodosService } from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import PendingItems from "@/components/Pending/PendingItems"
import TodoBoard from "@/components/Todos/TodoBoard"
import TodoFilterBar, {
  EMPTY_FILTERS,
  type TodoFilters,
} from "@/components/Todos/TodoFilterBar"
import TodoFormDialog from "@/components/Todos/TodoFormDialog"
import { Button } from "@/components/ui/button"

// 取得 Todos 列表查詢設定
function getTodosQueryOptions() {
  return {
    queryFn: () => PageTodosService.readTodos({ skip: 0, limit: 500 }),
    queryKey: ["todos"],
  }
}

// 看板內容：載入資料並套用前端篩選
function TodosBoardContent({ filters }: { filters: TodoFilters }) {
  const { data: todos } = useSuspenseQuery(getTodosQueryOptions())

  // 依搜尋文字、期限類別、標籤過濾（純前端）
  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase()
    return todos.data.filter((todo) => {
      if (keyword && !todo.content.toLowerCase().includes(keyword)) return false
      if (
        filters.term !== "all" &&
        (todo.term ?? "uncategorized") !== filters.term
      )
        return false
      if (filters.tag !== "all" && !(todo.tags ?? []).includes(filters.tag))
        return false
      return true
    })
  }, [todos.data, filters])

  return <TodoBoard todos={filtered} />
}

// 篩選列包裝：從快取資料彙整可用標籤清單
function TodosFilterSection({
  filters,
  onChange,
}: {
  filters: TodoFilters
  onChange: (filters: TodoFilters) => void
}) {
  const { data: todos } = useSuspenseQuery(getTodosQueryOptions())

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    for (const todo of todos.data) {
      for (const tag of todo.tags ?? []) tags.add(tag)
    }
    return [...tags].sort()
  }, [todos.data])

  return (
    <TodoFilterBar
      filters={filters}
      onChange={onChange}
      availableTags={availableTags}
    />
  )
}

// 待辦看板頁籤入口（狀態驅動頁籤直接 render）
export function TodosView() {
  const [filters, setFilters] = useState<TodoFilters>(EMPTY_FILTERS)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        tabKey="todos"
        title="待辦事項"
        description="記錄長期、中期、短期與明天的任務，拖曳卡片推進進度"
      />
      <div className="flex justify-end">
        <TodoFormDialog
          mode="add"
          trigger={
            <Button>
              <Plus className="mr-2" />
              新增待辦
            </Button>
          }
        />
      </div>

      <Suspense fallback={<PendingItems />}>
        <TodosFilterSection filters={filters} onChange={setFilters} />
        <TodosBoardContent filters={filters} />
      </Suspense>
    </div>
  )
}
