import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import { PageErpSlipReadonlyService } from '@/client'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { dodoReportConfig } from './dodo-report.config'

// ERP 單別查詢（唯讀）純內容元件，供 Tab 與 standalone route 共用
export function ErpSlipReadonly() {
  const slipQuery = useQuery({
    queryKey: [dodoReportConfig.reportKey, 'report'],
    queryFn: () => PageErpSlipReadonlyService.readErpSlips(),
    staleTime: 10 * 60 * 1000,
  })
  const data = slipQuery.data?.data ?? []

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-4'>
      <PageHeader
        tabKey={dodoReportConfig.reportKey}
        title={dodoReportConfig.reportTitle}
        description={dodoReportConfig.reportDescription}
      />
      <div className='flex items-center justify-between gap-2'>
        <span className='text-sm text-muted-foreground'>共 {data.length.toLocaleString('zh-TW')} 筆（唯讀）</span>
        <Button type='button' variant='outline' size='sm' disabled={slipQuery.isFetching} onClick={() => slipQuery.refetch()}>
          <RefreshCw className={cn('size-4', slipQuery.isFetching && 'animate-spin')} />重新查詢
        </Button>
      </div>

      {slipQuery.isPending && <div className='rounded-md border py-12 text-center text-muted-foreground'>查詢 TIPTOP 單別中…</div>}
      {slipQuery.isError && <div role='alert' className='rounded-md border border-destructive/40 py-12 text-center text-destructive'>TIPTOP 單別查詢失敗，請稍後再試。</div>}
      {slipQuery.isSuccess && !data.length && <div className='rounded-md border py-12 text-center text-muted-foreground'>查無單別資料。</div>}
      {data.length > 0 && (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border' data-testid='erp-slip-readonly-table'>
          <Table>
            <TableHeader className='sticky top-0 z-20 bg-background'>
              <TableRow>
                <TableHead className='w-32'>單別</TableHead>
                <TableHead>單據名稱</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.slip}>
                  <TableCell className='py-1.5 font-mono'>{row.slip}</TableCell>
                  <TableCell className='py-1.5'>{row.name ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

export default ErpSlipReadonly
