import { useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import axios from "axios"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import {
  PageErpItemReadonlyService as Api,
  ApiError,
  type ItemRow,
  OpenAPI,
  type PageErpItemReadonlyReadItemsData,
} from "@/client"
import { request } from "@/client/core/request"
import { PageHeader } from "@/components/Common/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  activeCodeLabels,
  dodoReportConfig as config,
  type ItemField,
  itemFields,
  replenishmentLabels,
  salesCharacteristicLabels,
  sourceLabels,
  statusLabels,
} from "./dodo-report.config"
import { ErpItemDetailDialog } from "./ErpItemDetailDialog"
import "./ErpItemReadonly.css"

// 暫時隱藏 CSV 入口與說明，保留匯出功能供日後恢復。
const SHOW_CSV_EXPORT = false

type FilterKey = "group_code" | "source" | "status" | "origin"
type Filters = { search: string } & Record<FilterKey, string[]>
const filterKeys: FilterKey[] = ["group_code", "source", "status", "origin"]
const emptyFilters: Filters = {
  search: "",
  group_code: [],
  source: [],
  status: [],
  origin: [],
}

// 畫面與後端 CSV 使用相同的代碼說明及空值規則。
export function itemText(row: ItemRow, key: ItemField): string {
  const value = row[key]
  if (value == null || value === "") return "—"
  const labels =
    key === "source"
      ? sourceLabels
      : key === "sales_characteristic"
        ? salesCharacteristicLabels
        : key === "replenishment_strategy"
          ? replenishmentLabels
          : key === "status"
            ? statusLabels
            : key === "active_code"
              ? activeCodeLabels
              : null
  return labels ? `${value}:${labels[value] ?? "未定義"}` : value
}

// API 僅回傳可公開顯示的錯誤；不把原始網路或連線內容呈現給使用者。
function errorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  )
    return error.body.detail
  return "查詢失敗，請確認連線或縮小條件後再試。"
}

// 匿名頁與 Workspace 共用；所有設定只保留於本次元件生命週期。
export function ErpItemReadonly() {
  const searchId = useId()
  const sqlPanelId = useId()
  const [showSql, setShowSql] = useState(false)
  const [draft, setDraft] = useState<Filters>(emptyFilters)
  const [applied, setApplied] = useState<Filters>(emptyFilters)
  const [preview, setPreview] = useState(true)
  const [revision, setRevision] = useState(0)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 250 })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "part_no", desc: false },
  ])
  const [visibility, setVisibility] = useState<VisibilityState>({})
  const [order, setOrder] = useState<string[]>([...itemFields])
  const [sizing, setSizing] = useState<Record<string, number>>({})
  const [exporting, setExporting] = useState(false)
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)
  const [detailPartNo, setDetailPartNo] = useState<string | null>(null)
  const params: PageErpItemReadonlyReadItemsData = {
    preview,
    search: applied.search,
    groupCode: applied.group_code,
    source: applied.source,
    status: applied.status,
    origin: applied.origin,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy: (sorting[0]?.id ?? "part_no") as ItemField,
    sortDirection: sorting[0]?.desc ? "desc" : "asc",
  }
  const query = useQuery({
    queryKey: [config.reportKey, params, revision],
    queryFn: () => Api.readItems(params),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const options = useQuery({
    queryKey: [config.reportKey, "options"],
    queryFn: () => Api.itemOptions(),
    retry: false,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  })
  const sqlQuery = useQuery({
    queryKey: [config.reportKey, "sql", params],
    queryFn: () => Api.itemSql(params),
    enabled: showSql,
    retry: false,
    refetchOnWindowFocus: false,
  })
  // 選取只更新兩列的 class 與無障礙標記，不觸發報表重新渲染。
  const selectRow = useCallback((row: HTMLTableRowElement | null) => {
    const previous = selectedRowRef.current
    if (previous === row) return
    previous?.classList.remove("is-selected")
    previous?.setAttribute("aria-selected", "false")
    row?.classList.add("is-selected")
    row?.setAttribute("aria-selected", "true")
    selectedRowRef.current = row
  }, [])

  // 換頁或查詢結果更新後，選取新結果的第一列。
  useEffect(() => {
    selectRow(
      query.isSuccess && query.data.data.length
        ? (tableBodyRef.current?.rows[0] ?? null)
        : null,
    )
  }, [query.data, query.isSuccess, selectRow])
  const columns: ColumnDef<ItemRow>[] = itemFields.map((key) => ({
    id: key,
    accessorKey: key,
    header: config.fields[key].label,
    size: config.fields[key].width,
    minSize: 90,
    maxSize: 700,
    cell: ({ row }) => {
      const text = itemText(row.original, key)
      if (key === "part_no")
        return (
          <button
            type="button"
            className="max-w-full cursor-pointer overflow-hidden text-left text-ellipsis whitespace-nowrap underline decoration-dotted underline-offset-2"
            title={`${text}（雙擊查看明細）`}
            onDoubleClick={() => setDetailPartNo(row.original.part_no)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setDetailPartNo(row.original.part_no)
            }}
          >
            {text}
          </button>
        )
      return <span title={text}>{text}</span>
    },
  }))
  const table = useReactTable({
    data: query.data?.data ?? [],
    columns,
    state: {
      pagination,
      sorting,
      columnVisibility: visibility,
      columnOrder: order,
      columnSizing: sizing,
    },
    onPaginationChange: setPagination,
    onSortingChange: (update) => {
      setSorting(update)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setOrder,
    onColumnSizingChange: setSizing,
    manualPagination: true,
    manualSorting: true,
    rowCount: query.data?.total ?? 0,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableMultiSort: false,
    enableSortingRemoval: false,
  })
  const visibleKeys = table
    .getVisibleLeafColumns()
    .map((c) => c.id as ItemField)

  // 至少一個實際條件才送出正式查詢，不使用未送出的草稿條件匯出。
  function submit() {
    if (!draft.search.trim() && !filterKeys.some((k) => draft[k].length)) {
      toast.error("請輸入料號／品名，或選擇至少一個篩選條件")
      return
    }
    setApplied({ ...draft, search: draft.search.trim() })
    setPreview(false)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
    setRevision((n) => n + 1)
  }

  // 依目前欄序下載完整已套用篩選結果，與畫面分頁無關。
  async function exportCsv() {
    setExporting(true)
    try {
      // 保留後端 Big5 位元組，不經字串解碼或重新編碼。
      const result = await request<Blob>(
        OpenAPI,
        {
          method: "GET",
          url: "/api/v1/page/erp/item-readonly/report/export",
          query: {
            preview: params.preview,
            search: params.search,
            group_code: params.groupCode,
            source: params.source,
            status: params.status,
            origin: params.origin,
            sort_by: params.sortBy,
            sort_direction: params.sortDirection,
            columns: visibleKeys,
          },
        },
        axios.create({ responseType: "blob" }),
      )
      const url = URL.createObjectURL(result)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "erp-item-readonly.csv"
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success("已匯出完整篩選結果")
    } catch (error) {
      // Blob 模式下，錯誤回應仍是 UTF-8 JSON。
      if (error instanceof ApiError && error.body instanceof Blob) {
        try {
          const body = JSON.parse(await error.body.text())
          if (typeof body.detail === "string") {
            toast.error(body.detail)
            return
          }
        } catch {
          // 非 JSON 錯誤沿用一般連線錯誤提示。
        }
      }
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  // 調整欄序；隱藏欄位仍保留位置，還原時恢復預設。
  function moveColumn(index: number, step: number) {
    const next = [...order]
    const other = index + step
    if (other < 0 || other >= next.length) return
    ;[next[index], next[other]] = [next[other], next[index]]
    setOrder(next)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        tabKey={config.reportKey}
        title={config.reportTitle}
        description={config.reportDescription}
      />
      <form
        className="space-y-3 rounded-md border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor={searchId} className="flex items-center gap-3 text-sm">
          <span className="shrink-0">料號或品名</span>
          <Input
            id={searchId}
            className="min-w-0 max-w-xl flex-1"
            placeholder="輸入料號或品名（包含搜尋）"
            maxLength={80}
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          {filterKeys.map((key) => (
            <details
              key={key}
              className="relative rounded border px-3 py-1.5 text-sm"
            >
              <summary className="cursor-pointer">
                {config.fields[key].label}（{draft[key].length || "全部"}）
              </summary>
              <div className="absolute left-0 top-full z-30 max-h-64 min-w-56 overflow-auto rounded border bg-background p-2 shadow-lg">
                <button
                  type="button"
                  className="mb-2 underline"
                  onClick={() => setDraft({ ...draft, [key]: [] })}
                >
                  清除此條件
                </button>
                {(options.data?.[key] ?? []).map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={draft[key].includes(option.value)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [key]: e.target.checked
                            ? [...draft[key], option.value]
                            : draft[key].filter((v) => v !== option.value),
                        })
                      }
                    />
                    {option.label}
                  </label>
                ))}
                {options.isPending && <p>載入選項中…</p>}
                {options.isError && <p>選項載入失敗，可使用文字搜尋。</p>}
              </div>
            </details>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={query.isFetching}>
            查詢
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft(emptyFilters)}
          >
            清除條件
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => {
              setPagination((p) => ({ ...p, pageIndex: 0 }))
              setRevision((n) => n + 1)
            }}
          >
            刷新目前結果
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-expanded={showSql}
            aria-controls={sqlPanelId}
            onClick={() => setShowSql((value) => !value)}
          >
            {showSql ? "收合 SQL" : "SQL"}
          </Button>
        </div>
        {showSql && (
          <section
            id={sqlPanelId}
            aria-label="目前查詢 SQL"
            className="min-w-0 space-y-2 rounded border bg-muted/30 p-3"
          >
            <p className="text-sm">
              目前已套用條件、排序與頁碼的
              SQL；不包含尚未按查詢的輸入。此處只顯示語法，不會執行查詢。
            </p>
            {sqlQuery.isPending && <p role="status">產生 SQL 中…</p>}
            {sqlQuery.isError && (
              <p role="alert" className="text-destructive">
                {errorMessage(sqlQuery.error)}
              </p>
            )}
            {sqlQuery.data && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sqlQuery.data.sql)
                      toast.success("已複製 SQL")
                    } catch {
                      toast.error("無法自動複製，請選取 SQL 後複製")
                    }
                  }}
                >
                  複製 SQL
                </Button>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-3 text-xs">
                  <code>{sqlQuery.data.sql}</code>
                </pre>
                <details className="text-sm">
                  <summary className="cursor-pointer">
                    空頁時補查總筆數的 SQL
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-3 text-xs">
                    <code>{sqlQuery.data.empty_page_count_sql}</code>
                  </pre>
                </details>
              </>
            )}
          </section>
        )}
      </form>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          {preview
            ? "初次預覽：料號升冪前 500 筆（非全部資料）"
            : `符合條件共 ${(query.data?.total ?? 0).toLocaleString()} 筆`}
        </span>
        {query.isSuccess && (
          <span className="text-muted-foreground">
            更新：{new Date(query.dataUpdatedAt).toLocaleTimeString("zh-TW")}
          </span>
        )}
        <span className="text-muted-foreground">雙擊料件編號可查看明細</span>
        {SHOW_CSV_EXPORT && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={
                preview ||
                exporting ||
                !visibleKeys.length ||
                !query.isSuccess ||
                query.isFetching
              }
              onClick={exportCsv}
            >
              {exporting ? "匯出中…" : "匯出 CSV"}
            </Button>
            {preview && (
              <span className="text-muted-foreground">
                先輸入條件查詢後可匯出，最多 20,000 筆。
              </span>
            )}
          </>
        )}
        <details className="relative">
          <summary className="cursor-pointer rounded border px-3 py-1.5">
            欄位設定
          </summary>
          <div className="absolute right-0 z-30 min-w-72 rounded border bg-background p-3 shadow-lg">
            {order.map((key, index) => (
              <div key={key} className="flex items-center gap-2 py-1">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={table.getColumn(key)?.getIsVisible()}
                    onChange={table
                      .getColumn(key)
                      ?.getToggleVisibilityHandler()}
                  />
                  {config.fields[key as ItemField].label}
                </label>
                <button
                  type="button"
                  aria-label={`${config.fields[key as ItemField].label}向前`}
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${config.fields[key as ItemField].label}向後`}
                  disabled={index === order.length - 1}
                  onClick={() => moveColumn(index, 1)}
                >
                  ↓
                </button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVisibility({})
                setOrder([...itemFields])
                setSizing({})
              }}
            >
              還原欄位
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              拖曳表頭右側調整寬度；本次設定不保存。
            </p>
          </div>
        </details>
      </div>
      {query.isFetching && <p role="status">查詢中…</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {errorMessage(query.error)}
        </p>
      )}
      {query.isSuccess && query.data.data.length === 0 && (
        <p>查無符合條件的料號。</p>
      )}
      {query.isSuccess && (
        <div className="max-h-[65vh] overflow-auto border border-[#8b8b8b] bg-white">
          <table
            className="border-collapse select-none text-[12px] leading-[16px] text-[#1f2937]"
            style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
          >
            <thead className="sticky top-0 z-10 bg-[#eeeeee]">
              <tr>
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative h-[22px] overflow-hidden whitespace-nowrap border-b border-r border-[#8b8b8b] px-1 py-0.5 text-left font-normal text-ellipsis"
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
                      {header.column.getIsSorted() === "desc"
                        ? " ↓"
                        : header.column.getIsSorted()
                          ? " ↑"
                          : ""}
                    </button>
                    <hr
                      aria-valuenow={header.getSize()}
                      aria-label={`調整${config.fields[header.id as ItemField].label}寬度`}
                      aria-orientation="vertical"
                      tabIndex={0}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ArrowLeft" ||
                          event.key === "ArrowRight"
                        ) {
                          event.preventDefault()
                          setSizing((s) => ({
                            ...s,
                            [header.id]: Math.max(
                              90,
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
            <tbody ref={tableBodyRef}>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.original.part_no}
                  tabIndex={0}
                  className="erp-item-row"
                  onClick={(event) => selectRow(event.currentTarget)}
                  onFocus={(event) => selectRow(event.currentTarget)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="h-[17px] overflow-hidden whitespace-nowrap border-r border-[#b8b8b8] px-1 py-0 text-ellipsis"
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
      <div className="flex items-center gap-3 text-sm">
        <label>
          每頁{" "}
          <select
            className="rounded border bg-background px-2 py-1"
            value={pagination.pageSize}
            onChange={(e) =>
              setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })
            }
          >
            {[50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{" "}
          筆
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanPreviousPage() || query.isFetching}
          onClick={() => table.previousPage()}
        >
          上一頁
        </Button>
        <span>
          第 {pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())} 頁
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!table.getCanNextPage() || query.isFetching}
          onClick={() => table.nextPage()}
        >
          下一頁
        </Button>
      </div>
      <ErpItemDetailDialog
        partNo={detailPartNo}
        onOpenChange={(open) => {
          if (!open) setDetailPartNo(null)
        }}
      />
    </section>
  )
}
