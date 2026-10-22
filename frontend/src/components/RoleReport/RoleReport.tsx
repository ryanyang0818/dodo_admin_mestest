import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
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
  Download,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { PageSystemRoleReportService, type RoleReportRow } from '@/client'
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
import { cn } from '@/lib/utils'

import { dodoReportConfig, type RoleReportFieldKey } from './dodo-report.config'

type Density = 'comfortable' | 'compact'
type SavedReportState = {
  columnFilters?: ColumnFiltersState
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  density?: Density
}

const STORAGE_KEY = 'dodo-report:system.role-report:v1'
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [RoleReportFieldKey, (typeof dodoReportConfig.fields)[RoleReportFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 將日期格式化為台北時區
function formatDateTime(value: unknown, emptyText: string): string {
  if (!value) return emptyText
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(String(value)))
}

// 依欄位設定取得人類可讀文字
function formatFieldValue(key: RoleReportFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  if (field.format === 'datetime') return formatDateTime(value, field.emptyText)
  if (key === 'is_active') return value ? '啟用' : '停用'
  if (Array.isArray(value)) return value.length ? value.join(', ') : field.emptyText
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

// 下載目前篩選結果的 UTF-8 BOM CSV
function downloadCsv(rows: RoleReportRow[]): void {
  const exportFields = fieldEntries.filter(([, field]) => field.exportable)
  const lines = [
    exportFields.map(([, field]) => escapeCsv(field.label)).join(','),
    ...rows.map((row) => exportFields
      .map(([key]) => escapeCsv(formatFieldValue(key, row[key])))
      .join(',')),
  ]
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replaceAll('-', '').replaceAll(':', '').replace(' ', '-')
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `角色權限報表-${timestamp}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// 呈現報表儲存格內容
function renderCell(key: RoleReportFieldKey, value: unknown) {
  const field = dodoReportConfig.fields[key]
  if (key === 'is_active') {
    return <Badge variant={value ? 'default' : 'outline'}>{value ? '啟用' : '停用'}</Badge>
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className='text-muted-foreground'>{field.emptyText}</span>
    return <div className='flex flex-wrap gap-1'>{value.map((item) => <Badge key={item} variant='secondary'>{item}</Badge>)}</div>
  }
  return <span className='whitespace-normal'>{formatFieldValue(key, value)}</span>
}

// 產生由靜態設定驅動的 TanStack 欄位
function buildColumns(): ColumnDef<RoleReportRow>[] {
  return [
    {
      id: 'expand', size: 48, enableSorting: false,
      header: () => <span className='sr-only'>展開</span>,
      cell: ({ row }) => (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='展開 Menu 權限'
          disabled={!row.getCanExpand()}
          onClick={row.getToggleExpandedHandler()}
        >
          {row.getIsExpanded() ? <ChevronDown className='size-4' /> : <ChevronRight className='size-4' />}
        </Button>
      ),
    },
    ...fieldEntries.map(([key, field]): ColumnDef<RoleReportRow> => ({
      id: key,
      accessorKey: key,
      size: field.width,
      enableSorting: field.sortable,
      enableColumnFilter: field.filterable,
      filterFn: key === 'menu_count'
        ? (row, columnId, value) => Number(row.getValue(columnId)) >= Number(value)
        : 'auto',
      header: ({ column }) => (
        <Button type='button' variant='ghost' className='-ml-3 h-8' disabled={!column.getCanSort()} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {field.label}{column.getCanSort() && <ArrowUpDown className='ml-1 size-3.5' />}
        </Button>
      ),
      cell: ({ getValue }) => renderCell(key, getValue()),
    })),
  ]
}

// 角色權限唯讀報表
export function RoleReport() {
  const savedState = useMemo(readSavedState, [])
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'sort_order', desc: false }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(savedState.columnFilters ?? [])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ ...defaultVisibility, ...savedState.columnVisibility })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(savedState.columnOrder ?? defaultColumnOrder)
  const [density, setDensity] = useState<Density>(savedState.density ?? 'compact')
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey],
    queryFn: () => PageSystemRoleReportService.readRoleReport(),
  })
  const data = reportQuery.data?.data ?? []
  const columns = useMemo(buildColumns, [])
  const table = useReactTable({
    data, columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, columnOrder: ['expand', ...columnOrder] },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: (updater) => {
      const next = typeof updater === 'function' ? updater(['expand', ...columnOrder]) : updater
      setColumnOrder(next.filter((key) => key !== 'expand'))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.menus.length > 0,
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
  const hasConditions = Boolean(globalFilter || columnFilters.length || sorting.length !== 1)

  // 清除報表查詢條件
  function clearConditions() {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([{ id: 'sort_order', desc: false }])
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
      <PageHeader tabKey={dodoReportConfig.reportKey} title={dodoReportConfig.reportTitle} description={dodoReportConfig.reportDescription} />
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input aria-label='搜尋報表' value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='搜尋角色或 Menu…' className='h-9 w-72 pl-8' />
        </div>
        <select aria-label='角色狀態' className='h-9 rounded-md border bg-background px-3 text-sm' value={(table.getColumn('is_active')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('is_active')?.setFilterValue(event.target.value === '' ? undefined : event.target.value === 'true')}>
          <option value=''>全部狀態</option><option value='true'>啟用</option><option value='false'>停用</option>
        </select>
        <Input aria-label='Menu 數下限' type='number' min='0' placeholder='Menu 數 ≥' className='h-9 w-32' value={(table.getColumn('menu_count')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('menu_count')?.setFilterValue(event.target.value || undefined)} />
        {hasConditions && <Button type='button' variant='ghost' size='sm' onClick={clearConditions}><X className='size-4' />清除條件</Button>}
        <span className='ml-auto text-sm text-muted-foreground'>{filteredRows.length} / {data.length} 筆</span>
        <Button type='button' variant='outline' size='icon' aria-label='重新整理報表' disabled={reportQuery.isFetching} onClick={() => reportQuery.refetch()}><RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} /></Button>
        <Button type='button' variant='outline' size='sm' onClick={() => setDensity((value) => value === 'comfortable' ? 'compact' : 'comfortable')}>密度：{density === 'comfortable' ? '舒適' : '緊密'}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type='button' variant='outline' size='icon' aria-label='欄位設定'><Settings2 className='size-4' /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-64'>
            <DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel><DropdownMenuSeparator />
            {columnOrder.map((columnId, index) => {
              const column = table.getColumn(columnId)
              if (!column) return null
              const field = dodoReportConfig.fields[columnId as RoleReportFieldKey]
              return <div key={columnId} className='flex items-center'>
                <DropdownMenuCheckboxItem className='min-w-0 flex-1' checked={column.getIsVisible()} onSelect={(event) => event.preventDefault()} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>{field.label}</DropdownMenuCheckboxItem>
                <Button type='button' variant='ghost' size='icon-sm' aria-label={`向左移動${field.label}`} disabled={index === 0} onClick={() => moveColumn(columnId, -1)}><ArrowUp className='size-3.5' /></Button>
                <Button type='button' variant='ghost' size='icon-sm' aria-label={`向右移動${field.label}`} disabled={index === columnOrder.length - 1} onClick={() => moveColumn(columnId, 1)}><ArrowDown className='size-3.5' /></Button>
              </div>
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type='button' variant='outline' size='sm' disabled={!filteredRows.length} onClick={() => downloadCsv(filteredRows.map((row) => row.original))}><Download className='size-4' />匯出 CSV</Button>
      </div>
      {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>載入報表中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>報表載入失敗，請重新整理後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>目前沒有角色資料。</div>}
      {reportQuery.isSuccess && data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='role-report-table'>
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className='sticky top-0 z-20 bg-background'>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} style={{ width: header.getSize() }}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
            <TableBody>{table.getRowModel().rows.map((row) => <Fragment key={row.id}>
              <TableRow className={cn(!row.original.is_active && 'opacity-55')}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={density === 'compact' ? 'py-1.5' : 'py-3'} style={{ width: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>
              {row.getIsExpanded() && <TableRow><TableCell colSpan={row.getVisibleCells().length} className='bg-muted/20 p-2'>
                <div className='max-h-80 overflow-auto rounded border bg-background'>
                  <table className='w-full table-fixed text-xs'>
                    <thead className='sticky top-0 z-10 bg-muted'>
                      <tr className='h-7 border-b text-left'>
                        <th className='w-48 px-2 py-1 font-medium'>Menu 名稱</th>
                        <th className='w-72 px-2 py-1 font-medium'>Menu key</th>
                        <th className='px-2 py-1 font-medium'>路徑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.original.menus.map((menu) => (
                        <tr key={menu.key} className='h-7 border-b odd:bg-background even:bg-muted/40 hover:bg-muted/70'>
                          <td className='truncate px-2 py-1 font-medium' title={menu.label}>{menu.label}</td>
                          <td className='truncate px-2 py-1 text-muted-foreground' title={menu.key}>{menu.key}</td>
                          <td className='truncate px-2 py-1 text-muted-foreground' title={menu.path ?? '無路徑'}>{menu.path ?? '無路徑'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableCell></TableRow>}
            </Fragment>)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

export default RoleReport
