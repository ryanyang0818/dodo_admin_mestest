import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Copy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  PageDatabaseTtDictionaryService,
  type TtColumnRow,
  type TtTableRow,
} from '@/client'
import { PageHeader } from '@/components/Common/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import useCustomToast from '@/hooks/useCustomToast'
import { cn } from '@/lib/utils'

import { dodoReportConfig } from './dodo-report.config'

const SAFE_TEXT = /^[\p{L}\p{N}_ .\-]*$/u
const DEBOUNCE_MS = 300
const SELECT_ROW_LIMIT = 100
const EMPTY_TABLES: TtTableRow[] = []
const EMPTY_COLUMNS: TtColumnRow[] = []

// 輸入停止一小段時間後才更新，避免每打一個字就查詢 TIPTOP
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// 將欄位型別與長度組成易讀文字，例如 VARCHAR2(20)、NUMBER(5,0)
function formatType(column: TtColumnRow): string {
  if (column.data_type === 'NUMBER') {
    if (column.data_precision == null) return 'NUMBER'
    return `NUMBER(${column.data_precision},${column.data_scale ?? 0})`
  }
  if (column.data_type === 'DATE' || column.data_type.startsWith('TIMESTAMP')) return column.data_type
  return column.data_length ? `${column.data_type}(${column.data_length})` : column.data_type
}

// TIPTOP 資料表查詢字典：左邊搜尋資料表，右邊顯示欄位與中文說明
export function TtDictionary() {
  const { showSuccessToast } = useCustomToast()
  const [keyword, setKeyword] = useState('')
  const [columnFilter, setColumnFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const debouncedKeyword = useDebounced(keyword.trim(), DEBOUNCE_MS)
  const inputError = !SAFE_TEXT.test(keyword) ? '只允許文字、數字、空白與 . _ -' : null
  const hasInvalidDebounced = !SAFE_TEXT.test(debouncedKeyword)

  const tablesQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'tables', debouncedKeyword],
    queryFn: () =>
      PageDatabaseTtDictionaryService.readTtTables({ q: debouncedKeyword || undefined }),
    enabled: !hasInvalidDebounced,
    placeholderData: keepPreviousData,
  })
  const columnsQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'columns', selected],
    queryFn: () => PageDatabaseTtDictionaryService.readTtColumns({ tableName: selected ?? '' }),
    enabled: Boolean(selected),
    staleTime: 10 * 60 * 1000,
  })

  const tables = tablesQuery.data?.data ?? EMPTY_TABLES
  const total = tablesQuery.data?.total ?? 0
  const columns = columnsQuery.data?.data ?? EMPTY_COLUMNS
  const keywordLower = debouncedKeyword.toLowerCase()
  const columnFilterLower = columnFilter.trim().toLowerCase()
  const visibleColumns = useMemo(
    () => columns.filter((column) => {
      if (!columnFilterLower) return true
      return column.column_name.toLowerCase().includes(columnFilterLower)
        || (column.column_label ?? '').toLowerCase().includes(columnFilterLower)
    }),
    [columns, columnFilterLower],
  )

  // 欄位是否符合上方的搜尋關鍵字，用來標示命中的欄位
  function isMatchedColumn(column: TtColumnRow): boolean {
    if (!keywordLower) return false
    return column.column_name.toLowerCase().includes(keywordLower)
      || (column.column_label ?? '').toLowerCase().includes(keywordLower)
  }

  // 複製文字到剪貼簿
  async function copyText(content: string, message: string) {
    await navigator.clipboard.writeText(content)
    showSuccessToast(message)
  }

  // 組出 Oracle SELECT 範本，固定加列數上限避免誤查大表
  function buildSelect(): string {
    const names = columns.map((column) => column.column_name.toLowerCase()).join(', ')
    return `SELECT ${names}\nFROM MWF.${selected?.toLowerCase()}\nWHERE ROWNUM <= ${SELECT_ROW_LIMIT}`
  }

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-4'>
      <PageHeader
        tabKey={dodoReportConfig.reportKey}
        title={dodoReportConfig.reportTitle}
        description={dodoReportConfig.reportDescription}
      />
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          aria-label='搜尋資料表或欄位'
          className='h-9 w-80'
          maxLength={50}
          placeholder='輸入中文或英文，如 工單、sfb、工單編號…'
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        {keyword && (
          <Button type='button' variant='ghost' size='sm' onClick={() => setKeyword('')}>
            <X className='size-4' />清除
          </Button>
        )}
        {inputError && <span role='alert' className='text-xs text-destructive'>{inputError}</span>}
        <span className='ml-auto text-sm text-muted-foreground'>
          共 {total.toLocaleString('zh-TW')} 張資料表（唯讀）{tablesQuery.isFetching && '・查詢中…'}
        </span>
      </div>

      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'>
        <div className='min-w-0 space-y-2'>
          {tablesQuery.isPending && !hasInvalidDebounced && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 TIPTOP 資料表中…</div>}
          {tablesQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>TIPTOP 資料表查詢失敗，請稍後再試。</div>}
          {tablesQuery.isSuccess && !tables.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無符合的資料表。</div>}
          {tables.length > 0 && (
            <div className='overflow-auto rounded-md border lg:max-h-[calc(100dvh-14rem)]' data-testid='tt-dictionary-tables'>
              <Table>
                <TableHeader className='sticky top-0 z-10 bg-background'>
                  <TableRow>
                    <TableHead>資料表</TableHead>
                    <TableHead>中文名稱</TableHead>
                    <TableHead>模組</TableHead>
                    <TableHead className='text-right' title='資料庫統計值，非即時筆數'>約略筆數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow
                      key={table.table_name}
                      className='cursor-pointer'
                      data-state={selected === table.table_name ? 'selected' : undefined}
                      tabIndex={0}
                      aria-selected={selected === table.table_name}
                      onClick={() => { setSelected(table.table_name); setColumnFilter('') }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelected(table.table_name)
                        setColumnFilter('')
                      }}
                    >
                      <TableCell className='py-1.5 font-mono'>
                        {table.table_name.toLowerCase()}
                        {(table.matched_columns ?? 0) > 0 && <Badge variant='outline' className='ml-2'>欄位命中 {table.matched_columns}</Badge>}
                      </TableCell>
                      <TableCell className='py-1.5 whitespace-normal'>{table.table_label ?? '—'}</TableCell>
                      <TableCell className='py-1.5'>{table.module ?? '—'}</TableCell>
                      <TableCell className='py-1.5 text-right'>{table.row_estimate != null ? table.row_estimate.toLocaleString('zh-TW') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className='min-w-0 space-y-2 lg:sticky lg:top-2'>
          {!selected && <div className='rounded-md border py-12 text-center text-muted-foreground'>點選左邊的資料表，查看欄位與中文說明。</div>}
          {selected && columnsQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢欄位中…</div>}
          {selected && columnsQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>欄位查詢失敗，請稍後再試。</div>}
          {selected && columnsQuery.isSuccess && (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                <div className='mr-auto min-w-0'>
                  <div className='font-mono text-sm font-semibold'>{selected.toLowerCase()}</div>
                  <div className='text-sm text-muted-foreground'>{columnsQuery.data.table_label ?? '（無中文名稱）'}・{columns.length} 個欄位</div>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={() => copyText(columns.map((column) => column.column_name.toLowerCase()).join(', '), '已複製欄位清單')}>
                  <Copy className='size-4' />欄位清單
                </Button>
                <Button type='button' variant='outline' size='sm' onClick={() => copyText(buildSelect(), '已複製 Oracle SELECT')}>
                  <Copy className='size-4' />SELECT
                </Button>
                <Button type='button' variant='outline' size='sm' onClick={() => copyText(`SELECT * FROM OPENQUERY(TOPPROD, '${buildSelect().replace(/\n/g, ' ')}')`, '已複製 OPENQUERY')}>
                  <Copy className='size-4' />OPENQUERY
                </Button>
              </div>
              <Input aria-label='過濾欄位' className='h-8' placeholder='過濾欄位（代號或中文名稱）…' value={columnFilter} onChange={(event) => setColumnFilter(event.target.value)} />
              <div className='overflow-auto rounded-md border lg:max-h-[calc(100dvh-14rem)]' data-testid='tt-dictionary-columns'>
                <Table>
                  <TableHeader className='sticky top-0 z-10 bg-background'>
                    <TableRow>
                      <TableHead className='w-12'>#</TableHead>
                      <TableHead>欄位</TableHead>
                      <TableHead>中文名稱</TableHead>
                      <TableHead>型別</TableHead>
                      <TableHead>必填</TableHead>
                      <TableHead>說明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleColumns.map((column) => (
                      <TableRow key={column.column_id} className={cn(isMatchedColumn(column) && 'bg-amber-50 dark:bg-amber-950/30')}>
                        <TableCell className='py-1.5 align-top text-muted-foreground'>{column.column_id}</TableCell>
                        <TableCell className='py-1.5 align-top font-mono'>{column.column_name.toLowerCase()}</TableCell>
                        <TableCell className='py-1.5 align-top whitespace-normal'>{column.column_label ?? '—'}</TableCell>
                        <TableCell className='py-1.5 align-top whitespace-nowrap'>{formatType(column)}</TableCell>
                        <TableCell className='py-1.5 align-top'>{column.nullable ? '' : '必填'}</TableCell>
                        <TableCell className='py-1.5 align-top whitespace-pre-wrap text-xs text-muted-foreground'>{column.description ?? ''}</TableCell>
                      </TableRow>
                    ))}
                    {!visibleColumns.length && (
                      <TableRow><TableCell colSpan={6} className='py-6 text-center text-muted-foreground'>沒有符合的欄位。</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default TtDictionary
