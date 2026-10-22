import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  Filter,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  type MenuCreate,
  type MenuPublic,
  PageSystemMenusService,
} from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useCustomToast from "@/hooks/useCustomToast"
import { visibleMenuTreeQueryKey } from "@/hooks/useVisibleMenuTree"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

import {
  dodoCrudV2Config,
  type MenusCRUDV2FieldKey,
} from "./dodo-crud-v2.config"

type MenuRow = MenuPublic
type MenuMap = Map<string, MenuRow>
type EditorState = { mode: "create" } | { mode: "update"; row: MenuRow }
type FormState = {
  key: string
  label: string
  path: string
  parent_id: string
  sort_order: string
  icon: string
  is_active: boolean
  is_visible: boolean
  access_policy: string
}
type FilterOption = { label: string; value: string | boolean }
type SavedState = {
  columnFilters?: ColumnFiltersState
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  pageSize?: number
}

const QUERY_KEY = [dodoCrudV2Config.menuKey]
const STORAGE_KEY = `dodo-crud-v2:${dodoCrudV2Config.menuKey}:v1`
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const API_PAGE_SIZE = 100
const PANEL_DEFAULT_WIDTH = 800
const PANEL_MIN_WIDTH = 360
const ROOT_FILTER_VALUE = "__root__"
const MENU_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const fieldEntries = Object.entries(dodoCrudV2Config.fields) as Array<
  [MenusCRUDV2FieldKey, (typeof dodoCrudV2Config.fields)[MenusCRUDV2FieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)

// 讀取已保存的欄位與分頁設定
function readSavedState(): SavedState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

// 合併已保存與目前設定的欄位順序
function normalizeColumnOrder(savedOrder?: ColumnOrderState): ColumnOrderState {
  const validKeys = new Set<string>(defaultColumnOrder)
  const savedKeys = (savedOrder ?? []).filter(
    (key, index, values) => validKeys.has(key) && values.indexOf(key) === index,
  )
  return [
    ...savedKeys,
    ...defaultColumnOrder.filter((key) => !savedKeys.includes(key)),
  ]
}

// 分批讀取全部 Menu，供前端報表操作
async function readAllMenus(): Promise<MenuRow[]> {
  const firstPage = await PageSystemMenusService.readMenus({
    skip: 0,
    limit: API_PAGE_SIZE,
  })
  const data = [...firstPage.data]
  while (data.length < firstPage.count) {
    const nextPage = await PageSystemMenusService.readMenus({
      skip: data.length,
      limit: API_PAGE_SIZE,
    })
    if (!nextPage.data.length) break
    data.push(...nextPage.data)
  }
  return data
}

// 格式化台北時區日期時間
function formatDateTime(value: unknown, emptyText: string): string {
  if (!value) return emptyText
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return emptyText
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

// 取得父選單的可讀名稱
function getParentLabel(value: unknown, menuById: MenuMap): string {
  if (!value) return dodoCrudV2Config.fields.parent_id.emptyText
  const parent = menuById.get(String(value))
  return parent ? `${parent.label}（${parent.key}）` : String(value)
}

// 依欄位設定格式化顯示值
function formatFieldValue(
  key: MenusCRUDV2FieldKey,
  value: unknown,
  menuById: MenuMap,
): string {
  const field = dodoCrudV2Config.fields[key]
  if (key === "parent_id") return getParentLabel(value, menuById)
  if (value === null || value === undefined || value === "")
    return field.emptyText
  const option = (field.options as readonly FilterOption[]).find(
    (item) => String(item.value) === String(value),
  )
  if (option) return option.label
  if (field.format === "datetime") return formatDateTime(value, field.emptyText)
  if (field.format === "boolean") return value ? "是" : "否"
  if (field.format === "number") return Number(value).toLocaleString("zh-TW")
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

// 匯出目前篩選與排序後的完整結果
function downloadCsv(rows: MenuRow[], menuById: MenuMap): void {
  const exportFields = fieldEntries.filter(([, field]) => field.exportable)
  const lines = [
    exportFields.map(([, field]) => escapeCsv(field.label)).join(","),
    ...rows.map((row) =>
      exportFields
        .map(([key]) => escapeCsv(formatFieldValue(key, row[key], menuById)))
        .join(","),
    ),
  ]
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    }),
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${dodoCrudV2Config.reportTitle}-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// 建立新增或修改表單預設值
function getFormState(editor: EditorState | null): FormState {
  if (editor?.mode === "update") {
    return {
      key: editor.row.key,
      label: editor.row.label,
      path: editor.row.path ?? "",
      parent_id: editor.row.parent_id ?? "",
      sort_order: String(editor.row.sort_order ?? 0),
      icon: editor.row.icon ?? "",
      is_active: editor.row.is_active ?? true,
      is_visible: editor.row.is_visible ?? true,
      access_policy: editor.row.access_policy ?? "role",
    }
  }
  return {
    key: "",
    label: "",
    path: "",
    parent_id: "",
    sort_order: "0",
    icon: "",
    is_active: true,
    is_visible: true,
    access_policy: "role",
  }
}

// 驗證並轉換表單內容
function toPayload(form: FormState): MenuCreate {
  const key = form.key.trim()
  const label = form.label.trim()
  const path = form.path.trim()
  const sortOrder = Number(form.sort_order)
  if (!key || !MENU_KEY_PATTERN.test(key))
    throw new Error("Menu Key 僅能使用小寫英數與點、底線或連字號")
  if (!label) throw new Error("請輸入選單名稱")
  if (path && !path.startsWith("/")) throw new Error("路徑必須以 / 開頭")
  if (!Number.isInteger(sortOrder) || sortOrder < 0)
    throw new Error("排序必須是大於或等於 0 的整數")
  if (!["role", "authenticated"].includes(form.access_policy))
    throw new Error("請選擇有效的存取策略")
  return {
    key,
    label,
    path: path || null,
    parent_id: form.parent_id || null,
    sort_order: sortOrder,
    icon: form.icon.trim() || null,
    is_active: form.is_active,
    is_visible: form.is_visible,
    access_policy: form.access_policy,
  }
}

// 找出指定 Menu 的所有子孫 ID
function getDescendantIds(menus: MenuRow[], rootId: string): Set<string> {
  // ponytail: 目前僅 50 筆，使用簡單掃描；規模顯著增長時再改 adjacency map。
  const descendants = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const menu of menus) {
      if (
        menu.parent_id &&
        (menu.parent_id === rootId || descendants.has(menu.parent_id)) &&
        !descendants.has(menu.id)
      ) {
        descendants.add(menu.id)
        changed = true
      }
    }
  }
  return descendants
}

// 依欄位篩選型別比對資料
function filterFieldValue(
  key: MenusCRUDV2FieldKey,
  rawValue: unknown,
  filterValue: unknown,
  menuById: MenuMap,
): boolean {
  const field = dodoCrudV2Config.fields[key]
  if (key === "parent_id" && filterValue === ROOT_FILTER_VALUE) return !rawValue
  if (field.filterType === "boolean" || field.filterType === "select")
    return String(rawValue) === String(filterValue)
  if (field.filterType === "date-range") {
    const [from, to] = filterValue as [string, string]
    const value = String(rawValue ?? "").slice(0, 10)
    return (!from || value >= from) && (!to || value <= to)
  }
  if (field.filterType === "number-range") {
    const [minimum, maximum] = filterValue as [string, string]
    const value = Number(rawValue)
    return (
      (!minimum || value >= Number(minimum)) &&
      (!maximum || value <= Number(maximum))
    )
  }
  return formatFieldValue(key, rawValue, menuById)
    .toLocaleLowerCase("zh-TW")
    .includes(String(filterValue).toLocaleLowerCase("zh-TW"))
}

// 選單管理 Report Studio 等級 CRUD 頁面
export function MenusCRUDV2() {
  const hostRef = useRef<HTMLElement>(null)
  const pageHeaderRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  )
  const hasDraggedRef = useRef(false)
  const savedState = useMemo(readSavedState, [])
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    dodoCrudV2Config.enableFilters ? (savedState.columnFilters ?? []) : [],
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...defaultVisibility,
    ...(dodoCrudV2Config.enableColumnVisibility
      ? savedState.columnVisibility
      : {}),
  })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    dodoCrudV2Config.enableColumnOrder
      ? normalizeColumnOrder(savedState.columnOrder)
      : defaultColumnOrder,
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: savedState.pageSize ?? 25,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [form, setForm] = useState<FormState>(getFormState(null))
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTop, setPanelTop] = useState(0)
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const listQuery = useQuery({ queryKey: QUERY_KEY, queryFn: readAllMenus })
  const data = listQuery.data ?? []
  const menuById = useMemo(
    () => new Map(data.map((menu) => [menu.id, menu])),
    [data],
  )

  // 同步刷新管理列表與 Sidebar 選單樹
  const invalidateMenus = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: visibleMenuTreeQueryKey }),
      ]),
    [queryClient],
  )

  // 關閉編輯面板並等待動畫完成
  const closeEditor = useCallback(() => {
    setPanelOpen(false)
    window.setTimeout(() => setEditor(null), 200)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async ({
      state,
      payload,
    }: {
      state: EditorState
      payload: MenuCreate
    }) => {
      if (state.mode === "create")
        return PageSystemMenusService.createMenu({ requestBody: payload })
      return PageSystemMenusService.updateMenu({
        id: state.row.id,
        requestBody: payload,
      })
    },
    onSuccess: () => {
      showSuccessToast("選單已儲存")
      closeEditor()
      setRowSelection({})
    },
    onError: handleError.bind(showErrorToast),
    onSettled: invalidateMenus,
  })

  const deleteMutation = useMutation({
    mutationFn: (row: MenuRow) =>
      PageSystemMenusService.deleteMenu({ id: row.id }),
    onSuccess: () => {
      showSuccessToast("選單已刪除")
      setRowSelection({})
    },
    onError: handleError.bind(showErrorToast),
    onSettled: invalidateMenus,
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (rows: MenuRow[]) => {
      const results = await Promise.allSettled(
        rows.map((row) => PageSystemMenusService.deleteMenu({ id: row.id })),
      )
      return {
        successCount: results.filter((result) => result.status === "fulfilled")
          .length,
        failureCount: results.filter((result) => result.status === "rejected")
          .length,
      }
    },
    onSuccess: ({ successCount, failureCount }) => {
      if (successCount) showSuccessToast(`已刪除 ${successCount} 筆選單`)
      if (failureCount)
        showErrorToast(`${failureCount} 筆選單因階層或權限引用無法刪除`)
      setRowSelection({})
    },
    onSettled: invalidateMenus,
  })

  // 開啟新增或修改面板
  const openEditor = useCallback((state: EditorState) => {
    setEditor(state)
    setForm(getFormState(state))
  }, [])

  // 確認後刪除單筆 Menu
  const requestDelete = useCallback(
    (row: MenuRow) => {
      if (
        !window.confirm(
          `確定刪除「${row.label}（${row.key}）」？有子選單或權限引用時，後端會拒絕刪除。`,
        )
      )
        return
      deleteMutation.mutate(row)
    },
    [deleteMutation],
  )

  // 確認後逐筆呼叫既有 Delete API
  const requestBatchDelete = useCallback(
    (rows: MenuRow[]) => {
      if (
        !rows.length ||
        !window.confirm(`確定刪除選取的 ${rows.length} 筆選單？`)
      )
        return
      batchDeleteMutation.mutate(rows)
    },
    [batchDeleteMutation],
  )

  useEffect(() => {
    if (!editor) return
    const id = requestAnimationFrame(() => setPanelOpen(true))
    return () => cancelAnimationFrame(id)
  }, [editor])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        columnFilters: dodoCrudV2Config.enableFilters ? columnFilters : [],
        columnOrder: dodoCrudV2Config.enableColumnOrder
          ? columnOrder
          : defaultColumnOrder,
        columnVisibility: dodoCrudV2Config.enableColumnVisibility
          ? columnVisibility
          : defaultVisibility,
        pageSize: dodoCrudV2Config.enablePagination
          ? pagination.pageSize
          : undefined,
      }),
    )
  }, [columnFilters, columnOrder, columnVisibility, pagination.pageSize])

  useEffect(() => {
    if (!editor) return
    const onKeyDown = (event: KeyboardEvent) =>
      event.key === "Escape" && closeEditor()
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [editor, closeEditor])

  useLayoutEffect(() => {
    if (!editor || !pageHeaderRef.current) return
    const pageHeader = pageHeaderRef.current
    const updatePanelTop = () =>
      setPanelTop(pageHeader.getBoundingClientRect().bottom)
    updatePanelTop()
    const observer = new ResizeObserver(updatePanelTop)
    observer.observe(pageHeader)
    window.addEventListener("resize", updatePanelTop)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updatePanelTop)
    }
  }, [editor])

  // 切換面板最小與一般寬度
  const togglePanelWidth = useCallback(() => {
    const maxWidth = hostRef.current?.clientWidth ?? PANEL_DEFAULT_WIDTH
    setPanelWidth((width) =>
      width <= PANEL_MIN_WIDTH
        ? Math.min(PANEL_DEFAULT_WIDTH, maxWidth)
        : PANEL_MIN_WIDTH,
    )
  }, [])

  // 開始拖曳面板邊線
  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    hasDraggedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = { startX: event.clientX, startWidth: panelWidth }
  }

  // 拖曳時更新面板寬度
  const handleResizeMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current
    if (!drag) return
    if (Math.abs(event.clientX - drag.startX) > 2) hasDraggedRef.current = true
    const maxWidth = Math.max(
      PANEL_MIN_WIDTH,
      hostRef.current?.clientWidth ?? PANEL_DEFAULT_WIDTH,
    )
    setPanelWidth(
      Math.min(
        maxWidth,
        Math.max(
          PANEL_MIN_WIDTH,
          drag.startWidth + drag.startX - event.clientX,
        ),
      ),
    )
  }

  // 結束面板寬度拖曳
  const handleResizeEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    dragStateRef.current = null
  }

  // 點擊邊線切換寬度，拖曳完成後不重複觸發
  const handleResizeClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false
      return
    }
    togglePanelWidth()
  }

  // 送出新增或修改內容
  const submitForm = (event: FormEvent) => {
    event.preventDefault()
    if (!editor) return
    try {
      saveMutation.mutate({ state: editor, payload: toPayload(form) })
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "表單資料不正確")
    }
  }

  const dataColumns = fieldEntries.map(
    ([key, field]): ColumnDef<MenuRow> => ({
      id: key,
      accessorKey: key,
      size: field.width,
      enableSorting: dodoCrudV2Config.enableSorting && field.sortable,
      enableColumnFilter: dodoCrudV2Config.enableFilters && field.filterable,
      filterFn: (row, columnId, value) =>
        filterFieldValue(key, row.getValue(columnId), value, menuById),
      sortingFn: (rowA, rowB, columnId) =>
        formatFieldValue(key, rowA.getValue(columnId), menuById).localeCompare(
          formatFieldValue(key, rowB.getValue(columnId), menuById),
          "zh-TW",
          { numeric: true },
        ),
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 h-8"
          disabled={!column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {field.label}
          {column.getCanSort() && <ArrowUpDown className="ml-1 size-3.5" />}
        </Button>
      ),
      cell: ({ getValue }) => {
        const value = getValue()
        if (field.format === "boolean")
          return (
            <Badge variant={value ? "default" : "outline"}>
              {formatFieldValue(key, value, menuById)}
            </Badge>
          )
        return (
          <span className="whitespace-normal">
            {formatFieldValue(key, value, menuById)}
          </span>
        )
      },
    }),
  )

  const columns: ColumnDef<MenuRow>[] = [
    ...(dodoCrudV2Config.enableUpdate ||
    dodoCrudV2Config.enableDelete ||
    dodoCrudV2Config.enableBatchDelete
      ? [
          {
            id: "select",
            header: ({ table }) => (
              <Checkbox
                aria-label="選取本頁全部"
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(Boolean(value))
                }
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                aria-label={`選取 ${row.original.label}`}
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
              />
            ),
            enableHiding: false,
            enableSorting: false,
          } satisfies ColumnDef<MenuRow>,
        ]
      : []),
    ...dataColumns,
    ...(dodoCrudV2Config.enableUpdate || dodoCrudV2Config.enableDelete
      ? [
          {
            id: "actions",
            header: "操作",
            cell: ({ row }) => (
              <div className="flex items-center">
                {dodoCrudV2Config.enableUpdate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`修改 ${row.original.label}`}
                    disabled={saveMutation.isPending}
                    onClick={() =>
                      openEditor({ mode: "update", row: row.original })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                {dodoCrudV2Config.enableDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`刪除 ${row.original.label}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => requestDelete(row.original)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ),
            enableHiding: false,
            enableSorting: false,
          } satisfies ColumnDef<MenuRow>,
        ]
      : []),
  ]

  const resolvedColumnOrder = [
    ...(dodoCrudV2Config.enableUpdate ||
    dodoCrudV2Config.enableDelete ||
    dodoCrudV2Config.enableBatchDelete
      ? ["select"]
      : []),
    ...columnOrder,
    ...(dodoCrudV2Config.enableUpdate || dodoCrudV2Config.enableDelete
      ? ["actions"]
      : []),
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder: resolvedColumnOrder,
      pagination,
      rowSelection,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: dodoCrudV2Config.enablePagination
      ? getPaginationRowModel()
      : undefined,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLocaleLowerCase("zh-TW")
      return fieldEntries.some(
        ([key, field]) =>
          field.filterable &&
          formatFieldValue(key, row.original[key], menuById)
            .toLocaleLowerCase("zh-TW")
            .includes(query),
      )
    },
  })

  const filteredRows = table.getSortedRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows
  const selectedRow =
    selectedRows.length === 1 ? selectedRows[0].original : null
  const excludedParentIds = useMemo(() => {
    if (editor?.mode !== "update") return new Set<string>()
    return new Set([editor.row.id, ...getDescendantIds(data, editor.row.id)])
  }, [data, editor])
  const parentOptions = useMemo(
    () =>
      data
        .filter((menu) => !excludedParentIds.has(menu.id))
        .sort((left, right) =>
          `${left.label}${left.key}`.localeCompare(
            `${right.label}${right.key}`,
            "zh-TW",
          ),
        ),
    [data, excludedParentIds],
  )

  // 左右移動資料欄位
  function moveColumn(columnId: string, offset: -1 | 1) {
    const index = columnOrder.indexOf(columnId)
    const nextIndex = index + offset
    if (index < 0 || nextIndex < 0 || nextIndex >= columnOrder.length) return
    const next = [...columnOrder]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setColumnOrder(next)
  }

  // 取得設定或資料推導出的篩選選項
  function getFilterOptions(key: MenusCRUDV2FieldKey): FilterOption[] {
    if (key === "parent_id")
      return [
        { label: "Root", value: ROOT_FILTER_VALUE },
        ...data.map((menu) => ({
          label: `${menu.label}（${menu.key}）`,
          value: menu.id,
        })),
      ]
    const configured = dodoCrudV2Config.fields[key]
      .options as readonly FilterOption[]
    if (configured.length) return [...configured]
    const values = data
      .map((row) => row[key])
      .filter((value) => value !== null && value !== undefined && value !== "")
    return [...new Set(values.map(String))]
      .sort()
      .map((value) => ({ label: value, value }))
  }

  // 依欄位設定呈現篩選控制項
  function renderFilterControl(key: MenusCRUDV2FieldKey) {
    const field = dodoCrudV2Config.fields[key]
    const column = table.getColumn(key)
    if (!column?.getCanFilter()) return null
    if (field.filterType === "boolean" || field.filterType === "select") {
      return (
        <label key={key} className="space-y-1 text-xs">
          {field.label}
          <select
            aria-label={`篩選${field.label}`}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={String(column.getFilterValue() ?? "")}
            onChange={(event) => {
              const selected = getFilterOptions(key).find(
                (option) => String(option.value) === event.target.value,
              )
              column.setFilterValue(
                event.target.value ? selected?.value : undefined,
              )
              table.setPageIndex(0)
            }}
          >
            <option value="">全部</option>
            {getFilterOptions(key).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )
    }
    if (
      field.filterType === "date-range" ||
      field.filterType === "number-range"
    ) {
      const value = (column.getFilterValue() as
        | [string, string]
        | undefined) ?? ["", ""]
      const inputType = field.filterType === "date-range" ? "date" : "number"
      return (
        <fieldset key={key} className="space-y-1">
          <legend className="text-xs">{field.label}</legend>
          <div className="flex items-center gap-1">
            <Input
              type={inputType}
              aria-label={`${field.label}起始值`}
              className="h-9 min-w-0"
              value={value[0]}
              onChange={(event) => {
                const next: [string, string] = [event.target.value, value[1]]
                column.setFilterValue(next.some(Boolean) ? next : undefined)
                table.setPageIndex(0)
              }}
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type={inputType}
              aria-label={`${field.label}結束值`}
              className="h-9 min-w-0"
              value={value[1]}
              onChange={(event) => {
                const next: [string, string] = [value[0], event.target.value]
                column.setFilterValue(next.some(Boolean) ? next : undefined)
                table.setPageIndex(0)
              }}
            />
          </div>
        </fieldset>
      )
    }
    const controlId = `menus-filter-${key}`
    return (
      <label key={key} htmlFor={controlId} className="space-y-1 text-xs">
        {field.label}
        <Input
          id={controlId}
          aria-label={`篩選${field.label}`}
          placeholder={field.placeholder || `篩選${field.label}`}
          className="h-9"
          value={String(column.getFilterValue() ?? "")}
          onChange={(event) => {
            column.setFilterValue(event.target.value || undefined)
            table.setPageIndex(0)
          }}
        />
      </label>
    )
  }

  return (
    <section ref={hostRef} className="flex min-h-0 flex-1 flex-col gap-4">
      <div ref={pageHeaderRef}>
        <PageHeader
          tabKey={dodoCrudV2Config.menuKey}
          title={dodoCrudV2Config.reportTitle}
          description={dodoCrudV2Config.reportDescription}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dodoCrudV2Config.enableCreate && (
          <Button type="button" onClick={() => openEditor({ mode: "create" })}>
            <Plus className="size-4" />
            新增
          </Button>
        )}
        {dodoCrudV2Config.enableUpdate && (
          <Button
            type="button"
            variant="outline"
            disabled={!selectedRow || saveMutation.isPending}
            onClick={() =>
              selectedRow && openEditor({ mode: "update", row: selectedRow })
            }
          >
            <Pencil className="size-4" />
            修改
          </Button>
        )}
        {dodoCrudV2Config.enableDelete && (
          <Button
            type="button"
            variant="destructive"
            disabled={!selectedRow || deleteMutation.isPending}
            onClick={() => selectedRow && requestDelete(selectedRow)}
          >
            <Trash2 className="size-4" />
            刪除
          </Button>
        )}
        {dodoCrudV2Config.enableBatchDelete && (
          <Button
            type="button"
            variant="destructive"
            disabled={!selectedRows.length || batchDeleteMutation.isPending}
            onClick={() =>
              requestBatchDelete(selectedRows.map((row) => row.original))
            }
          >
            <Trash2 className="size-4" />
            批次刪除
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href="/docs/all-icons.html" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            圖示
          </a>
        </Button>
        {dodoCrudV2Config.enableGlobalSearch && (
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜尋選單"
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value)
                table.setPageIndex(0)
              }}
              placeholder="搜尋可篩選欄位…"
              className="h-9 w-64 pl-8"
            />
          </div>
        )}
        {dodoCrudV2Config.enableFilters && (
          <Button
            type="button"
            variant={columnFilters.length ? "secondary" : "outline"}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter className="size-4" />
            篩選{columnFilters.length ? ` ${columnFilters.length}` : ""}
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {filteredRows.length} / {data.length} 筆
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="重新整理"
          disabled={listQuery.isFetching}
          onClick={() => listQuery.refetch()}
        >
          <RefreshCw
            className={cn("size-4", listQuery.isFetching && "animate-spin")}
          />
        </Button>
        {(dodoCrudV2Config.enableColumnVisibility ||
          dodoCrudV2Config.enableColumnOrder) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="欄位設定"
              >
                <Settings2 className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder.map((columnId, index) => {
                const column = table.getColumn(columnId)
                if (!column) return null
                const field =
                  dodoCrudV2Config.fields[columnId as MenusCRUDV2FieldKey]
                return (
                  <div key={columnId} className="flex items-center">
                    {dodoCrudV2Config.enableColumnVisibility ? (
                      <DropdownMenuCheckboxItem
                        className="min-w-0 flex-1"
                        checked={column.getIsVisible()}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(Boolean(value))
                        }
                      >
                        {field.label}
                      </DropdownMenuCheckboxItem>
                    ) : (
                      <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm">
                        {field.label}
                      </span>
                    )}
                    {dodoCrudV2Config.enableColumnOrder && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`向左移動${field.label}`}
                          disabled={index === 0}
                          onClick={() => moveColumn(columnId, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`向右移動${field.label}`}
                          disabled={index === columnOrder.length - 1}
                          onClick={() => moveColumn(columnId, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {dodoCrudV2Config.enableExport && (
          <Button
            type="button"
            variant="outline"
            disabled={!filteredRows.length}
            onClick={() =>
              downloadCsv(
                filteredRows.map((row) => row.original),
                menuById,
              )
            }
          >
            <Download className="size-4" />
            匯出
          </Button>
        )}
      </div>

      {dodoCrudV2Config.enableFilters && filtersOpen && (
        <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {fieldEntries.map(([key]) => renderFilterControl(key))}
          {columnFilters.length > 0 && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setColumnFilters([])
                  table.setPageIndex(0)
                }}
              >
                清除篩選
              </Button>
            </div>
          )}
        </div>
      )}

      {listQuery.isPending && (
        <div className="rounded-md border py-12 text-center text-muted-foreground">
          載入選單中…
        </div>
      )}
      {listQuery.isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 py-12 text-center text-destructive"
        >
          選單載入失敗。
        </div>
      )}
      {listQuery.isSuccess && !data.length && (
        <div className="rounded-md border py-12 text-center text-muted-foreground">
          目前沒有選單。
        </div>
      )}
      {listQuery.isSuccess && data.length > 0 && (
        <div
          className="min-h-0 flex-1 overflow-auto rounded-md border"
          data-testid="menus-crud-v2-table"
        >
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className="sticky top-0 z-20 bg-background">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-1.5"
                      style={{
                        width: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dodoCrudV2Config.enablePagination &&
        listQuery.isSuccess &&
        data.length > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              第 {pagination.pageIndex + 1} /{" "}
              {Math.max(table.getPageCount(), 1)} 頁
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="menus-crud-v2-page-size">每頁</label>
              <select
                id="menus-crud-v2-page-size"
                className="h-8 rounded-md border bg-background px-2"
                value={pagination.pageSize}
                onChange={(event) =>
                  table.setPageSize(Number(event.target.value))
                }
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                上一頁
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                下一頁
              </Button>
            </div>
          </div>
        )}

      {editor && (
        <div
          className="fixed right-0 bottom-[var(--app-footer-layout-height)] z-30 flex border-l bg-background shadow-xl transition-[width,transform] duration-200 ease-out"
          style={{
            width: panelWidth,
            top: panelTop,
            transform: panelOpen ? "translateX(0)" : "translateX(100%)",
          }}
        >
          <button
            type="button"
            aria-label="點擊切換或拖曳調整面板寬度"
            onClick={handleResizeClick}
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="group relative w-4 shrink-0 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-border hover:bg-primary/10 hover:after:bg-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-primary/20"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  panelWidth <= PANEL_MIN_WIDTH
                    ? "展開編輯面板"
                    : "縮小編輯面板"
                }
                onClick={togglePanelWidth}
              >
                {panelWidth <= PANEL_MIN_WIDTH ? (
                  <PanelRightOpen className="size-4" />
                ) : (
                  <PanelRightClose className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="關閉編輯面板"
                onClick={closeEditor}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="border-b px-4 py-4">
              <h2 className="font-semibold">
                {editor.mode === "create" ? "新增選單" : "修改選單"}
              </h2>
              <p className="text-xs text-muted-foreground">
                維護 Sidebar 階層、路徑、顯示狀態與存取策略。
              </p>
            </div>
            <form
              onSubmit={submitForm}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-2">
                <label htmlFor="menu-v2-label" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.label.label}{" "}
                  <span className="text-destructive">*</span>
                  <Input
                    id="menu-v2-label"
                    autoFocus
                    required={dodoCrudV2Config.fields.label.required}
                    maxLength={100}
                    value={form.label}
                    placeholder={dodoCrudV2Config.fields.label.placeholder}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        label: event.target.value,
                      }))
                    }
                  />
                </label>
                <label htmlFor="menu-v2-key" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.key.label}{" "}
                  <span className="text-destructive">*</span>
                  <Input
                    id="menu-v2-key"
                    required={dodoCrudV2Config.fields.key.required}
                    maxLength={100}
                    value={form.key}
                    placeholder={dodoCrudV2Config.fields.key.placeholder}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        key: event.target.value,
                      }))
                    }
                  />
                </label>
                <label htmlFor="menu-v2-parent" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.parent_id.label}
                  <select
                    id="menu-v2-parent"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.parent_id}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        parent_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Root</option>
                    {parentOptions.map((menu) => (
                      <option key={menu.id} value={menu.id}>
                        {menu.label}（{menu.key}）
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="menu-v2-sort" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.sort_order.label}{" "}
                  <span className="text-destructive">*</span>
                  <Input
                    id="menu-v2-sort"
                    required={dodoCrudV2Config.fields.sort_order.required}
                    type="number"
                    min="0"
                    step="1"
                    value={form.sort_order}
                    placeholder={dodoCrudV2Config.fields.sort_order.placeholder}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        sort_order: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  htmlFor="menu-v2-path"
                  className="space-y-1 text-sm sm:col-span-2"
                >
                  {dodoCrudV2Config.fields.path.label}
                  <Input
                    id="menu-v2-path"
                    maxLength={255}
                    value={form.path}
                    placeholder={dodoCrudV2Config.fields.path.placeholder}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        path: event.target.value,
                      }))
                    }
                  />
                </label>
                <label htmlFor="menu-v2-icon" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.icon.label}
                  <Input
                    id="menu-v2-icon"
                    maxLength={100}
                    value={form.icon}
                    placeholder={dodoCrudV2Config.fields.icon.placeholder}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        icon: event.target.value,
                      }))
                    }
                  />
                </label>
                <label htmlFor="menu-v2-policy" className="space-y-1 text-sm">
                  {dodoCrudV2Config.fields.access_policy.label}{" "}
                  <span className="text-destructive">*</span>
                  <select
                    id="menu-v2-policy"
                    required={dodoCrudV2Config.fields.access_policy.required}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.access_policy}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        access_policy: event.target.value,
                      }))
                    }
                  >
                    {dodoCrudV2Config.fields.access_policy.options.map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <Checkbox
                    id="menu-v2-active"
                    checked={form.is_active}
                    onCheckedChange={(value) =>
                      setForm((formValue) => ({
                        ...formValue,
                        is_active: Boolean(value),
                      }))
                    }
                  />
                  <label htmlFor="menu-v2-active">
                    {dodoCrudV2Config.fields.is_active.label}
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <Checkbox
                    id="menu-v2-visible"
                    checked={form.is_visible}
                    onCheckedChange={(value) =>
                      setForm((formValue) => ({
                        ...formValue,
                        is_visible: Boolean(value),
                      }))
                    }
                  />
                  <label htmlFor="menu-v2-visible">
                    {dodoCrudV2Config.fields.is_visible.label}
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t bg-muted/40 p-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveMutation.isPending}
                  onClick={closeEditor}
                >
                  取消
                </Button>
                <LoadingButton type="submit" loading={saveMutation.isPending}>
                  {editor.mode === "create" ? "新增" : "儲存"}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default MenusCRUDV2
