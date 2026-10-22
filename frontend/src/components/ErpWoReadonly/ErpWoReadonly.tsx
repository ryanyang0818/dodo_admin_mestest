import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Download,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

import {
  type ErpWoRow,
  PageErpWoReadonlyService,
  type PageErpWoReadonlyReadErpWoData,
} from '@/client'
import { PageHeader } from '@/components/Common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import useCustomToast from '@/hooks/useCustomToast'
import { cn } from '@/lib/utils'

import { dodoReportConfig, type ErpWoFieldKey } from './dodo-report.config'

type Filters = {
  inputDateFrom: string
  inputDateTo: string
  wo: string
  partNo: string
  status: string
  woType: string
  mesFlowType: string
  lineNo: string
  includeInactive: boolean
}
type SavedReportState = {
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  pageSize?: number
}

const SAFE_TEXT = /^[A-Za-z0-9._-]*$/
const STORAGE_KEY = 'dodo-report:' + dodoReportConfig.reportKey + ':v1'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const todayValue = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const DEFAULT_FILTERS: Filters = {
  inputDateFrom: todayValue.slice(0, 8) + '01',
  inputDateTo: todayValue,
  wo: '',
  partNo: '',
  status: '',
  woType: '',
  mesFlowType: '',
  lineNo: '',
  includeInactive: false,
}
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [ErpWoFieldKey, (typeof dodoReportConfig.fields)[ErpWoFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)
const EMPTY_ROWS: ErpWoRow[] = []

const woStatusLabels: Record<string, string> = {
  '1': '確認生產工單',
  '2': '已發放，料表未列印',
  '3': '已發放，料表已列印',
  '4': '已發料',
  '5': '在製過程中',
  '6': '已完工，進入 FQC',
  '7': '完工入庫',
  '8': '結案',
}
const confirmedLabels: Record<string, string> = {
  Y: 'Y:確認',
  N: 'N:未確認',
  X: 'X:作廢',
}
const MES_FLOW_TYPE_CHIPS = [
  { value: '', label: '全部' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: 'none', label: '未設定' },
]
const woTypeLabels: Record<string, string> = {
  '1': '一般工單',
  '5': '再加工工單',
  '7': '委外工單',
  '8': '重工委外工單',
  '11': '拆件式工單',
  '13': '預測工單',
  '15': '試產工單',
}

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 計算日期區間天數，用於前端預先擋掉超過上限的查詢
function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

// 檢查查詢條件；回傳錯誤訊息，沒問題回傳 null
function validateFilters(filters: Filters): string | null {
  if (!filters.inputDateFrom || !filters.inputDateTo) return '請輸入日期區間'
  const days = daysBetween(filters.inputDateFrom, filters.inputDateTo)
  if (days < 0) return '日期迄不可早於日期起'
  if (days > 366) return '日期區間不可超過 366 天'
  for (const value of [filters.wo, filters.partNo, filters.lineNo]) {
    if (!SAFE_TEXT.test(value.trim())) return '文字條件只允許英數字、「.」「_」「-」'
  }
  return null
}

// 將搜尋與分頁狀態轉成 API 參數
function toApiParams(
  filters: Filters,
  sorting: SortingState,
  pagination: PaginationState,
): PageErpWoReadonlyReadErpWoData {
  const currentSort = sorting[0]
  return {
    inputDateFrom: filters.inputDateFrom,
    inputDateTo: filters.inputDateTo,
    wo: filters.wo.trim() || undefined,
    partNo: filters.partNo.trim() || undefined,
    status: (filters.status || undefined) as PageErpWoReadonlyReadErpWoData['status'],
    woType: (filters.woType ? Number(filters.woType) : undefined) as PageErpWoReadonlyReadErpWoData['woType'],
    mesFlowType: (filters.mesFlowType || undefined) as PageErpWoReadonlyReadErpWoData['mesFlowType'],
    lineNo: filters.lineNo.trim() || undefined,
    includeInactive: filters.includeInactive || undefined,
    sortBy: (currentSort?.id ?? 'input_date') as PageErpWoReadonlyReadErpWoData['sortBy'],
    sortDirection: currentSort?.desc === false ? 'asc' : 'desc',
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }
}

// 依欄位設定格式化內容
function formatFieldValue(key: ErpWoFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  if (field.format === 'number') return Number(value).toLocaleString('zh-TW')
  if (field.format === 'wo-status') return woStatusLabels[String(value)] ?? String(value)
  if (field.format === 'confirmed') return confirmedLabels[String(value)] ?? String(value)
  if (field.format === 'wo-type') return woTypeLabels[String(value)] ?? String(value)
  return String(value)
}

// 依狀態欄位呈現識別標籤
function renderCell(key: ErpWoFieldKey, value: unknown) {
  const text = formatFieldValue(key, value)
  if (key === 'status') {
    return <Badge variant={value === '8' || value === '7' ? 'secondary' : 'outline'}>{text}</Badge>
  }
  return <span className='whitespace-normal'>{text}</span>
}

// 產生設定驅動的主表欄位
function buildColumns(): ColumnDef<ErpWoRow>[] {
  return fieldEntries.map(([key, field]): ColumnDef<ErpWoRow> => ({
    id: key,
    accessorKey: key,
    size: field.width,
    enableSorting: field.sortable,
    header: ({ column }) => (
      <Button
        type='button'
        variant='ghost'
        className='-ml-3 h-8'
        disabled={!column.getCanSort()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {field.label}
        {column.getCanSort() && <ArrowUpDown className='ml-1 size-3.5' />}
      </Button>
    ),
    cell: ({ getValue }) => renderCell(key, getValue()),
  }))
}

// ERP 工單維護作業（唯讀）純內容元件，供 Tab 與 standalone route 共用
export function ErpWoReadonly() {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const savedState = useMemo(readSavedState, [])
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [submitted, setSubmitted] = useState<Filters>(DEFAULT_FILTERS)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'input_date', desc: true }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...defaultVisibility,
    ...savedState.columnVisibility,
  })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    savedState.columnOrder ?? defaultColumnOrder,
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: savedState.pageSize ?? 50,
  })
  const [isExporting, setIsExporting] = useState(false)
  const draftError = validateFilters(draft)
  const apiParams = toApiParams(submitted, sorting, pagination)
  const draftParams = toApiParams(draft, sorting, pagination)

  const optionsQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'options'],
    queryFn: () => PageErpWoReadonlyService.readErpWoOptions(),
    staleTime: 10 * 60 * 1000,
  })
  const sqlQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'sql', draftParams],
    queryFn: () => PageErpWoReadonlyService.readErpWoSql(draftParams),
    enabled: !draftError,
    placeholderData: keepPreviousData,
  })
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report', apiParams],
    queryFn: () => PageErpWoReadonlyService.readErpWo(apiParams),
    placeholderData: keepPreviousData,
  })

  const data = reportQuery.data?.data ?? EMPTY_ROWS
  const columns = useMemo<ColumnDef<ErpWoRow>[]>(() => buildColumns(), [])
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder, pagination },
    pageCount: Math.max(1, Math.ceil((reportQuery.data?.total ?? 0) / pagination.pageSize)),
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (updater) => {
      setSorting((current) => typeof updater === 'function' ? updater(current) : updater)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      setPagination((current) => typeof updater === 'function' ? updater(current) : updater)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        columnOrder,
        columnVisibility,
        pageSize: pagination.pageSize,
      }))
    } catch {
      // 無法保存操作狀態時不影響查詢
    }
  }, [columnOrder, columnVisibility, pagination.pageSize])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(submitted)
  const hasConditions = JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTERS)
    || sorting[0]?.id !== 'input_date'
    || sorting[0]?.desc !== true

  // 更新單一後端搜尋條件
  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // 送出後端搜尋條件並回到第一頁
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (draftError) {
      showErrorToast(draftError)
      return
    }
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    if (isDirty) setSubmitted(draft)
    else reportQuery.refetch()
  }

  // 清除查詢與排序條件
  function clearConditions() {
    setDraft(DEFAULT_FILTERS)
    setSubmitted(DEFAULT_FILTERS)
    setSorting([{ id: 'input_date', desc: true }])
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  // 快速過濾 MES 工單流程類型：點選後立即套用，其他條件維持已送出的內容
  function applyFlowTypeChip(value: string) {
    setDraft((current) => ({ ...current, mesFlowType: value }))
    setSubmitted((current) => ({ ...current, mesFlowType: value }))
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  // 複製預計執行的 SQL
  async function copySql() {
    if (!sqlQuery.data) return
    await navigator.clipboard.writeText(sqlQuery.data.sql)
    showSuccessToast('已複製 SQL')
  }

  // 匯出完整篩選結果，不受目前分頁限制
  async function exportCsv() {
    setIsExporting(true)
    try {
      const result = await PageErpWoReadonlyService.exportErpWo(apiParams)
      const blob = new Blob([String(result ?? '')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `erp-wo-readonly-${todayValue}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      showSuccessToast('已匯出完整篩選結果')
    } catch {
      showErrorToast('匯出失敗；若超過 20,000 筆，請縮小日期或條件。')
    } finally {
      setIsExporting(false)
    }
  }

  // 調整欄位顯示順序
  function moveColumn(columnId: string, offset: -1 | 1) {
    const index = columnOrder.indexOf(columnId)
    const nextIndex = index + offset
    if (index < 0 || nextIndex < 0 || nextIndex >= columnOrder.length) return
    const next = [...columnOrder]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setColumnOrder(next)
  }

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-4'>
      <PageHeader
        tabKey={dodoReportConfig.reportKey}
        title={dodoReportConfig.reportTitle}
        description={dodoReportConfig.reportDescription}
      />
      <form className='flex flex-wrap items-end gap-2' onSubmit={handleSubmit}>
        <label className='space-y-1 text-xs text-muted-foreground'>
          <span className='block'>輸入日期起</span>
          <Input type='date' required className='h-9 w-40' value={draft.inputDateFrom} onChange={(event) => updateDraft('inputDateFrom', event.target.value)} />
        </label>
        <label className='space-y-1 text-xs text-muted-foreground'>
          <span className='block'>輸入日期迄</span>
          <Input type='date' required className='h-9 w-40' value={draft.inputDateTo} onChange={(event) => updateDraft('inputDateTo', event.target.value)} />
        </label>
        <Input aria-label='工單編號' className='h-9 w-48' maxLength={50} placeholder='工單編號…' value={draft.wo} onChange={(event) => updateDraft('wo', event.target.value)} />
        <Input aria-label='料號' className='h-9 w-40' maxLength={50} placeholder='料號…' value={draft.partNo} onChange={(event) => updateDraft('partNo', event.target.value)} />
        <Input aria-label='生產線' className='h-9 w-28' maxLength={50} placeholder='生產線…' value={draft.lineNo} onChange={(event) => updateDraft('lineNo', event.target.value)} />
        <select aria-label='工單狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
          <option value=''>全部狀態</option>
          {optionsQuery.data?.statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label='工單型態' className='h-9 rounded-md border bg-background px-3 text-sm' value={draft.woType} onChange={(event) => updateDraft('woType', event.target.value)}>
          <option value=''>全部型態</option>
          {optionsQuery.data?.wo_types.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <label className='flex h-9 items-center gap-1.5 text-sm'>
          <input type='checkbox' checked={draft.includeInactive} onChange={(event) => updateDraft('includeInactive', event.target.checked)} />
          含無效資料
        </label>
        <Button type='submit' size='sm' disabled={reportQuery.isFetching || Boolean(draftError)}>
          <RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} />
          {isDirty ? '查詢' : '重新查詢'}
        </Button>
        {hasConditions && <Button type='button' variant='ghost' size='sm' onClick={clearConditions}><X className='size-4' />清除條件</Button>}
        {draftError && <span role='alert' className='text-xs text-destructive'>{draftError}</span>}
      </form>

      <div className='flex flex-wrap items-center gap-2' role='group' aria-label='MES工單流程類型快速過濾'>
        <span className='text-sm text-muted-foreground'>MES工單流程類型：</span>
        {MES_FLOW_TYPE_CHIPS.map((chip) => (
          <Button
            key={chip.value}
            type='button'
            size='sm'
            variant={submitted.mesFlowType === chip.value ? 'default' : 'outline'}
            aria-pressed={submitted.mesFlowType === chip.value}
            onClick={() => applyFlowTypeChip(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <details className='rounded-md border bg-muted/20'>
        <summary className='cursor-pointer select-none px-3 py-2 text-sm font-medium'>
          預計執行的 SQL{isDirty && <span className='ml-2 text-xs font-normal text-amber-600'>（條件已變更）</span>}
        </summary>
        <div className='border-t p-3'>
          <div className='mb-2 flex flex-wrap items-center gap-2'>
            <span className='text-xs text-muted-foreground'>參數：</span>
            {sqlQuery.data && Object.entries(sqlQuery.data.params).map(([key, value]) => <Badge key={key} variant='outline'>{key}={String(value)}</Badge>)}
            <Button type='button' variant='outline' size='sm' className='ml-auto' disabled={!sqlQuery.data} onClick={copySql}><Copy className='size-4' />複製 SQL</Button>
          </div>
          <pre className='max-h-72 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-xs'>{sqlQuery.data?.sql ?? '載入 SQL 中…'}</pre>
        </div>
      </details>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-sm text-muted-foreground'>共 {reportQuery.data?.total.toLocaleString('zh-TW') ?? 0} 筆（唯讀）</span>
        <div className='flex items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type='button' variant='outline' size='sm'><Settings2 className='size-4' />欄位</Button></DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-72'>
              <DropdownMenuLabel>顯示與順序</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder.map((columnId, index) => {
                const field = dodoReportConfig.fields[columnId as ErpWoFieldKey]
                if (!field) return null
                return (
                  <div key={columnId} className='flex items-center gap-1 pr-1'>
                    <DropdownMenuCheckboxItem className='flex-1' checked={table.getColumn(columnId)?.getIsVisible()} onCheckedChange={(checked) => table.getColumn(columnId)?.toggleVisibility(Boolean(checked))} onSelect={(event) => event.preventDefault()}>
                      {field.label}
                    </DropdownMenuCheckboxItem>
                    <Button type='button' variant='ghost' size='icon-sm' aria-label={'向左移動' + field.label} disabled={index === 0} onClick={() => moveColumn(columnId, -1)}><ArrowUp className='size-3.5' /></Button>
                    <Button type='button' variant='ghost' size='icon-sm' aria-label={'向右移動' + field.label} disabled={index === columnOrder.length - 1} onClick={() => moveColumn(columnId, 1)}><ArrowDown className='size-3.5' /></Button>
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type='button' variant='outline' size='sm' disabled={isExporting || reportQuery.isPending} onClick={exportCsv}>
            <Download className={cn('size-4', isExporting && 'animate-pulse')} />{isExporting ? '匯出中…' : '匯出完整結果'}
          </Button>
        </div>
      </div>

      {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 TIPTOP 工單中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>TIPTOP 工單查詢失敗，請確認日期條件或稍後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合條件的工單。</div>}
      {data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='erp-wo-readonly-table'>
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className='sticky top-0 z-20 bg-background'>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => <TableHead key={header.id} style={{ width: header.getSize() }}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.original.wo}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className='py-1.5' style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length > 0 && (
        <div className='flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>第 {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 頁</span>
          <div className='flex items-center gap-2'>
            <label htmlFor='erp-wo-readonly-page-size' className='text-muted-foreground'>每頁</label>
            <select id='erp-wo-readonly-page-size' className='h-8 rounded-md border bg-background px-2' value={pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <Button type='button' variant='outline' size='sm' disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>上一頁</Button>
            <Button type='button' variant='outline' size='sm' disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>下一頁</Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ErpWoReadonly
