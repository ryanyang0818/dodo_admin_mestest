import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

import { type MesWoReportRow, PageMesWoReportService } from '@/client'
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

import {
  dodoReportConfig,
  type MesWoReportFieldKey,
} from './dodo-report.config'

type ReportRow = MesWoReportRow
type Filters = {
  createDateFrom: string
  createDateTo: string
  wo: string
  partno: string
  status: string
  route: string
}
type SavedReportState = {
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  pageSize?: number
}
type FilterOption = { label: string; value: unknown }

const STORAGE_KEY = 'dodo-report:' + dodoReportConfig.reportKey + ':v1'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const today = new Date()
const todayValue = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const monthStartValue = todayValue.slice(0, 8) + '01'
const DEFAULT_FILTERS: Filters = {
  createDateFrom: monthStartValue,
  createDateTo: todayValue,
  wo: '',
  partno: '',
  status: '',
  route: '',
}
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [MesWoReportFieldKey, (typeof dodoReportConfig.fields)[MesWoReportFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)
const EMPTY_ROWS: MesWoReportRow[] = []

// 將搜尋條件轉成 API 參數，空值不送
function toApiParams(filters: Filters) {
  return {
    createDateFrom: filters.createDateFrom,
    createDateTo: filters.createDateTo,
    wo: filters.wo.trim() || undefined,
    partno: filters.partno.trim() || undefined,
    status: filters.status || undefined,
    route: filters.route || undefined,
  }
}

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 將日期格式化為台北時區
function formatDate(value: unknown, withTime: boolean, emptyText: string): string {
  if (!value) return emptyText
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return emptyText
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  if (withTime) {
    options.hour = '2-digit'
    options.minute = '2-digit'
    options.hour12 = false
  }
  return new Intl.DateTimeFormat('zh-TW', options).format(date)
}

// 依欄位設定取得人類可讀文字
function formatFieldValue(key: MesWoReportFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  const option = (field.options as readonly FilterOption[])
    .find((item) => String(item.value) === String(value))
  if (option) return option.label
  if (field.format === 'date') return formatDate(value, false, field.emptyText)
  if (field.format === 'datetime') return formatDate(value, true, field.emptyText)
  if (field.format === 'boolean') return value ? '是' : '否'
  if (field.format === 'number' || field.format === 'currency') {
    return Number(value).toLocaleString('zh-TW')
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : field.emptyText
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"'
}

// 下載目前篩選結果的 UTF-8 BOM CSV
function downloadCsv(rows: ReportRow[]): void {
  const exportFields = fieldEntries.filter(([, field]) => field.exportable)
  const lines = [
    exportFields.map(([, field]) => escapeCsv(field.label)).join(','),
    ...rows.map((row) => exportFields
      .map(([key]) => escapeCsv(formatFieldValue(key, row[key])))
      .join(',')),
  ]
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()).replaceAll('-', '').replaceAll(':', '').replace(' ', '-')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = dodoReportConfig.reportTitle + '-' + timestamp + '.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

// 呈現設定驅動的報表儲存格
function renderCell(key: MesWoReportFieldKey, value: unknown) {
  const field = dodoReportConfig.fields[key]
  if (key === 'status' || key === 'erp_status') {
    return <Badge variant='outline'>{formatFieldValue(key, value)}</Badge>
  }
  if (field.format === 'badge-list') {
    const values = Array.isArray(value) ? value : []
    if (!values.length) return <span className='text-muted-foreground'>{field.emptyText}</span>
    return (
      <div className='flex flex-wrap gap-1'>
        {values.map((item) => <Badge key={String(item)} variant='secondary'>{String(item)}</Badge>)}
      </div>
    )
  }
  if (field.format === 'boolean') {
    return <Badge variant={value ? 'default' : 'outline'}>{formatFieldValue(key, value)}</Badge>
  }
  return <span className='whitespace-normal'>{formatFieldValue(key, value)}</span>
}

// 依欄位篩選型別比對資料
function filterFieldValue(
  key: MesWoReportFieldKey,
  rawValue: unknown,
  filterValue: unknown,
): boolean {
  const field = dodoReportConfig.fields[key]
  if (field.filterType === 'boolean' || field.filterType === 'select') {
    if (Array.isArray(rawValue)) return rawValue.some((item) => String(item) === String(filterValue))
    return String(rawValue) === String(filterValue)
  }
  if (field.filterType === 'date') {
    return String(rawValue ?? '').slice(0, 10) === String(filterValue)
  }
  if (field.filterType === 'date-range') {
    const [from, to] = filterValue as [string, string]
    const value = String(rawValue ?? '').slice(0, 10)
    return (!from || value >= from) && (!to || value <= to)
  }
  if (field.filterType === 'number-range') {
    const [minimum, maximum] = filterValue as [string, string]
    const value = Number(rawValue)
    return (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum))
  }
  return formatFieldValue(key, rawValue)
    .toLocaleLowerCase('zh-TW')
    .includes(String(filterValue).toLocaleLowerCase('zh-TW'))
}

// 產生由靜態設定驅動的 TanStack 欄位
function buildColumns(): ColumnDef<ReportRow>[] {
  return fieldEntries.map(([key, field]): ColumnDef<ReportRow> => ({
    id: key,
    accessorKey: key,
    size: field.width,
    enableSorting: dodoReportConfig.enableSorting && field.sortable,
    enableColumnFilter: dodoReportConfig.enableFilters
      && field.filterable
      && field.filterType !== 'none',
    filterFn: (row, columnId, value) => filterFieldValue(key, row.getValue(columnId), value),
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

// MES 工單報表純內容元件，供 Tab 與 standalone route 共用
export function MesWoReport() {
  const { showSuccessToast } = useCustomToast()
  const savedState = useMemo(readSavedState, [])
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [submitted, setSubmitted] = useState<Filters>(DEFAULT_FILTERS)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...defaultVisibility,
    ...(dodoReportConfig.enableColumnVisibility ? savedState.columnVisibility : {}),
  })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    dodoReportConfig.enableColumnOrder
      ? savedState.columnOrder ?? defaultColumnOrder
      : defaultColumnOrder,
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: savedState.pageSize ?? 25,
  })
  const optionsQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'options'],
    queryFn: () => PageMesWoReportService.readMesWoReportOptions(),
    staleTime: 10 * 60 * 1000,
  })
  const sqlQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'sql', draft],
    queryFn: () => PageMesWoReportService.readMesWoReportSql(toApiParams(draft)),
    enabled: Boolean(draft.createDateFrom && draft.createDateTo),
    placeholderData: keepPreviousData,
  })
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report', submitted],
    queryFn: () => PageMesWoReportService.readMesWoReport(toApiParams(submitted)),
  })
  const data = reportQuery.data?.data ?? EMPTY_ROWS
  const columns = useMemo(buildColumns, [])
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, columnOrder, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: dodoReportConfig.enablePagination
      ? getPaginationRowModel()
      : undefined,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLocaleLowerCase('zh-TW')
      return fieldEntries.some(([key, field]) => field.filterable
        && formatFieldValue(key, row.original[key]).toLocaleLowerCase('zh-TW').includes(query))
    },
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      columnOrder: dodoReportConfig.enableColumnOrder ? columnOrder : defaultColumnOrder,
      columnVisibility: dodoReportConfig.enableColumnVisibility
        ? columnVisibility
        : defaultVisibility,
      pageSize: dodoReportConfig.enablePagination ? pagination.pageSize : undefined,
    }))
  }, [columnOrder, columnVisibility, pagination.pageSize])

  const filteredRows = table.getFilteredRowModel().rows
  const isDirty = JSON.stringify(draft) !== JSON.stringify(submitted)
  const hasConditions = Boolean(
    (dodoReportConfig.enableGlobalSearch && globalFilter)
    || JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTERS)
    || (dodoReportConfig.enableFilters && columnFilters.length)
    || (dodoReportConfig.enableSorting && sorting.length),
  )

  // 更新單一後端搜尋條件
  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // 送出後端搜尋條件；條件未變時直接重新查詢
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isDirty) setSubmitted(draft)
    else reportQuery.refetch()
    table.setPageIndex(0)
  }

  // 複製預計執行的 SQL
  async function copySql() {
    if (!sqlQuery.data) return
    await navigator.clipboard.writeText(sqlQuery.data.sql)
    showSuccessToast('已複製 SQL')
  }

  // 清除報表查詢條件
  function clearConditions() {
    setDraft(DEFAULT_FILTERS)
    setSubmitted(DEFAULT_FILTERS)
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([])
    table.setPageIndex(0)
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

  // 取得設定或資料推導出的篩選選項
  function getFilterOptions(key: MesWoReportFieldKey): FilterOption[] {
    const configured = dodoReportConfig.fields[key].options as readonly FilterOption[]
    if (configured.length) return [...configured]
    const values = data.flatMap((row) => {
      const value = row[key]
      return Array.isArray(value) ? value : [value]
    }).filter((value) => value !== null && value !== undefined && value !== '')
    return [...new Set(values.map(String))].sort().map((value) => ({ label: value, value }))
  }

  // 依欄位設定呈現篩選控制項
  function renderFilterControl(key: MesWoReportFieldKey) {
    const field = dodoReportConfig.fields[key]
    const column = table.getColumn(key)
    if (!column || !column.getCanFilter()) return null
    if (field.filterType === 'boolean' || field.filterType === 'select') {
      return (
        <select
          key={key}
          aria-label={'篩選' + field.label}
          className='h-9 max-w-64 rounded-md border bg-background px-3 text-sm'
          value={String(column.getFilterValue() ?? '')}
          onChange={(event) => {
            const selected = getFilterOptions(key)
              .find((option) => String(option.value) === event.target.value)
            column.setFilterValue(event.target.value ? selected?.value : undefined)
            table.setPageIndex(0)
          }}
        >
          <option value=''>全部{field.label}</option>
          {getFilterOptions(key).map((option) => (
            <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
          ))}
        </select>
      )
    }
    if (field.filterType === 'date-range' || field.filterType === 'number-range') {
      const value = (column.getFilterValue() as [string, string] | undefined) ?? ['', '']
      const inputType = field.filterType === 'date-range' ? 'date' : 'number'
      return (
        <div key={key} className='flex items-center gap-1' aria-label={'篩選' + field.label}>
          <Input type={inputType} aria-label={field.label + '起始值'} className='h-9 w-36' value={value[0]} onChange={(event) => {
            const next: [string, string] = [event.target.value, value[1]]
            column.setFilterValue(next.some(Boolean) ? next : undefined)
            table.setPageIndex(0)
          }} />
          <span className='text-muted-foreground'>—</span>
          <Input type={inputType} aria-label={field.label + '結束值'} className='h-9 w-36' value={value[1]} onChange={(event) => {
            const next: [string, string] = [value[0], event.target.value]
            column.setFilterValue(next.some(Boolean) ? next : undefined)
            table.setPageIndex(0)
          }} />
        </div>
      )
    }
    return (
      <Input
        key={key}
        type={field.filterType === 'date' ? 'date' : 'text'}
        aria-label={'篩選' + field.label}
        placeholder={'篩選' + field.label}
        className='h-9 w-44'
        value={String(column.getFilterValue() ?? '')}
        onChange={(event) => {
          column.setFilterValue(event.target.value || undefined)
          table.setPageIndex(0)
        }}
      />
    )
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
          <span className='block'>建立日期起</span>
          <Input type='date' required className='h-9 w-40' value={draft.createDateFrom} onChange={(event) => updateDraft('createDateFrom', event.target.value)} />
        </label>
        <label className='space-y-1 text-xs text-muted-foreground'>
          <span className='block'>建立日期迄</span>
          <Input type='date' required className='h-9 w-40' value={draft.createDateTo} onChange={(event) => updateDraft('createDateTo', event.target.value)} />
        </label>
        <Input aria-label='工單編號' className='h-9 w-48' maxLength={255} placeholder='工單編號…' value={draft.wo} onChange={(event) => updateDraft('wo', event.target.value)} />
        <Input aria-label='料號' className='h-9 w-48' maxLength={255} placeholder='料號…' value={draft.partno} onChange={(event) => updateDraft('partno', event.target.value)} />
        <select aria-label='MES 狀態' className='h-9 max-w-48 rounded-md border bg-background px-3 text-sm' value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
          <option value=''>全部 MES 狀態</option>
          {optionsQuery.data?.statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label='流程' className='h-9 max-w-64 rounded-md border bg-background px-3 text-sm' value={draft.route} onChange={(event) => updateDraft('route', event.target.value)}>
          <option value=''>全部流程</option>
          {optionsQuery.data?.routes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button type='submit' size='sm' disabled={reportQuery.isFetching}>
          <RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} />
          {isDirty ? '查詢' : '重新查詢'}
        </Button>
        {hasConditions && <Button type='button' variant='ghost' size='sm' onClick={clearConditions}><X className='size-4' />清除條件</Button>}
      </form>
      <details className='rounded-md border bg-muted/20'>
        <summary className='cursor-pointer select-none px-3 py-2 text-sm font-medium'>
          預計執行的 SQL{isDirty && <span className='ml-2 text-xs font-normal text-amber-600'>（條件已變更，按「查詢」後執行）</span>}
        </summary>
        <div className='border-t p-3'>
          <div className='mb-2 flex items-center gap-2'>
            <span className='text-xs text-muted-foreground'>參數：</span>
            <div className='flex flex-wrap gap-1'>
              {Object.entries(sqlQuery.data?.params ?? {}).map(([key, value]) => <Badge key={key} variant='outline' className='font-mono'>:{key} = {String(value)}</Badge>)}
            </div>
            <Button type='button' variant='outline' size='sm' className='ml-auto' disabled={!sqlQuery.data} onClick={copySql}><Copy className='size-4' />複製</Button>
          </div>
          <pre className='max-h-80 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100'><code>{draft.createDateFrom && draft.createDateTo ? sqlQuery.data?.sql ?? '產生中…' : '請先填寫完整日期區間。'}</code></pre>
        </div>
      </details>
      <div className='flex flex-wrap items-center gap-2'>
        {dodoReportConfig.enableGlobalSearch && (
          <div className='relative'>
            <Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              aria-label='搜尋報表'
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value)
                table.setPageIndex(0)
              }}
              placeholder='搜尋報表…'
              className='h-9 w-72 pl-8'
            />
          </div>
        )}
        {dodoReportConfig.enableFilters
          && fieldEntries.map(([key]) => renderFilterControl(key))}
        <span className='ml-auto text-sm text-muted-foreground'>
          {filteredRows.length} / {data.length} 筆
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          aria-label='重新整理報表'
          disabled={reportQuery.isFetching}
          onClick={() => reportQuery.refetch()}
        >
          <RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} />
        </Button>
        {(dodoReportConfig.enableColumnVisibility || dodoReportConfig.enableColumnOrder) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type='button' variant='outline' size='icon' aria-label='欄位設定'>
                <Settings2 className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-64'>
              <DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder.map((columnId, index) => {
                const column = table.getColumn(columnId)
                if (!column) return null
                const field = dodoReportConfig.fields[columnId as MesWoReportFieldKey]
                return (
                  <div key={columnId} className='flex items-center'>
                    {dodoReportConfig.enableColumnVisibility ? (
                      <DropdownMenuCheckboxItem
                        className='min-w-0 flex-1'
                        checked={column.getIsVisible()}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                      >
                        <span className='truncate'>{field.label}</span>
                      </DropdownMenuCheckboxItem>
                    ) : (
                      <span className='min-w-0 flex-1 truncate px-2 py-1.5 text-sm'>{field.label}</span>
                    )}
                    {dodoReportConfig.enableColumnOrder && (
                      <div className='flex pr-1'>
                        <Button type='button' variant='ghost' size='icon-sm' aria-label={'向左移動' + field.label} disabled={index === 0} onClick={() => moveColumn(columnId, -1)}><ArrowUp className='size-3.5' /></Button>
                        <Button type='button' variant='ghost' size='icon-sm' aria-label={'向右移動' + field.label} disabled={index === columnOrder.length - 1} onClick={() => moveColumn(columnId, 1)}><ArrowDown className='size-3.5' /></Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {dodoReportConfig.enableExport && (
          <Button type='button' variant='outline' size='sm' disabled={!filteredRows.length} onClick={() => downloadCsv(filteredRows.map((row) => row.original))}>
            <Download className='size-4' />匯出 CSV
          </Button>
        )}
      </div>
      {reportQuery.data?.truncated && <div role='status' className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800'>結果超過 2000 筆，只顯示前 2000 筆，請縮小搜尋條件；CSV 也只包含已載入資料。</div>}
      {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 MES 正式區工單中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>MES 工單查詢失敗，請確認日期條件或稍後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合條件的工單。</div>}
      {reportQuery.isSuccess && data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='mes-wo-report-table'>
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className='sticky top-0 z-20 bg-background'>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className='py-1.5'
                      style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dodoReportConfig.enablePagination && reportQuery.isSuccess && data.length > 0 && (
        <div className='flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>
            第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 頁
          </span>
          <div className='flex items-center gap-2'>
            <label htmlFor='report-page-size' className='text-muted-foreground'>每頁</label>
            <select id='report-page-size' className='h-8 rounded-md border bg-background px-2' value={pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
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

export default MesWoReport
