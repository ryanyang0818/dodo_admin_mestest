import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
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
  Copy,
  Download,
  RefreshCw,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { type FormEvent, Fragment, useEffect, useMemo, useState } from 'react'

import { type MesUserReportRow, PageMesUserReportService } from '@/client'
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

import { dodoReportConfig, type MesUserFieldKey } from './dodo-report.config'

type Density = 'comfortable' | 'compact'
type Flag = '' | 'T' | 'F'
type Filters = { keyword: string; deptSid: string; enable: Flag; admin: Flag; roleSid: string }
type SavedReportState = {
  columnOrder?: ColumnOrderState
  columnVisibility?: VisibilityState
  density?: Density
}

const STORAGE_KEY = 'dodo-report:mes.user:v1'
const DEFAULT_FILTERS: Filters = { keyword: '', deptSid: '', enable: 'T', admin: '', roleSid: '' }
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [MesUserFieldKey, (typeof dodoReportConfig.fields)[MesUserFieldKey]]
>
const defaultColumnOrder = fieldEntries.map(([key]) => key)
const defaultVisibility = Object.fromEntries(
  fieldEntries.map(([key, field]) => [key, field.visible]),
)
const selectClassName = 'h-9 rounded-md border bg-background px-3 text-sm'
// 固定參照：查詢切換時 data 為 undefined，若每次 render 給新 []，TanStack 會不斷 resetExpanded 造成無限渲染
const EMPTY_ROWS: MesUserReportRow[] = []

// 讀取已保存的報表操作狀態
function readSavedState(): SavedReportState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 將搜尋條件轉成 API 參數，空值不送
function toApiParams(filters: Filters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    deptSid: filters.deptSid || undefined,
    enable: filters.enable || undefined,
    admin: filters.admin || undefined,
    roleSid: filters.roleSid || undefined,
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
function formatFieldValue(key: MesUserFieldKey, value: unknown): string {
  const field = dodoReportConfig.fields[key]
  if (field.format === 'datetime') return formatDateTime(value, field.emptyText)
  if (key === 'is_enabled') return value ? '啟用' : '停用'
  if (key === 'is_admin') return value ? '是' : '否'
  if (value === null || value === undefined || value === '') return field.emptyText
  if (Array.isArray(value)) return value.length ? value.join(', ') : field.emptyText
  return String(value)
}

// 產生 RFC 4180 相容的 CSV 欄位
function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

// 下載目前篩選結果的 UTF-8 BOM CSV
function downloadCsv(rows: MesUserReportRow[]): void {
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
  const url = URL.createObjectURL(new Blob([`﻿${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `MES使用者報表-${timestamp}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// 呈現報表儲存格內容
function renderCell(key: MesUserFieldKey, value: unknown) {
  const field = dodoReportConfig.fields[key]
  if (key === 'is_enabled') {
    return <Badge variant={value ? 'default' : 'outline'}>{value ? '啟用' : '停用'}</Badge>
  }
  if (key === 'is_admin') {
    return <Badge variant={value ? 'secondary' : 'outline'}>{value ? '是' : '否'}</Badge>
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className='text-muted-foreground'>{field.emptyText}</span>
    return <div className='flex flex-wrap gap-1'>{value.map((item, index) => <Badge key={`${item}-${index}`} variant='secondary'>{item}</Badge>)}</div>
  }
  if (!value) return <span className='text-muted-foreground'>{formatFieldValue(key, value)}</span>
  return <span className='whitespace-normal'>{formatFieldValue(key, value)}</span>
}

// 產生由靜態設定驅動的 TanStack 欄位
function buildColumns(): ColumnDef<MesUserReportRow>[] {
  return [
    {
      id: 'expand', size: 48, enableSorting: false,
      header: () => <span className='sr-only'>展開</span>,
      cell: ({ row }) => (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='展開擁有角色'
          disabled={!row.getCanExpand()}
          onClick={row.getToggleExpandedHandler()}
        >
          {row.getIsExpanded() ? <ChevronDown className='size-4' /> : <ChevronRight className='size-4' />}
        </Button>
      ),
    },
    ...fieldEntries.map(([key, field]): ColumnDef<MesUserReportRow> => ({
      id: key,
      accessorKey: key,
      size: field.width,
      enableSorting: field.sortable,
      header: ({ column }) => (
        <Button type='button' variant='ghost' className='-ml-3 h-8' disabled={!column.getCanSort()} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {field.label}{column.getCanSort() && <ArrowUpDown className='ml-1 size-3.5' />}
        </Button>
      ),
      cell: ({ getValue }) => renderCell(key, getValue()),
    })),
  ]
}

// MES 使用者唯讀報表
export function MesUserView() {
  const { showSuccessToast } = useCustomToast()
  const savedState = useMemo(readSavedState, [])
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [submitted, setSubmitted] = useState<Filters>(DEFAULT_FILTERS)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'account_no', desc: false }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ ...defaultVisibility, ...savedState.columnVisibility })
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(savedState.columnOrder ?? defaultColumnOrder)
  const [density, setDensity] = useState<Density>(savedState.density ?? 'compact')

  const optionsQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'options'],
    queryFn: () => PageMesUserReportService.readMesUserReportOptions(),
    staleTime: 10 * 60 * 1000,
  })
  const sqlQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'sql', draft],
    queryFn: () => PageMesUserReportService.readMesUserReportSql(toApiParams(draft)),
    placeholderData: keepPreviousData,
  })
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report', submitted],
    queryFn: () => PageMesUserReportService.readMesUserReport(toApiParams(submitted)),
  })
  const data = reportQuery.data?.data ?? EMPTY_ROWS
  const columns = useMemo(buildColumns, [])
  const table = useReactTable({
    data, columns,
    state: { sorting, globalFilter, columnVisibility, columnOrder: ['expand', ...columnOrder] },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.roles.length > 0,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLocaleLowerCase('zh-TW')
      return fieldEntries.some(([key, field]) => field.filterable
        && formatFieldValue(key, row.original[key]).toLocaleLowerCase('zh-TW').includes(query))
    },
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columnOrder, columnVisibility, density }))
  }, [columnOrder, columnVisibility, density])

  const filteredRows = table.getFilteredRowModel().rows
  const isDirty = JSON.stringify(draft) !== JSON.stringify(submitted)
  const hasConditions = JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTERS) || Boolean(globalFilter)

  // 更新單一搜尋條件
  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  // 送出搜尋條件；條件未變時直接重新查詢
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isDirty) setSubmitted(draft)
    else reportQuery.refetch()
  }

  // 清除搜尋條件並重新查詢
  function clearConditions() {
    setDraft(DEFAULT_FILTERS)
    setSubmitted(DEFAULT_FILTERS)
    setGlobalFilter('')
  }

  // 複製預計執行的 SQL
  async function copySql() {
    if (!sqlQuery.data) return
    await navigator.clipboard.writeText(sqlQuery.data.sql)
    showSuccessToast('已複製 SQL')
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
      <form className='flex flex-wrap items-center gap-2' onSubmit={handleSubmit}>
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input aria-label='帳號或姓名' value={draft.keyword} maxLength={50} onChange={(event) => updateDraft('keyword', event.target.value)} placeholder='帳號或姓名…' className='h-9 w-56 pl-8' />
        </div>
        <select aria-label='部門' className={selectClassName} value={draft.deptSid} onChange={(event) => updateDraft('deptSid', event.target.value)}>
          <option value=''>全部部門</option>
          {optionsQuery.data?.departments.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label='帳號狀態' className={selectClassName} value={draft.enable} onChange={(event) => updateDraft('enable', event.target.value as Flag)}>
          <option value=''>全部狀態</option><option value='T'>啟用</option><option value='F'>停用</option>
        </select>
        <select aria-label='系統管理員' className={selectClassName} value={draft.admin} onChange={(event) => updateDraft('admin', event.target.value as Flag)}>
          <option value=''>管理員：全部</option><option value='T'>管理員：是</option><option value='F'>管理員：否</option>
        </select>
        <select aria-label='角色' className={cn(selectClassName, 'max-w-56')} value={draft.roleSid} onChange={(event) => updateDraft('roleSid', event.target.value)}>
          <option value=''>全部角色</option>
          {optionsQuery.data?.roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button type='submit' size='sm' disabled={reportQuery.isFetching}>
          <RefreshCw className={cn('size-4', reportQuery.isFetching && 'animate-spin')} />{isDirty ? '查詢' : '重新查詢'}
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
          <pre className='max-h-80 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100'><code>{sqlQuery.data?.sql ?? '產生中…'}</code></pre>
        </div>
      </details>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input aria-label='在結果中搜尋' value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='在結果中搜尋…' className='h-9 w-64 pl-8' />
        </div>
        <span className='ml-auto text-sm text-muted-foreground'>{filteredRows.length} / {data.length} 筆</span>
        <Button type='button' variant='outline' size='sm' onClick={() => setDensity((value) => value === 'comfortable' ? 'compact' : 'comfortable')}>密度：{density === 'comfortable' ? '舒適' : '緊密'}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type='button' variant='outline' size='icon' aria-label='欄位設定'><Settings2 className='size-4' /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-64'>
            <DropdownMenuLabel>欄位顯示與順序</DropdownMenuLabel><DropdownMenuSeparator />
            {columnOrder.map((columnId, index) => {
              const column = table.getColumn(columnId)
              if (!column) return null
              const field = dodoReportConfig.fields[columnId as MesUserFieldKey]
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
      {reportQuery.data?.truncated && <div role='status' className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800'>結果超過 2000 筆，只顯示前 2000 筆，請縮小搜尋條件。</div>}
      {reportQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 MES 正式區中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>MES 資料庫查詢失敗，請確認連線設定或稍後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合條件的使用者。</div>}
      {reportQuery.isSuccess && data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='mes-user-report-table'>
          <Table style={{ width: table.getTotalSize() }}>
            <TableHeader className='sticky top-0 z-20 bg-background'>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} style={{ width: header.getSize() }}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
            <TableBody>{table.getRowModel().rows.map((row) => <Fragment key={row.id}>
              <TableRow className={cn(!row.original.is_enabled && 'opacity-55')}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={density === 'compact' ? 'py-1.5' : 'py-3'} style={{ width: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>
              {row.getIsExpanded() && <TableRow><TableCell colSpan={row.getVisibleCells().length} className='bg-muted/20 p-2'>
                <div className='max-h-80 overflow-auto rounded border bg-background'>
                  <table className='w-full table-fixed text-xs'>
                    <thead className='sticky top-0 z-10 bg-muted'>
                      <tr className='h-7 border-b text-left'>
                        <th className='w-48 px-2 py-1 font-medium'>角色代號</th>
                        <th className='px-2 py-1 font-medium'>角色名稱</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.original.roles.map((role, index) => (
                        <tr key={`${role.role_no}-${index}`} className='h-7 border-b odd:bg-background even:bg-muted/40 hover:bg-muted/70'>
                          <td className='truncate px-2 py-1 text-muted-foreground' title={role.role_no ?? ''}>{role.role_no ?? '—'}</td>
                          <td className='truncate px-2 py-1 font-medium' title={role.role_name ?? ''}>{role.role_name ?? '—'}</td>
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

export default MesUserView
