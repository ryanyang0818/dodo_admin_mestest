import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  RefreshCw,
  Settings2,
} from "lucide-react"
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  PageErpWoReadonlyService as Api,
  type ErpWoRow,
  type PageErpWoReadonlyReadErpWoData,
} from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import {
  dodoReportConfig as config,
  type ErpWoFieldKey,
} from "./dodo-report.config"
import { ErpWoDetailDialog } from "./ErpWoDetailDialog"
import { woError, woText } from "./format"
import "@/components/ErpItemReadonly/ErpItemReadonly.css"

type PageSize = 0 | 25 | 50 | 100

type Filters = {
  inputDateFrom: string
  inputDateTo: string
  wo: string
  partNo: string
  status: string
  woType: string
  mesFlowType: string
}
type Preferences = {
  order?: ColumnOrderState
  visibility?: VisibilityState
  sizing?: ColumnSizingState
}
const STORAGE_KEY = "dodo-report:erp.wo-readonly:v2"
const keys = Object.keys(config.fields) as ErpWoFieldKey[]
const emptyRows: ErpWoRow[] = []
const flowTypes = [
  { value: "", label: "全部" },
  ...["1", "2", "3", "4"].map((value) => ({ value, label: value })),
  { value: "none", label: "未設定" },
]

// 每次進入與清除時重新計算台灣當月，避免跨月仍沿用舊日期。
function defaultFilters(): Filters {
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  })
  const [year, month] = today.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    inputDateFrom: `${today.slice(0, 7)}-01`,
    inputDateTo: `${today.slice(0, 7)}-${lastDay}`,
    wo: "",
    partNo: "",
    status: "",
    woType: "",
    mesFlowType: "",
  }
}

// 僅還原已知欄位的顯示偏好，不保存查詢日期或每頁筆數。
function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const order = Array.isArray(value.order)
      ? value.order.filter((key: unknown) =>
          keys.includes(key as ErpWoFieldKey),
        )
      : []
    const visibility = Object.fromEntries(
      keys.map((key) => [
        key,
        typeof value.visibility?.[key] === "boolean"
          ? value.visibility[key]
          : config.fields[key].visible,
      ]),
    )
    const sizing = Object.fromEntries(
      keys
        .filter((key) => Number.isFinite(value.sizing?.[key]))
        .map((key) => [key, Math.max(60, Math.min(700, value.sizing[key]))]),
    )
    return { order: [...new Set([...order, ...keys])], visibility, sizing }
  } catch {
    return {}
  }
}

// 查詢前先驗證日期跨度與前綴條件，後端仍獨立驗證。
function validate(filters: Filters): string | null {
  const days =
    (Date.parse(filters.inputDateTo) - Date.parse(filters.inputDateFrom)) /
    86400000
  if (!Number.isFinite(days)) return "請輸入有效的開單日期區間。"
  if (days < 0) return "日期迄不可早於日期起。"
  if (days > 366) return "日期區間不可超過 366 天。"
  if (
    [filters.wo, filters.partNo].some(
      (value) => !/^[A-Za-z0-9._-]*$/.test(value.trim()),
    )
  )
    return "文字條件只允許英數字、「.」「_」「-」。"
  return null
}

// 將已送出的條件與排序轉換成後端查詢參數。
function params(
  filters: Filters,
  sorting: SortingState,
  page: number,
  pageSize: PageSize,
): PageErpWoReadonlyReadErpWoData {
  return {
    inputDateFrom: filters.inputDateFrom,
    inputDateTo: filters.inputDateTo,
    wo: filters.wo.trim() || undefined,
    partNo: filters.partNo.trim() || undefined,
    status: (filters.status ||
      undefined) as PageErpWoReadonlyReadErpWoData["status"],
    woType: (filters.woType
      ? Number(filters.woType)
      : undefined) as PageErpWoReadonlyReadErpWoData["woType"],
    mesFlowType: (filters.mesFlowType ||
      undefined) as PageErpWoReadonlyReadErpWoData["mesFlowType"],
    sortBy: (sorting[0]?.id ??
      "wo") as PageErpWoReadonlyReadErpWoData["sortBy"],
    sortDirection: sorting[0]?.desc ? "desc" : "asc",
    page,
    pageSize,
  }
}

// 共用公開工單報表，保留原篩選及 SQL，提供 ERP 表格與基本明細。
export function ErpWoReadonly() {
  const toast = useCustomToast()
  const formId = useId()
  const [draft, setDraft] = useState(defaultFilters)
  const [submitted, setSubmitted] = useState(defaultFilters)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "wo", desc: false },
  ])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)
  const [preferences] = useState(readPreferences)
  const [visibility, setVisibility] = useState<VisibilityState>(
    preferences.visibility ??
      Object.fromEntries(keys.map((key) => [key, config.fields[key].visible])),
  )
  const [order, setOrder] = useState<ColumnOrderState>(
    preferences.order ?? keys,
  )
  const [sizing, setSizing] = useState<ColumnSizingState>(
    preferences.sizing ?? {},
  )
  const selectedRow = useRef<HTMLTableRowElement | null>(null)
  const [detailWo, setDetailWo] = useState<string | null>(null)
  const tableWrap = useRef<HTMLDivElement | null>(null)
  const [sqlOpen, setSqlOpen] = useState(false)
  const error = validate(draft)
  const queryParams = params(submitted, sorting, page, pageSize)
  const sqlParams = params(draft, sorting, page, pageSize)
  const query = useQuery({
    queryKey: [config.reportKey, "report", queryParams],
    queryFn: () => Api.readErpWo(queryParams),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const options = useQuery({
    queryKey: [config.reportKey, "options"],
    queryFn: () => Api.readErpWoOptions(),
    staleTime: 600000,
    retry: false,
  })
  const sql = useQuery({
    queryKey: [config.reportKey, "sql", sqlParams],
    queryFn: () => Api.readErpWoSql(sqlParams),
    enabled: sqlOpen && !error,
    retry: false,
  })
  const total = query.data?.total ?? 0
  const pages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const columns = useMemo<ColumnDef<ErpWoRow>[]>(
    () =>
      keys.map((key) => ({
        id: key,
        accessorKey: key,
        header: config.fields[key].label,
        size: config.fields[key].width,
        minSize: 60,
        maxSize: 700,
        cell: ({ getValue, row }) => {
          const text = woText(key, getValue())
          if (key !== "wo") return text
          return (
            <button
              type="button"
              className="max-w-full cursor-pointer overflow-hidden text-left text-ellipsis whitespace-nowrap underline decoration-dotted underline-offset-2"
              title={`${text}（雙擊查看明細）`}
              disabled={query.isPlaceholderData}
              onDoubleClick={() => setDetailWo(row.original.wo)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  setDetailWo(row.original.wo)
                }
              }}
            >
              {text}
            </button>
          )
        },
      })),
    [query.isPlaceholderData],
  )
  const table = useReactTable({
    data: query.data?.data ?? emptyRows,
    columns,
    getRowId: (row) => row.wo,
    state: {
      sorting,
      columnVisibility: visibility,
      columnOrder: order,
      columnSizing: sizing,
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange: (update) => {
      setSorting((current) =>
        typeof update === "function" ? update(current) : update,
      )
      setPage(1)
    },
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setOrder,
    onColumnSizingChange: setSizing,
    columnResizeMode: "onChange",
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order, visibility, sizing }),
      )
    } catch {
      /* 儲存失敗不影響查詢。 */
    }
  }, [order, visibility, sizing])

  useEffect(() => {
    if (query.isSuccess && !query.isPlaceholderData && page > pages)
      setPage(pages)
  }, [query.isSuccess, query.isPlaceholderData, page, pages])

  // 詳細視窗的上一張／下一張順序＝列表目前顯示順序。
  const rowWos = useMemo(
    () => (query.data?.data ?? emptyRows).map((row) => row.wo),
    [query.data],
  )

  // 切換明細時，列表選取列同步移動並捲到可見位置。
  function navigateDetail(wo: string) {
    setDetailWo(wo)
    const row = [
      ...(tableWrap.current?.querySelectorAll("tr[data-wo]") ?? []),
    ].find((el) => el.getAttribute("data-wo") === wo) as
      | HTMLTableRowElement
      | undefined
    if (row) {
      selectRow(row)
      row.scrollIntoView({ block: "nearest" })
    }
  }

  // 更新表單草稿，按查詢才送出條件。
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // 直接切換列樣式，避免選取時重繪整張表格。
  function selectRow(row: HTMLTableRowElement) {
    selectedRow.current?.classList.remove("is-selected")
    selectedRow.current?.setAttribute("aria-selected", "false")
    row.classList.add("is-selected")
    row.setAttribute("aria-selected", "true")
    selectedRow.current = row
  }

  // 查詢或重新整理已輸入的條件。
  function submit(event: FormEvent) {
    event.preventDefault()
    if (error) return
    setPage(1)
    if (page === 1 && JSON.stringify(draft) === JSON.stringify(submitted))
      void query.refetch()
    else setSubmitted({ ...draft })
  }

  // 清除後恢復當月、工單升序與第一頁。
  function clear() {
    const defaults = defaultFilters()
    setPageSize(50)
    setDraft(defaults)
    setSubmitted(defaults)
    setSorting([{ id: "wo", desc: false }])
    setPage(1)
  }

  // 將指定欄位往左或往右移動一格。
  function moveColumn(index: number, offset: number) {
    setOrder((current) => {
      const next = [...current]
      const target = index + offset
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // 複製目前草稿所產生的 SQL，剪貼簿失敗時保留可手動選取內容。
  async function copySql() {
    if (!sql.data) return
    try {
      await navigator.clipboard.writeText(sql.data.sql)
      toast.showSuccessToast("已複製 SQL")
    } catch {
      toast.showErrorToast("無法存取剪貼簿，請在下方選取 SQL 手動複製。")
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        tabKey={config.reportKey}
        title={config.reportTitle}
        description={config.reportDescription}
      />
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-lg border p-3 text-sm"
      >
        <label htmlFor={`${formId}-inputDateFrom`} className="grid gap-1">
          開單日期起
          <Input
            id={`${formId}-inputDateFrom`}
            type="date"
            required
            className="h-8 w-40"
            value={draft.inputDateFrom}
            onChange={(e) => update("inputDateFrom", e.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-inputDateTo`} className="grid gap-1">
          開單日期迄
          <Input
            id={`${formId}-inputDateTo`}
            type="date"
            required
            className="h-8 w-40"
            value={draft.inputDateTo}
            onChange={(e) => update("inputDateTo", e.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-wo`} className="grid gap-1">
          工單編號
          <Input
            id={`${formId}-wo`}
            className="h-8 w-44"
            placeholder="輸入工單前綴"
            maxLength={50}
            value={draft.wo}
            onChange={(e) => update("wo", e.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-partNo`} className="grid gap-1">
          料件編號
          <Input
            id={`${formId}-partNo`}
            className="h-8 w-40"
            placeholder="輸入料號前綴"
            maxLength={50}
            value={draft.partNo}
            onChange={(e) => update("partNo", e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          工單狀態
          <select
            className="h-8 rounded-md border bg-background px-2"
            value={draft.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">全部</option>
            {options.data?.statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          工單型態
          <select
            className="h-8 rounded-md border bg-background px-2"
            value={draft.woType}
            onChange={(e) => update("woType", e.target.value)}
          >
            <option value="">全部</option>
            {options.data?.wo_types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          MES工單流程類型
          <select
            aria-label="MES工單流程類型"
            className="h-8 rounded-md border bg-background px-2"
            value={draft.mesFlowType}
            onChange={(e) => update("mesFlowType", e.target.value)}
          >
            {flowTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex w-full flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={Boolean(error) || query.isFetching}
          >
            查詢
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear}>
            清除條件
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="size-3.5" />
            刷新
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={Boolean(error)}
            onClick={() => setSqlOpen(true)}
          >
            SQL
          </Button>
        </div>
        {error && (
          <p role="alert" className="w-full text-destructive">
            {error}
          </p>
        )}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>雙擊工單編號查看明細。</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              <Settings2 className="size-3.5" />
              欄位
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[65vh] w-80 overflow-y-auto"
          >
            <DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {order.map((id, index) => (
              <div key={id} className="flex items-center gap-1 pr-1">
                <DropdownMenuCheckboxItem
                  className="flex-1"
                  checked={table.getColumn(id)?.getIsVisible()}
                  disabled={
                    table.getColumn(id)?.getIsVisible() &&
                    table.getVisibleLeafColumns().length === 1
                  }
                  onCheckedChange={(checked) =>
                    table.getColumn(id)?.toggleVisibility(Boolean(checked))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {config.fields[id as ErpWoFieldKey].label}
                </DropdownMenuCheckboxItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`${config.fields[id as ErpWoFieldKey].label}往前`}
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`${config.fields[id as ErpWoFieldKey].label}往後`}
                  disabled={index === order.length - 1}
                  onClick={() => moveColumn(index, 1)}
                >
                  <ArrowDown className="size-3" />
                </Button>
              </div>
            ))}
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOrder(keys)
                setVisibility(
                  Object.fromEntries(
                    keys.map((key) => [key, config.fields[key].visible]),
                  ),
                )
                setSizing({})
              }}
            >
              恢復預設欄位
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {query.isFetching && <p role="status">查詢中…</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {woError(query.error)}
        </p>
      )}
      {options.isError && (
        <p role="alert" className="text-destructive">
          篩選選項載入失敗。
          <button
            type="button"
            className="underline"
            onClick={() => void options.refetch()}
          >
            重新載入
          </button>
        </p>
      )}
      {query.isSuccess && !query.isFetching && query.data.data.length === 0 && (
        <p>查無符合條件的工單。</p>
      )}
      {query.isSuccess && (
        <div
          ref={tableWrap}
          className="max-h-[65vh] overflow-auto border border-[#8b8b8b] bg-white"
          aria-busy={query.isFetching}
        >
          <table
            aria-label="工單查詢結果"
            className="border-collapse select-none text-[12px] leading-[16px] text-[#1f2937]"
            style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
          >
            <thead className="sticky top-0 z-10 bg-[#eeeeee]">
              <tr>
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative h-[22px] overflow-hidden whitespace-nowrap border-b border-r border-[#8b8b8b] px-1 py-0.5 text-left font-normal"
                    style={{ width: header.getSize() }}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc"
                        ? " ↑"
                        : header.column.getIsSorted() === "desc"
                          ? " ↓"
                          : ""}
                    </button>
                    <hr
                      tabIndex={0}
                      aria-label={`調整${config.fields[header.id as ErpWoFieldKey].label}寬度`}
                      aria-orientation="vertical"
                      aria-valuenow={header.getSize()}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ArrowLeft" ||
                          event.key === "ArrowRight"
                        ) {
                          event.preventDefault()
                          setSizing((current) => ({
                            ...current,
                            [header.id]: Math.max(
                              60,
                              Math.min(
                                700,
                                header.getSize() +
                                  (event.key === "ArrowRight" ? 10 : -10),
                              ),
                            ),
                          }))
                        }
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-wo={row.id}
                  tabIndex={0}
                  className="erp-item-row"
                  onClick={(event) => selectRow(event.currentTarget)}
                  onFocus={(event) => selectRow(event.currentTarget)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      title={woText(
                        cell.column.id as ErpWoFieldKey,
                        cell.getValue(),
                      )}
                      className="h-[17px] overflow-hidden text-ellipsis whitespace-nowrap border-r border-[#b8b8b8] px-1 py-0"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-3 rounded-b-md border border-t-0 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            共{" "}
            <span className="font-medium text-foreground">
              {total.toLocaleString("zh-TW")}
            </span>{" "}
            筆
          </span>
          <div className="flex items-center gap-1.5">
            <span>每頁</span>
            <Select
              value={String(pageSize)}
              disabled={query.isFetching}
              onValueChange={(value) => {
                setPageSize(Number(value) as PageSize)
                setPage(1)
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-[76px]"
                aria-label="每頁筆數"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[25, 50, 100, 0].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value === 0 ? "全部" : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span>
            第 <span className="font-medium text-foreground">{page}</span> /{" "}
            {pages} 頁
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="第一頁"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="上一頁"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="下一頁"
              disabled={page >= pages || query.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="最後頁"
              disabled={page >= pages || query.isFetching}
              onClick={() => setPage(pages)}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {detailWo && (
        <ErpWoDetailDialog
          wo={detailWo}
          wos={rowWos}
          onNavigate={navigateDetail}
          onClose={() => setDetailWo(null)}
        />
      )}
      <Dialog open={sqlOpen} onOpenChange={setSqlOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>預計執行的 SQL</DialogTitle>
            <DialogDescription>
              依目前輸入的查詢條件產生，僅供檢視及複製。
            </DialogDescription>
          </DialogHeader>
          {sql.isPending && <p role="status">產生 SQL 中…</p>}
          {sql.isError && <p role="alert">{woError(sql.error)}</p>}
          {sql.data && (
            <>
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={copySql}
              >
                <Copy className="size-4" />
                複製 SQL
              </Button>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded border bg-muted p-3 text-xs">
                {sql.data.sql}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
