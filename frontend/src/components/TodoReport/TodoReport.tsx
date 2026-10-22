import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Pin, RefreshCw, Search, Settings2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PageTodoReportService, type TodoReportRow } from '@/client'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { dodoReportConfig, statusLabels, termLabels, type TodoReportFieldKey } from './dodo-report.config'

type Density = 'comfortable' | 'compact'
type SavedReportState = {
  columnFilters?: ColumnFiltersState
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  density?: Density
}

const STORAGE_KEY = 'dodo-report:todo-report:v1'
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [TodoReportFieldKey, (typeof dodoReportConfig.fields)[TodoReportFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(fieldEntries.map(([key, field]) => [key, field.visible]))

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 將日期時間格式化為台北時區
function formatDateTime(value: unknown, emptyText: string): string {
  if (!value) return emptyText
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(String(value)))
}

// 依欄位設定取得人類可讀文字
function formatFieldValue(key: TodoReportFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  if (key === 'status') return statusLabels[value as keyof typeof statusLabels] ?? String(value)
  if (key === 'term') return termLabels[value as keyof typeof termLabels] ?? String(value)
  if (key === 'is_pinned') return value ? '是' : '否'
  if (key === 'created_at') return formatDateTime(value, field.emptyText)
  if (Array.isArray(value)) return value.length ? value.join(', ') : field.emptyText
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

// 下載目前篩選結果的 UTF-8 BOM CSV
function downloadCsv(rows: TodoReportRow[]): void {
  const exportFields = fieldEntries.filter(([, field]) => field.exportable)
  const lines = [
    exportFields.map(([, field]) => escapeCsv(field.label)).join(','),
    ...rows.map((row) => exportFields.map(([key]) => escapeCsv(formatFieldValue(key, row[key]))).join(',')),
  ]
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replaceAll('-', '').replaceAll(':', '').replace(' ', '-')
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `我的待辦報表-${timestamp}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// 呈現報表儲存格內容
function renderCell(key: TodoReportFieldKey, value: unknown) {
  const field = dodoReportConfig.fields[key]
  if (key === 'content') return <span className='block truncate' title={String(value)}>{formatFieldValue(key, value)}</span>
  if (key === 'status' || key === 'term') return <Badge variant='secondary'>{formatFieldValue(key, value)}</Badge>
  if (key === 'is_pinned') return value ? <Pin className='size-4 text-primary' aria-label='已釘選' /> : <span className='text-muted-foreground'>否</span>
  if (key === 'tags') {
    const tags = Array.isArray(value) ? value : []
    if (!tags.length) return <span className='text-muted-foreground'>{field.emptyText}</span>
    return <div className='flex flex-wrap gap-1'>{tags.map((tag) => <Badge key={tag} variant='outline'>{tag}</Badge>)}</div>
  }
  return <span>{formatFieldValue(key, value)}</span>
}

// 產生由靜態設定驅動的 TanStack 欄位
function buildColumns(): ColumnDef<TodoReportRow>[] {
  return fieldEntries.map(([key, field]) => ({
    id: key,
    accessorKey: key,
    size: field.width,
    enableSorting: field.sortable,
    enableColumnFilter: field.filterable,
    filterFn: key === 'tags'
      ? (row, columnId, value) => (row.getValue(columnId) as string[]).includes(value)
      : key === 'due_date' || key === 'created_at'
        ? (row, columnId, value: [string, string]) => {
          const current = String(row.getValue(columnId) ?? '').slice(0, 10)
          return (!value?.[0] || current >= value[0]) && (!value?.[1] || current <= value[1])
        }
        : 'auto',
    header: ({ column }) => <Button type='button' variant='ghost' className='-ml-3 h-8' disabled={!column.getCanSort()} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>{field.label}{column.getCanSort() && <ArrowUpDown className='ml-1 size-3.5' />}</Button>,
    cell: ({ getValue }) => renderCell(key, getValue()),
  }))
}

// 我的待辦唯讀報表
export function TodoReport() {
  const savedState = useMemo(readSavedState, [])
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(savedState.columnFilters ?? [])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ ...defaultVisibility, ...savedState.columnVisibility })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(savedState.columnOrder ?? defaultColumnOrder)
  const [density, setDensity] = useState<Density>(savedState.density ?? 'compact')
  const reportQuery = useQuery({ queryKey: [dodoReportConfig.reportKey], queryFn: () => PageTodoReportService.readTodoReport() })
  const data = reportQuery.data?.data ?? []
  const columns = useMemo(buildColumns, [])
  const tagOptions = useMemo(() => [...new Set(data.flatMap((row) => row.tags))].sort(), [data])
  const table = useReactTable({
    data, columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLocaleLowerCase('zh-TW')
      return fieldEntries.some(([key, field]) => field.filterable
        && formatFieldValue(key, row.original[key]).toLocaleLowerCase('zh-TW').includes(query))
    },
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columnFilters, columnOrder, columnVisibility, density }))
  }, [columnFilters, columnOrder, columnVisibility, density])

  const filteredRows = table.getFilteredRowModel().rows

  // 清除報表查詢條件
  function clearConditions() {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([{ id: 'created_at', desc: true }])
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

  // 設定日期區間的單一端點
  function setDateFilter(columnId: 'due_date' | 'created_at', index: 0 | 1, value: string) {
    const current = (table.getColumn(columnId)?.getFilterValue() as [string, string]) ?? ['', '']
    const next: [string, string] = [...current]
    next[index] = value
    table.getColumn(columnId)?.setFilterValue(next.some(Boolean) ? next : undefined)
  }

  return <section className='flex min-h-0 flex-1 flex-col gap-4'>
    <PageHeader tabKey={dodoReportConfig.reportKey} title={dodoReportConfig.reportTitle} description={dodoReportConfig.reportDescription} />
    <div className='flex flex-wrap items-center gap-2'>
      <div className='relative'><Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' /><Input aria-label='搜尋報表' value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='搜尋待辦內容或標籤…' className='h-9 w-72 pl-8' /></div>
      <select aria-label='待辦狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={(table.getColumn('status')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('status')?.setFilterValue(event.target.value || undefined)}><option value=''>全部狀態</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label='期限類別' className='h-9 rounded-md border bg-background px-3 text-sm' value={(table.getColumn('term')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('term')?.setFilterValue(event.target.value || undefined)}><option value=''>全部期限</option>{Object.entries(termLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label='標籤' className='h-9 rounded-md border bg-background px-3 text-sm' value={(table.getColumn('tags')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('tags')?.setFilterValue(event.target.value || undefined)}><option value=''>全部標籤</option>{tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
      <select aria-label='釘選狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={(table.getColumn('is_pinned')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('is_pinned')?.setFilterValue(event.target.value === '' ? undefined : event.target.value === 'true')}><option value=''>全部釘選</option><option value='true'>已釘選</option><option value='false'>未釘選</option></select>
      <Input aria-label='到期日起日' type='date' className='h-9 w-36' onChange={(event) => setDateFilter('due_date', 0, event.target.value)} />
      <Input aria-label='到期日迄日' type='date' className='h-9 w-36' onChange={(event) => setDateFilter('due_date', 1, event.target.value)} />
      {(globalFilter || columnFilters.length) && <Button type='button' variant='ghost' size='sm' onClick={clearConditions}><X className='size-4' />清除條件</Button>}
      <span className='ml-auto text-sm text-muted-foreground'>{filteredRows.length} / {data.length} 筆</span>
      <Button type='button' variant='outline' size='icon' aria-label='重新整理報表' disabled={reportQuery.isFetching} onClick={() => reportQuery.refetch()}><RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} /></Button>
      <Button type='button' variant='outline' size='sm' onClick={() => setDensity((value) => value === 'comfortable' ? 'compact' : 'comfortable')}>密度：{density === 'comfortable' ? '舒適' : '緊密'}</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button type='button' variant='outline' size='icon' aria-label='欄位設定'><Settings2 className='size-4' /></Button></DropdownMenuTrigger><DropdownMenuContent align='end' className='w-64'><DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel><DropdownMenuSeparator />{columnOrder.map((columnId, index) => { const column = table.getColumn(columnId); if (!column) return null; const field = dodoReportConfig.fields[columnId as TodoReportFieldKey]; return <div key={columnId} className='flex items-center'><DropdownMenuCheckboxItem className='min-w-0 flex-1' checked={column.getIsVisible()} onSelect={(event) => event.preventDefault()} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>{field.label}</DropdownMenuCheckboxItem><Button type='button' variant='ghost' size='icon-sm' aria-label={`向左移動${field.label}`} disabled={index === 0} onClick={() => moveColumn(columnId, -1)}><ArrowUp className='size-3.5' /></Button><Button type='button' variant='ghost' size='icon-sm' aria-label={`向右移動${field.label}`} disabled={index === columnOrder.length - 1} onClick={() => moveColumn(columnId, 1)}><ArrowDown className='size-3.5' /></Button></div> })}</DropdownMenuContent></DropdownMenu>
      <Button type='button' variant='outline' size='sm' disabled={!filteredRows.length} onClick={() => downloadCsv(filteredRows.map((row) => row.original))}><Download className='size-4' />匯出 CSV</Button>
    </div>
    {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>載入報表中…</div>}
    {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>報表載入失敗，請重新整理後再試。</div>}
    {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>目前沒有待辦資料。</div>}
    {reportQuery.isSuccess && data.length > 0 && <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='todo-report-table'><Table style={{ width: table.getTotalSize() }}><TableHeader className='sticky top-0 z-20 bg-background'>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} style={{ width: header.getSize() }}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={density === 'compact' ? 'py-1.5' : 'py-3'} style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
  </section>
}

export default TodoReport
