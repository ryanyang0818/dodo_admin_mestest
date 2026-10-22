import type { TodoStatus, TodoTerm } from "@/client"

// 看板欄位順序與顯示標題
export const STATUS_COLUMNS: { status: TodoStatus; label: string }[] = [
  { status: "todo", label: "待辦" },
  { status: "doing", label: "進行中" },
  { status: "done", label: "完成" },
]

// 期限類別顯示標題與徽章顏色
export const TERM_META: Record<TodoTerm, { label: string; className: string }> =
  {
    long_term: {
      label: "長期",
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
    mid_term: {
      label: "中期",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    short_term: {
      label: "短期",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
    tomorrow: {
      label: "明天",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    uncategorized: {
      label: "未分類",
      className: "bg-muted text-muted-foreground",
    },
  }

// 期限類別的下拉選項順序
export const TERM_OPTIONS: TodoTerm[] = [
  "tomorrow",
  "short_term",
  "mid_term",
  "long_term",
  "uncategorized",
]
