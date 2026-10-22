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
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react'
import { Fragment, type FormEvent, useEffect, useMemo, useState } from 'react'

import {
  type MesWorkReportRow,
  type PageMesWorkReportReadMesWorkReportData,
  PageMesWorkReportService,
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

import {
  dodoReportConfig,
  type MesWorkReportFieldKey,
} from './dodo-report.config'

type ReportRow = MesWorkReportRow
type Filters = {
  reportDateFrom: string
  reportDateTo: string
  wo: string
  lot: string
  partNo: string
  status: '' | 'I' | 'N' | 'Y'
  lineNo: string
  erpStatus: '' | 'W' | 'D' | 'E' | 'U'
}
type SavedReportState = {
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  pageSize?: number
}

const STORAGE_KEY = 'dodo-report:' + dodoReportConfig.reportKey + ':v1'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const todayValue = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const DEFAULT_FILTERS: Filters = {
  reportDateFrom: todayValue.slice(0, 8) + '01',
  reportDateTo: todayValue,
  wo: '',
  lot: '',
  partNo: '',
  status: '',
  lineNo: '',
  erpStatus: '',
}
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [MesWorkReportFieldKey, (typeof dodoReportConfig.fields)[MesWorkReportFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)
const EMPTY_ROWS: MesWorkReportRow[] = []

const statusLabels: Record<string, string> = {
  I: '維護中',
  N: '待上傳',
  Y: '已上傳',
}
const erpStatusLabels: Record<string, string> = {
  W: '待處理',
  D: '已處理',
  E: '錯誤',
  U: '錯誤待重送',
}

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 將搜尋與分頁狀態轉成 API 參數
function toApiParams(
  filters: Filters,
  sorting: SortingState,
  pagination: PaginationState,
): PageMesWorkReportReadMesWorkReportData {
  const currentSort = sorting[0]
  return {
    reportDateFrom: filters.reportDateFrom,
    reportDateTo: filters.reportDateTo,
    wo: filters.wo.trim() || undefined,
    lot: filters.lot.trim() || undefined,
    partNo: filters.partNo.trim() || undefined,
    status: filters.status || undefined,
    lineNo: filters.lineNo || undefined,
    erpStatus: filters.erpStatus || undefined,
    sortBy: (currentSort?.id ?? 'report_date') as PageMesWorkReportReadMesWorkReportData['sortBy'],
    sortDirection: currentSort?.desc === false ? 'asc' : 'desc',
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }
}

// 將日期時間格式化為台北時區
function formatDateTime(value: unknown, emptyText = '—'): string {
  if (!value) return emptyText
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

// 將秒數格式化為 HH:mm:ss
function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return '進行中'
  const total = Math.max(0, Math.round(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
}

// 依欄位設定格式化主表內容
function formatFieldValue(key: MesWorkReportFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  if (field.format === 'datetime') return formatDateTime(value, field.emptyText)
  if (field.format === 'number') return Number(value).toLocaleString('zh-TW')
  if (field.format === 'status') return statusLabels[String(value)] ?? String(value)
  if (field.format === 'erp-status') return erpStatusLabels[String(value)] ?? String(value)
  return String(value)
}

// 依狀態欄位呈現識別標籤
function renderCell(key: MesWorkReportFieldKey, value: unknown) {
  const text = formatFieldValue(key, value)
  if (key === 'status') {
    return <Badge variant={value === 'Y' ? 'secondary' : 'outline'}>{text}</Badge>
  }
  if (key === 'erp_status') {
    return <Badge variant={value === 'E' || value === 'U' ? 'destructive' : 'outline'}>{text}</Badge>
  }
  return <span className='whitespace-normal'>{text}</span>
}

// 產生設定驅動的主表欄位
function buildColumns(): ColumnDef<ReportRow>[] {
  return fieldEntries.map(([key, field]): ColumnDef<ReportRow> => ({
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

// 顯示點選資料列的完整欄位與報工人員
function ExpandedReportRow({ rowKey }: { rowKey: string }) {
  const detailQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'details', rowKey],
    queryFn: () => PageMesWorkReportService.readMesWorkReportDetails({ rowKey }),
  })

  if (detailQuery.isPending) {
    return <div className='p-6 text-center text-sm text-muted-foreground'>載入報工明細中…</div>
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <div role='alert' className='p-6 text-center text-sm text-destructive'>報工明細載入失敗。</div>
  }

  const report = detailQuery.data.report
  const details = [
    ['工單編號', report.wo], ['批號', report.lot],
    ['批號狀態', report.lot_status], ['料號', report.part_no],
    ['線別代碼', report.line_no], ['流程', report.route_no],
    ['工作站代碼', report.operation_no], ['工作站', report.operation],
    ['數量', report.output_qty], ['報廢數量', report.scrap_qty],
    ['報工人數', report.report_user_num], ['人時(分)', report.work_total],
    ['機時(分)', report.equipment_total], ['狀態', statusLabels[report.status] ?? report.status],
    ['報工時間', formatDateTime(report.report_date)], ['報工時間起', formatDateTime(report.start_time)],
    ['報工時間迄', formatDateTime(report.end_time, '進行中')],
    ['ERP 介接狀態', report.erp_status ? erpStatusLabels[report.erp_status] ?? report.erp_status : '—'],
    ['ERP 介接處理日期', formatDateTime(report.erp_date)], ['ERP 介接錯誤訊息', report.erp_message],
    ['MES 單號', report.mes_no], ['更新日期', formatDateTime(report.update_date)],
    ['說明', report.note], ['過站說明', report.station_remark],
  ]

  return (
    <div className='space-y-5 bg-muted/20 p-4'>
      <div className='grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4'>
        {details.map(([label, value]) => (
          <div key={String(label)} className='min-w-0'>
            <div className='text-xs text-muted-foreground'>{label}</div>
            <div className='break-words text-sm font-medium'>{value === null || value === undefined || value === '' ? '—' : String(value)}</div>
          </div>
        ))}
      </div>
      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>報工人員（{detailQuery.data.personnel.length}）</h3>
        {!detailQuery.data.personnel.length ? (
          <div className='rounded-md border bg-background p-4 text-sm text-muted-foreground'>查無報工人員明細。</div>
        ) : (
          <div className='overflow-auto rounded-md border bg-background'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工作站</TableHead>
                  <TableHead>帳號</TableHead>
                  <TableHead>開始時間</TableHead>
                  <TableHead>結束時間</TableHead>
                  <TableHead>人時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailQuery.data.personnel.map((person, index) => (
                  <TableRow key={[person.user_no, person.start_time, index].join('-')}>
                    <TableCell>{person.operation_no ?? '—'}</TableCell>
                    <TableCell>{person.user_no}</TableCell>
                    <TableCell>{formatDateTime(person.start_time)}</TableCell>
                    <TableCell>{formatDateTime(person.end_time, '進行中')}</TableCell>
                    <TableCell>{formatDuration(person.total_seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// MES 報工報表純內容元件，供 Tab 與 standalone route 共用
export function MesWorkReport() {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const savedState = useMemo(readSavedState, [])
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [submitted, setSubmitted] = useState<Filters>(DEFAULT_FILTERS)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'report_date', desc: true }])
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
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const apiParams = toApiParams(submitted, sorting, pagination)
  const draftParams = toApiParams(draft, sorting, pagination)

  const optionsQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'options'],
    queryFn: () => PageMesWorkReportService.readMesWorkReportOptions(),
    staleTime: 10 * 60 * 1000,
  })
  const sqlQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'sql', draftParams],
    queryFn: () => PageMesWorkReportService.readMesWorkReportSql(draftParams),
    enabled: Boolean(draft.reportDateFrom && draft.reportDateTo),
    placeholderData: keepPreviousData,
  })
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report', apiParams],
    queryFn: () => PageMesWorkReportService.readMesWorkReport(apiParams),
    placeholderData: keepPreviousData,
  })

  const data = reportQuery.data?.data ?? EMPTY_ROWS
  const columns = useMemo<ColumnDef<ReportRow>[]>(() => [
    {
      id: '_expand',
      size: 48,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label={expandedRowKey === row.original.row_key ? '收合明細' : '展開明細'}
          onClick={(event) => {
            event.stopPropagation()
            setExpandedRowKey((current) => current === row.original.row_key ? null : row.original.row_key)
          }}
        >
          {expandedRowKey === row.original.row_key
            ? <ChevronDown className='size-4' />
            : <ChevronRight className='size-4' />}
        </Button>
      ),
    },
    ...buildColumns(),
  ], [expandedRowKey])
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder: ['_expand', ...columnOrder],
      pagination,
    },
    pageCount: Math.max(1, Math.ceil((reportQuery.data?.total ?? 0) / pagination.pageSize)),
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (updater) => {
      setSorting((current) => typeof updater === 'function' ? updater(current) : updater)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
      setExpandedRowKey(null)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      setPagination((current) => typeof updater === 'function' ? updater(current) : updater)
      setExpandedRowKey(null)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      columnOrder,
      columnVisibility,
      pageSize: pagination.pageSize,
    }))
  }, [columnOrder, columnVisibility, pagination.pageSize])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(submitted)
  const hasConditions = JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTERS)
    || sorting[0]?.id !== 'report_date'
    || sorting[0]?.desc !== true

  // 更新單一後端搜尋條件
  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // 送出後端搜尋條件並回到第一頁
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setExpandedRowKey(null)
    if (isDirty) setSubmitted(draft)
    else reportQuery.refetch()
  }

  // 清除查詢與排序條件
  function clearConditions() {
    setDraft(DEFAULT_FILTERS)
    setSubmitted(DEFAULT_FILTERS)
    setSorting([{ id: 'report_date', desc: true }])
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setExpandedRowKey(null)
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
      const result = await PageMesWorkReportService.exportMesWorkReport(apiParams)
      const blob = new Blob([String(result ?? '')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `mes-work-report-${todayValue}.csv`
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
          <span className='block'>報工日期起</span>
          <Input type='date' required className='h-9 w-40' value={draft.reportDateFrom} onChange={(event) => updateDraft('reportDateFrom', event.target.value)} />
        </label>
        <label className='space-y-1 text-xs text-muted-foreground'>
          <span className='block'>報工日期迄</span>
          <Input type='date' required className='h-9 w-40' value={draft.reportDateTo} onChange={(event) => updateDraft('reportDateTo', event.target.value)} />
        </label>
        <Input aria-label='工單編號' className='h-9 w-48' maxLength={255} placeholder='工單編號…' value={draft.wo} onChange={(event) => updateDraft('wo', event.target.value)} />
        <Input aria-label='批號' className='h-9 w-40' maxLength={255} placeholder='批號…' value={draft.lot} onChange={(event) => updateDraft('lot', event.target.value)} />
        <Input aria-label='料號' className='h-9 w-40' maxLength={255} placeholder='料號…' value={draft.partNo} onChange={(event) => updateDraft('partNo', event.target.value)} />
        <select aria-label='狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={draft.status} onChange={(event) => updateDraft('status', event.target.value as Filters['status'])}>
          <option value=''>全部狀態</option>
          {optionsQuery.data?.statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label='線別代碼' className='h-9 max-w-56 rounded-md border bg-background px-3 text-sm' value={draft.lineNo} onChange={(event) => updateDraft('lineNo', event.target.value)}>
          <option value=''>全部線別</option>
          {optionsQuery.data?.lines.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label='ERP 介接狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={draft.erpStatus} onChange={(event) => updateDraft('erpStatus', event.target.value as Filters['erpStatus'])}>
          <option value=''>全部 ERP 狀態</option>
          {optionsQuery.data?.erp_statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button type='submit' size='sm' disabled={reportQuery.isFetching}>
          <RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} />
          {isDirty ? '查詢' : '重新查詢'}
        </Button>
        {hasConditions && <Button type='button' variant='ghost' size='sm' onClick={clearConditions}><X className='size-4' />清除條件</Button>}
      </form>

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
        <span className='text-sm text-muted-foreground'>共 {reportQuery.data?.total.toLocaleString('zh-TW') ?? 0} 筆；點選資料列可查看完整欄位與人員明細。</span>
        <div className='flex items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type='button' variant='outline' size='sm'><Settings2 className='size-4' />欄位</Button></DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-72'>
              <DropdownMenuLabel>顯示與順序</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder.map((columnId, index) => {
                const field = dodoReportConfig.fields[columnId as MesWorkReportFieldKey]
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

      {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 MES 正式區報工中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>MES 報工查詢失敗，請確認日期條件或稍後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合條件的報工資料。</div>}
      {data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='mes-work-report-table'>
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
                <Fragment key={row.original.row_key}>
                  <TableRow
                    className='cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    data-state={expandedRowKey === row.original.row_key ? 'selected' : undefined}
                    tabIndex={0}
                    aria-expanded={expandedRowKey === row.original.row_key}
                    onClick={() => setExpandedRowKey((current) => current === row.original.row_key ? null : row.original.row_key)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setExpandedRowKey((current) => current === row.original.row_key ? null : row.original.row_key)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className='py-1.5' style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandedRowKey === row.original.row_key && (
                    <TableRow>
                      <TableCell className='p-0' colSpan={row.getVisibleCells().length}><ExpandedReportRow rowKey={row.original.row_key} /></TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length > 0 && (
        <div className='flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>第 {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 頁</span>
          <div className='flex items-center gap-2'>
            <label htmlFor='mes-work-report-page-size' className='text-muted-foreground'>每頁</label>
            <select id='mes-work-report-page-size' className='h-8 rounded-md border bg-background px-2' value={pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
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

export default MesWorkReport
