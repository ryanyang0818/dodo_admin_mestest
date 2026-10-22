import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
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
  Download,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PageHrUserReportService, type UserReportRow } from '@/client'
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

import {
  dodoReportConfig,
  type UserReportFieldKey,
} from './dodo-report.config'

type Density = 'comfortable' | 'compact'

type SavedReportState = {
  columnFilters?: ColumnFiltersState
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  density?: Density
}

const STORAGE_KEY = 'dodo-report:hr.user-report:v1'
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [UserReportFieldKey, (typeof dodoReportConfig.fields)[UserReportFieldKey]]
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
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(String(value)))
}

// 依欄位設定取得人類可讀文字
function formatFieldValue(
  key: UserReportFieldKey,
  value: unknown,
  forExport = false,
): string {
  const field = dodoReportConfig.fields[key]
  if (value === null || value === undefined || value === '') return field.emptyText
  if (field.format === 'datetime') return formatDateTime(value, field.emptyText)
  if (key === 'is_active') return value ? '啟用' : '停用'
  if (key === 'is_superuser') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.join(', ') : field.emptyText
  if (forExport && typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

// 下載目前篩選結果的 UTF-8 BOM CSV
function downloadCsv(rows: UserReportRow[]): void {
  const exportFields = fieldEntries.filter(([, field]) => field.exportable)
  const lines = [
    exportFields.map(([, field]) => escapeCsv(field.label)).join(','),
    ...rows.map((row) =>
      exportFields
        .map(([key]) => escapeCsv(formatFieldValue(key, row[key], true)))
        .join(','),
    ),
  ]
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replaceAll('-', '').replaceAll(':', '').replace(' ', '-')
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `員工帳號報表-${timestamp}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// 呈現報表儲存格內容
function renderCell(key: UserReportFieldKey, value: unknown) {
  const field = dodoReportConfig.fields[key]
  if (key === 'roles') {
    const roles = Array.isArray(value) ? value : []
    if (!roles.length) return <span className='text-muted-foreground'>{field.emptyText}</span>
    return (
      <div className='flex flex-wrap gap-1'>
        {roles.map((role) => <Badge key={role} variant='secondary'>{role}</Badge>)}
      </div>
    )
  }
  if (key === 'is_active') {
    return <Badge variant={value ? 'default' : 'outline'}>{value ? '啟用' : '停用'}</Badge>
  }
  if (key === 'is_superuser') {
    return <Badge variant={value ? 'secondary' : 'outline'}>{value ? '是' : '否'}</Badge>
  }
  return <span className='whitespace-normal'>{formatFieldValue(key, value)}</span>
}

// 產生由靜態設定驅動的 TanStack 欄位
function buildColumns(): ColumnDef<UserReportRow>[] {
  return fieldEntries.map(([key, field]) => ({
    id: key,
    accessorKey: key,
    size: field.width,
    enableSorting: dodoReportConfig.enableSorting && field.sortable,
    enableColumnFilter: dodoReportConfig.enableFilters && field.filterable,
    filterFn: key === 'roles'
      ? (row, columnId, value) => (row.getValue(columnId) as string[]).includes(value)
      : key === 'override_count'
        ? (row, columnId, value) => value === 'yes'
          ? Number(row.getValue(columnId)) > 0
          : Number(row.getValue(columnId)) === 0
        : 'auto',
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

// 員工帳號唯讀報表
export function UserReport() {
  const savedState = useMemo(readSavedState, [])
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'email', desc: false }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    savedState.columnFilters ?? [],
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    ...defaultVisibility,
    ...savedState.columnVisibility,
  })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    savedState.columnOrder ?? defaultColumnOrder,
  )
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: dodoReportConfig.enableColumnPinning ? ['email'] : [],
  })
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [density, setDensity] = useState<Density>(savedState.density ?? 'comfortable')

  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey],
    queryFn: () => PageHrUserReportService.readUserReport(),
  })
  const data = reportQuery.data?.data ?? []
  const columns = useMemo(buildColumns, [])
  const roleOptions = useMemo(
    () => [...new Set(data.flatMap((row) => row.roles))].sort(),
    [data],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting, columnFilters, globalFilter, columnVisibility, columnOrder, columnPinning,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: dodoReportConfig.enablePagination
      ? getPaginationRowModel()
      : undefined,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLocaleLowerCase('zh-TW')
      return fieldEntries.some(([key, field]) =>
        field.filterable
        && formatFieldValue(key, row.original[key]).toLocaleLowerCase('zh-TW').includes(query),
      )
    },
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      columnFilters, columnOrder, columnVisibility, density,
    }))
  }, [columnFilters, columnOrder, columnVisibility, density])

  const filteredRows = table.getFilteredRowModel().rows
  const hasConditions = Boolean(globalFilter || columnFilters.length || sorting.length !== 1)

  // 清除報表查詢條件
  function clearConditions() {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([{ id: 'email', desc: false }])
  }

  // 調整欄位顯示順序
  function moveColumn(columnId: string, offset: -1 | 1) {
    const currentIndex = columnOrder.indexOf(columnId)
    const nextIndex = currentIndex + offset
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= columnOrder.length) return
    const nextOrder = [...columnOrder]
    ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex], nextOrder[currentIndex],
    ]
    setColumnOrder(nextOrder)
  }

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-4'>
      <PageHeader
        tabKey={dodoReportConfig.reportKey}
        title={dodoReportConfig.reportTitle}
        description={dodoReportConfig.reportDescription}
      />

      <div className='flex flex-wrap items-center gap-2'>
        {dodoReportConfig.enableGlobalSearch && (
          <div className='relative'>
            <Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              aria-label='搜尋報表'
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder='搜尋姓名、Email、角色或權限…'
              className='h-9 w-72 pl-8'
            />
          </div>
        )}

        {dodoReportConfig.enableFilters && (
          <>
            <select
              aria-label='帳號狀態'
              className='h-9 rounded-md border bg-background px-3 text-sm'
              value={(table.getColumn('is_active')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('is_active')?.setFilterValue(
                event.target.value === '' ? undefined : event.target.value === 'true',
              )}
            >
              <option value=''>全部狀態</option>
              <option value='true'>啟用</option>
              <option value='false'>停用</option>
            </select>
            <select
              aria-label='Superuser'
              className='h-9 rounded-md border bg-background px-3 text-sm'
              value={(table.getColumn('is_superuser')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('is_superuser')?.setFilterValue(
                event.target.value === '' ? undefined : event.target.value === 'true',
              )}
            >
              <option value=''>全部 Superuser</option>
              <option value='true'>是</option>
              <option value='false'>否</option>
            </select>
            <select
              aria-label='角色'
              className='h-9 max-w-64 rounded-md border bg-background px-3 text-sm'
              value={(table.getColumn('roles')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('roles')?.setFilterValue(
                event.target.value || undefined,
              )}
            >
              <option value=''>全部角色</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select
              aria-label='特別權限'
              className='h-9 rounded-md border bg-background px-3 text-sm'
              value={(table.getColumn('override_count')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('override_count')?.setFilterValue(
                event.target.value || undefined,
              )}
            >
              <option value=''>全部權限狀態</option>
              <option value='yes'>有特別權限</option>
              <option value='no'>無特別權限</option>
            </select>
          </>
        )}

        {hasConditions && (
          <Button type='button' variant='ghost' size='sm' onClick={clearConditions}>
            <X className='size-4' />清除條件
          </Button>
        )}

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

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setDensity((value) => value === 'comfortable' ? 'compact' : 'comfortable')}
        >
          密度：{density === 'comfortable' ? '舒適' : '緊密'}
        </Button>

        {dodoReportConfig.enableColumnVisibility && (
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
                const field = dodoReportConfig.fields[columnId as UserReportFieldKey]
                return (
                  <div key={columnId} className='flex items-center'>
                    <DropdownMenuCheckboxItem
                      className='min-w-0 flex-1'
                      checked={column.getIsVisible()}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    >
                      <span className='truncate'>{field.label}</span>
                    </DropdownMenuCheckboxItem>
                    {dodoReportConfig.enableColumnOrder && (
                      <div className='flex pr-1'>
                        <Button
                          type='button' variant='ghost' size='icon-sm'
                          aria-label={`向左移動${field.label}`}
                          disabled={index === 0}
                          onClick={() => moveColumn(columnId, -1)}
                        ><ArrowUp className='size-3.5' /></Button>
                        <Button
                          type='button' variant='ghost' size='icon-sm'
                          aria-label={`向右移動${field.label}`}
                          disabled={index === columnOrder.length - 1}
                          onClick={() => moveColumn(columnId, 1)}
                        ><ArrowDown className='size-3.5' /></Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {dodoReportConfig.enableExport && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!filteredRows.length}
            onClick={() => downloadCsv(filteredRows.map((row) => row.original))}
          >
            <Download className='size-4' />匯出 CSV
          </Button>
        )}
      </div>

      {reportQuery.isPending && (
        <div className='rounded-md border py-12 text-center text-muted-foreground'>載入報表中…</div>
      )}
      {reportQuery.isError && (
        <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>
          報表載入失敗，請重新整理後再試。
        </div>
      )}
      {reportQuery.isSuccess && !data.length && (
        <div className='rounded-md border py-12 text-center text-muted-foreground'>目前沒有員工帳號資料。</div>
      )}
      {reportQuery.isSuccess && data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='user-report-table'>
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className='sticky top-0 z-20 bg-background'>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className='hover:bg-transparent'>
                  {headerGroup.headers.map((header) => {
                    const pinned = header.column.getIsPinned()
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(pinned && 'sticky z-30 bg-background shadow-[1px_0_0_0_var(--border)]')}
                        style={{
                          width: header.getSize(),
                          left: pinned === 'left' ? header.column.getStart('left') : undefined,
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-has-override={row.original.override_count > 0 || undefined}
                  className={cn(
                    !row.original.is_active && 'opacity-55',
                    row.original.override_count > 0 && 'border-l-2 border-l-amber-500',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned()
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          density === 'compact' ? 'py-1.5' : 'py-3',
                          pinned && 'sticky z-10 bg-background shadow-[1px_0_0_0_var(--border)]',
                        )}
                        style={{
                          width: cell.column.getSize(),
                          left: pinned === 'left' ? cell.column.getStart('left') : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dodoReportConfig.enablePagination && reportQuery.isSuccess && data.length > 0 && (
        <div className='flex items-center justify-end gap-2 text-sm'>
          <span className='text-muted-foreground'>
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 頁
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            上一頁
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            下一頁
          </Button>
        </div>
      )}
    </section>
  )
}

export default UserReport
