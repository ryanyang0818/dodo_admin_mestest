import { Search, X } from "lucide-react"

import type { TodoTerm } from "@/client"
import { TERM_META, TERM_OPTIONS } from "@/components/Todos/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TodoFilters = {
  search: string
  term: TodoTerm | "all"
  tag: string | "all"
}

export const EMPTY_FILTERS: TodoFilters = {
  search: "",
  term: "all",
  tag: "all",
}

type TodoFilterBarProps = {
  filters: TodoFilters
  onChange: (filters: TodoFilters) => void
  availableTags: string[]
}

// 篩選列：文字搜尋 + 期限類別 + 標籤（純前端過濾，不打 API）
const TodoFilterBar = ({
  filters,
  onChange,
  availableTags,
}: TodoFilterBarProps) => {
  const hasActiveFilter =
    filters.search !== "" || filters.term !== "all" || filters.tag !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋內容…"
          className="pl-8"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Select
        value={filters.term}
        onValueChange={(term) =>
          onChange({ ...filters, term: term as TodoFilters["term"] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部期限</SelectItem>
          {TERM_OPTIONS.map((term) => (
            <SelectItem key={term} value={term}>
              {TERM_META[term].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {availableTags.length > 0 && (
        <Select
          value={filters.tag}
          onValueChange={(tag) => onChange({ ...filters, tag })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部標籤</SelectItem>
            {availableTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="mr-1 h-4 w-4" />
          清除
        </Button>
      )}

      {filters.term !== "all" && (
        <Badge
          className={TERM_META[filters.term].className}
          variant="secondary"
        >
          {TERM_META[filters.term].label}
        </Badge>
      )}
    </div>
  )
}

export default TodoFilterBar
