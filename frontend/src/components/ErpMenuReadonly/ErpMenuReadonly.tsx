import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  type ErpMenuRow,
  type PageErpMenuReadonlyReadErpMenuData,
  PageErpMenuReadonlyService,
} from '@/client'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { dodoReportConfig, type ErpMenuFieldKey } from './dodo-report.config'

const SAFE_TEXT = /^[\p{L}\p{N}_ .\-()（）/]*$/u
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEBOUNCE_MS = 300
const EMPTY_ROWS: ErpMenuRow[] = []
const fieldEntries = Object.entries(dodoReportConfig.fields) as Array<
  [ErpMenuFieldKey, (typeof dodoReportConfig.fields)[ErpMenuFieldKey]]
>

// 輸入停止一小段時間後才更新，避免每打一個字就查詢 TIPTOP
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// 產生設定驅動的欄位
function buildColumns(): ColumnDef<ErpMenuRow>[] {
  return fieldEntries.map(([key, field]): ColumnDef<ErpMenuRow> => ({
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
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className='whitespace-normal'>{value === null || value === undefined || value === '' ? '—' : String(value)}</span>
    },
  }))
}

// ERP 功能表程式清單（唯讀）純內容元件，供 Tab 與 standalone route 共用
export function ErpMenuReadonly() {
  const [programCode, setProgramCode] = useState('')
  const [programName, setProgramName] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'program_code', desc: false }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const debouncedCode = useDebounced(programCode.trim(), DEBOUNCE_MS)
  const debouncedName = useDebounced(programName.trim(), DEBOUNCE_MS)
  const inputError = [programCode, programName].some((value) => !SAFE_TEXT.test(value))
    ? '只允許文字、數字、空白與 . _ - ( ) /'
    : null

  // 過濾條件變更後回到第一頁
  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [debouncedCode, debouncedName])

  const currentSort = sorting[0]
  const params: PageErpMenuReadonlyReadErpMenuData = {
    programCode: debouncedCode || undefined,
    programName: debouncedName || undefined,
    sortBy: (currentSort?.id ?? 'program_code') as PageErpMenuReadonlyReadErpMenuData['sortBy'],
    sortDirection: currentSort?.desc ? 'desc' : 'asc',
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }
  const hasInvalidDebounced = [debouncedCode, debouncedName].some((value) => !SAFE_TEXT.test(value))
  const reportQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report', params],
    queryFn: () => PageErpMenuReadonlyService.readErpMenu(params),
    enabled: !hasInvalidDebounced,
    placeholderData: keepPreviousData,
  })

  const data = reportQuery.data?.data ?? EMPTY_ROWS
  const columns = useMemo(() => buildColumns(), [])
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    pageCount: Math.max(1, Math.ceil((reportQuery.data?.total ?? 0) / pagination.pageSize)),
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (updater) => {
      setSorting((current) => (typeof updater === 'function' ? updater(current) : updater))
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    },
    onPaginationChange: (updater) => {
      setPagination((current) => (typeof updater === 'function' ? updater(current) : updater))
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilter = programCode !== '' || programName !== ''

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-4'>
      <PageHeader
        tabKey={dodoReportConfig.reportKey}
        title={dodoReportConfig.reportTitle}
        description={dodoReportConfig.reportDescription}
      />
      <div className='flex flex-wrap items-center gap-2'>
        <Input aria-label='程式代號快速過濾' className='h-9 w-56' maxLength={50} placeholder='程式代號（如 aimt302）…' value={programCode} onChange={(event) => setProgramCode(event.target.value)} />
        <Input aria-label='程式名稱快速過濾' className='h-9 w-64' maxLength={50} placeholder='程式名稱（如 工單）…' value={programName} onChange={(event) => setProgramName(event.target.value)} />
        {hasFilter && (
          <Button type='button' variant='ghost' size='sm' onClick={() => { setProgramCode(''); setProgramName('') }}>
            <X className='size-4' />清除過濾
          </Button>
        )}
        {inputError && <span role='alert' className='text-xs text-destructive'>{inputError}</span>}
        <span className='ml-auto text-sm text-muted-foreground'>
          共 {reportQuery.data?.total.toLocaleString('zh-TW') ?? 0} 筆（唯讀）{reportQuery.isFetching && '・查詢中…'}
        </span>
      </div>

      {reportQuery.isPending && !hasInvalidDebounced && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 TIPTOP 功能表中…</div>}
      {reportQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>TIPTOP 功能表查詢失敗，請稍後再試。</div>}
      {reportQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合條件的程式。</div>}
      {data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='erp-menu-readonly-table'>
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
                <TableRow key={row.original.program_code}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className='py-1.5 align-top' style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
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
            <label htmlFor='erp-menu-readonly-page-size' className='text-muted-foreground'>每頁</label>
            <select id='erp-menu-readonly-page-size' className='h-8 rounded-md border bg-background px-2' value={pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
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

export default ErpMenuReadonly
