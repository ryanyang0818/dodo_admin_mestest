import { useQuery } from "@tanstack/react-query"
import {
  type ColumnDef, type PaginationState, type OnChangeFn,
  flexRender, getCoreRowModel, useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Copy, Download, Search } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"

import { ApiError, type InspectionForm, type InspectionPage, PageMesInspectionQueryService as Api } from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { dodoReportConfig as config } from "./dodo-report.config"

type Row = InspectionPage["data"][number]
type Conditions = { lot: string; inspSid: string }
type DetailTab = "measurements" | "parameters"
const EMPTY_ROWS: Row[] = []
const EMPTY_FORMS: InspectionForm[] = []
const INITIAL_PAGE = { pageIndex: 0, pageSize: config.pageSize }

// 保留 MES 原始時間與輸入值；沒有時區資訊時不擅自位移。
function displayValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value).replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ")
}

// 搜尋全部表單；輸入只負責過濾，必須選取有效選項才更新 SID。
function InspectionFormSelect({ forms, value, onChange, loading, error }: {
  forms: InspectionForm[]; value: string; onChange: (sid: string) => void; loading: boolean; error: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const selected = forms.find((form) => form.insp_sid === value)
  const filtered = useMemo(() => forms.filter((form) =>
    `${form.insp_no} ${form.insp_name ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [forms, search])

  // 選取後保留名稱並關閉清單。
  function selectForm(form: InspectionForm) {
    onChange(form.insp_sid)
    setOpen(false)
    setSearch("")
    input.current?.focus()
  }

  // 鍵盤移動時讓目前選項保持在捲動區內。
  useEffect(() => {
    if (open) document.getElementById(`inspection-option-${active}`)?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  return <div className="relative min-w-0 flex-1" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setSearch("") }
  }}>
    <label htmlFor="inspection-form" className="mb-1 block text-sm">檢驗表單</label>
    <div className="relative">
      <Input id="inspection-form" ref={input} role="combobox" aria-autocomplete="list"
        aria-expanded={open} aria-controls="inspection-form-options"
        aria-activedescendant={open && filtered[active] ? `inspection-option-${active}` : undefined}
        placeholder={loading ? "載入全部表單中…" : "輸入表單代號或名稱搜尋"}
        disabled={loading || error} className="pr-10"
        value={open ? search : selected ? `${selected.insp_no}｜${selected.insp_name ?? "未命名"}` : ""}
        onFocus={() => { setOpen(true); setActive(0) }}
        onChange={(event) => { setSearch(event.target.value); setOpen(true); setActive(0); onChange("") }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true)
            setActive((index) => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))))
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); if (filtered[active]) selectForm(filtered[active])
          } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setSearch("") }
        }} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9"
        aria-label="展開檢驗表單" disabled={loading || error}
        onClick={() => { input.current?.focus(); setOpen(true); setSearch(""); setActive(0) }}><ChevronDown className="size-4" /></Button>
    </div>
    {open && <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
      <div className="px-3 py-2 text-xs text-muted-foreground" role="status">符合 {filtered.length} 筆／全部 {forms.length} 筆</div>
      <div id="inspection-form-options" role="listbox" aria-label="全部檢驗表單" className="max-h-64 overflow-y-auto">
        {filtered.map((form, index) => <div key={form.insp_sid} id={`inspection-option-${index}`} role="option"
          aria-selected={form.insp_sid === value} className={`cursor-pointer px-3 py-2 text-sm ${active === index ? "bg-accent text-accent-foreground" : ""}`}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => selectForm(form)}>
          <span className="font-medium">{form.insp_no}</span>｜{form.insp_name ?? "未命名"}
        </div>)}
        {!filtered.length && <p className="p-3 text-sm text-muted-foreground">找不到符合的檢驗表單</p>}
      </div>
    </div>}
  </div>
}

// 以既有 TanStack Table 呈現固定欄位與後端分頁。
function InspectionTable({ columns: definitions, result, loading, error, pagination, onPaginationChange, onSelect, selected }: {
  columns: readonly (readonly [string, string])[]; result?: InspectionPage; loading: boolean; error: boolean
  pagination: PaginationState; onPaginationChange: OnChangeFn<PaginationState>; onSelect?: (row: Row) => void; selected?: string
}) {
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    ...(onSelect ? [{ id: "select", header: "查看", cell: ({ row }: { row: { original: Row } }) =>
      <Button size="sm" variant={selected === row.original.qc_no ? "default" : "outline"}
        aria-label={`查看檢驗單 ${row.original.qc_no}`} onClick={() => onSelect(row.original)}>選取</Button> }] : []),
    ...definitions.map(([key, label]) => ({ accessorKey: key, header: label,
      cell: ({ getValue }: { getValue: () => unknown }) => displayValue(getValue()) })),
  ], [definitions, onSelect, selected])
  const table = useReactTable({ data: result?.data ?? EMPTY_ROWS, columns, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, rowCount: result?.count ?? 0, state: { pagination }, onPaginationChange })
  return <div className="space-y-2">
    <div className="max-h-80 overflow-auto rounded-md border" aria-busy={loading}>
      <Table><TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>
        {table.getHeaderGroups()[0].headers.map((header) => <TableHead key={header.id} className="whitespace-nowrap">{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
      </TableRow></TableHeader><TableBody>
        {loading || error || !result?.data.length ? <TableRow><TableCell colSpan={columns.length} className="h-20 text-center" role="status">
          {loading ? "查詢中…" : error ? "查詢失敗，請重試；若持續發生，請確認 MES 連線。" : "查無符合資料"}
        </TableCell></TableRow> : table.getRowModel().rows.map((row) => <TableRow key={row.id} data-state={onSelect && selected === row.original.qc_no ? "selected" : undefined}>
          {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="max-w-96 whitespace-pre-wrap break-words py-1.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
        </TableRow>)}
      </TableBody></Table>
    </div>
    {config.enablePagination && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>共 {result?.count ?? 0} 筆 · 第 {pagination.pageIndex + 1}／{Math.max(1, table.getPageCount())} 頁</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">每頁<select aria-label="每頁筆數" className="h-8 rounded-md border bg-background px-2"
          value={pagination.pageSize} onChange={(event) => onPaginationChange({ pageIndex: 0, pageSize: Number(event.target.value) })}>
          {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select></label>
        <Button variant="outline" size="sm" disabled={loading || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>上一頁</Button>
        <Button variant="outline" size="sm" disabled={loading || !table.getCanNextPage()} onClick={() => table.nextPage()}>下一頁</Button>
      </div>
    </div>}
  </div>
}

// 檢驗單主從報表：先確認批號與表單，再查看單張檢驗單。
export function MesInspectionQuery() {
  const [lot, setLot] = useState("")
  const [inspSid, setInspSid] = useState("")
  const [lotInfo, setLotInfo] = useState<{ lot: string; partno: string } | null>(null)
  const [lotBusy, setLotBusy] = useState(false)
  const [lotError, setLotError] = useState("")
  const lotRequest = useRef(0)
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [sheetPage, setSheetPage] = useState<PaginationState>(INITIAL_PAGE)
  const [rawPage, setRawPage] = useState<PaginationState>(INITIAL_PAGE)
  const [parameterPage, setParameterPage] = useState<PaginationState>(INITIAL_PAGE)
  const [tab, setTab] = useState<DetailTab>("measurements")
  const [sql, setSql] = useState<string | null>(null)
  const [sqlBusy, setSqlBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { showErrorToast, showSuccessToast } = useCustomToast()
  const forms = useQuery({ queryKey: [config.reportKey, "forms"], queryFn: () => Api.readInspectionForms(), staleTime: 300000 })
  const availableForms = useMemo(() => {
    const all = forms.data?.data ?? EMPTY_FORMS
    if (!lotInfo || lotInfo.lot !== lot.trim()) return all
    const partno = lotInfo.partno.toLocaleLowerCase()
    return all.filter((form) => (form.insp_name ?? "").toLocaleLowerCase().includes(partno))
  }, [forms.data, lotInfo, lot])
  const base = conditions ?? { lot: "", inspSid: "" }
  const sheets = useQuery({ queryKey: [config.reportKey, "sheets", conditions, sheetPage], enabled: !!conditions,
    queryFn: () => Api.readInspectionSheets({ ...base, skip: sheetPage.pageIndex * sheetPage.pageSize, limit: sheetPage.pageSize }) })
  const qcNo = selected ? String(selected.qc_no) : undefined
  const raw = useQuery({ queryKey: [config.reportKey, "measurements", conditions, qcNo, rawPage], enabled: !!conditions && !!qcNo && tab === "measurements",
    queryFn: () => Api.readInspectionMeasurements({ ...base, qcNo, skip: rawPage.pageIndex * rawPage.pageSize, limit: rawPage.pageSize }) })
  const parameters = useQuery({ queryKey: [config.reportKey, "parameters", conditions, qcNo, parameterPage], enabled: !!conditions && !!qcNo && tab === "parameters",
    queryFn: () => Api.readInspectionParameters({ ...base, qcNo, skip: parameterPage.pageIndex * parameterPage.pageSize, limit: parameterPage.pageSize }) })
  const dirty = !!conditions && (conditions.lot !== lot.trim() || conditions.inspSid !== inspSid)

  // 唯一一張檢驗單時自動選取；多張保留人工選擇。
  useEffect(() => {
    if (!selected && sheets.data?.count === 1) setSelected(sheets.data.data[0])
  }, [selected, sheets.data])

  // 修改批號即取消舊篩選與待回傳結果，避免快速換批號時套用舊料號。
  function changeLot(value: string) {
    lotRequest.current += 1
    setLot(value); setLotInfo(null); setLotError(""); setLotBusy(false); setInspSid("")
  }

  // 點放大鏡才查批號主檔，成功後以料號包含比對表單名稱。
  async function lookupLot() {
    const value = lot.trim()
    if (!value) return
    const request = ++lotRequest.current
    setLotBusy(true); setLotError(""); setLotInfo(null); setInspSid("")
    try {
      const result = await Api.readInspectionLot({ lot: value })
      if (request === lotRequest.current) setLotInfo(result)
    } catch (error) {
      if (request !== lotRequest.current) return
      const body = error instanceof ApiError ? error.body : null
      const detail = body && typeof body === "object" && "detail" in body ? body.detail : null
      setLotError(typeof detail === "string" ? detail : "批號查詢失敗，請重試")
    } finally {
      if (request === lotRequest.current) setLotBusy(false)
    }
  }

  // 查詢時清除舊明細與分頁，同條件則主動刷新列表。
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!lot.trim() || !inspSid) { showErrorToast("請輸入批號並選取檢驗表單"); return }
    setSelected(null); setSheetPage(INITIAL_PAGE); setRawPage(INITIAL_PAGE); setParameterPage(INITIAL_PAGE)
    setConditions({ lot: lot.trim(), inspSid }); setSql(null)
    if (conditions?.lot === lot.trim() && conditions.inspSid === inspSid) void sheets.refetch()
  }

  // 切換檢驗單時重設明細分頁並顯示原始量測值。
  function selectSheet(row: Row) {
    setSelected(row); setRawPage(INITIAL_PAGE); setParameterPage(INITIAL_PAGE); setTab("measurements"); setSql(null)
  }

  // 分別取得列表與兩個明細的實際分頁 SQL，與當前結果使用相同查詢來源。
  async function viewSql() {
    setSqlBusy(true)
    try {
      const [sheetSql, rawSql, parameterSql] = await Promise.all([
        Api.readInspectionSql({ ...base, skip: sheetPage.pageIndex * sheetPage.pageSize, limit: sheetPage.pageSize }),
        qcNo ? Api.readInspectionSql({ ...base, qcNo, skip: rawPage.pageIndex * rawPage.pageSize, limit: rawPage.pageSize }) : null,
        qcNo ? Api.readInspectionSql({ ...base, qcNo, skip: parameterPage.pageIndex * parameterPage.pageSize, limit: parameterPage.pageSize }) : null,
      ])
      setSql(`-- 1. 檢驗單列表\n${sheetSql.sheets}\n\n-- 2. 原始量測資料\n${rawSql?.measurements ?? "-- 請先選取檢驗單"}\n\n-- 3. 現行參數設定\n${parameterSql?.parameters ?? "-- 請先選取檢驗單"}`)
    } catch { showErrorToast("SQL 產生失敗，請重試") } finally { setSqlBusy(false) }
  }

  // 複製已顯示的 SQL，包含所選檢驗單與分頁條件。
  async function copySql() {
    try { await navigator.clipboard.writeText(sql ?? ""); showSuccessToast("已複製 SQL") }
    catch { showErrorToast("無法存取剪貼簿，請手動選取複製") }
  }

  // 匯出所選單全部量測資料，而非只有目前頁。
  async function exportCsv() {
    setExporting(true)
    try {
      const content = await Api.exportInspectionMeasurements({ ...base, qcNo })
      const url = URL.createObjectURL(new Blob([String(content ?? "")], { type: "text/csv;charset=utf-8" }))
      const anchor = document.createElement("a")
      anchor.href = url; anchor.download = `mes-inspection-${(qcNo ?? "").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`
      anchor.click(); URL.revokeObjectURL(url)
      showSuccessToast("已匯出此檢驗單全部量測資料")
    } catch { showErrorToast("匯出失敗；單張超過 50,000 筆時不提供一次匯出。") }
    finally { setExporting(false) }
  }

  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    <PageHeader tabKey={config.reportKey} title={config.reportTitle} description={config.reportDescription} />
    <div className="flex items-center gap-2"><Badge variant="secondary">MES 正式區・唯讀</Badge><span className="text-xs text-muted-foreground">時間顯示 MES 原始值</span></div>
    {config.enableFilters && <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
      <div className="w-60"><label htmlFor="inspection-lot" className="mb-1 block text-sm">批號</label>
        <div className="relative"><Input id="inspection-lot" className="pr-10" value={lot} maxLength={255} onChange={(event) => changeLot(event.target.value)} placeholder="例如 26I133" required />
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9"
            aria-label="查詢批號料號並篩選檢驗表單" title="查詢料號並篩選檢驗表單" disabled={!lot.trim() || lotBusy}
            onClick={() => void lookupLot()}><Search className={`size-4 ${lotBusy ? "animate-pulse" : ""}`} /></Button>
        </div></div>
      <InspectionFormSelect key={lotInfo ? `${lotInfo.lot}:${lotInfo.partno}` : "all"} forms={availableForms} value={inspSid} onChange={setInspSid} loading={forms.isPending || lotBusy} error={forms.isError} />
      <Button type="submit" disabled={!lot.trim() || !inspSid || sheets.isFetching}><Search className="size-4" />查詢</Button>
    </form>}
    {lotBusy && <p role="status" className="text-sm text-muted-foreground">查詢批號料號中…</p>}
    {lotError && <p role="alert" className="text-sm text-destructive">{lotError}</p>}
    {lotInfo && <p role="status" className="text-sm text-muted-foreground">料號：<span className="font-medium text-foreground">{lotInfo.partno}</span> · 名稱包含此料號的檢驗表單：{availableForms.length} 筆{!availableForms.length && "，請確認表單名稱是否含此料號。"}</p>}
    {forms.isError && <div role="alert" className="text-sm text-destructive">表單清單載入失敗。<Button variant="link" onClick={() => void forms.refetch()}>重新載入</Button></div>}
    {dirty && <p role="status" className="text-sm text-amber-700">條件已修改，請按「查詢」；下方仍為上次查詢結果。</p>}
    {!conditions ? <p className="py-12 text-center text-muted-foreground">請輸入批號並從全部表單中選取一筆，再按查詢。</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium">檢驗單列表 · 批號 {conditions.lot}</h2>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={sqlBusy || dirty} onClick={() => void viewSql()}><Copy className="size-4" />{sqlBusy ? "產生中…" : "查看 SQL"}</Button>
          <Button variant="outline" size="sm" disabled={sheets.isFetching} onClick={() => void sheets.refetch()}>重新整理列表</Button></div>
      </div>
      <InspectionTable columns={config.sheets} result={sheets.data} loading={sheets.isFetching} error={sheets.isError}
        pagination={sheetPage} onPaginationChange={setSheetPage} onSelect={selectSheet} selected={qcNo} />
      {!qcNo && !!sheets.data?.count && <p className="text-sm text-muted-foreground">請選取一張檢驗單，查看量測資料。</p>}
      {qcNo && <section className="space-y-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">檢驗單：{qcNo}</h2>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void (tab === "measurements" ? raw.refetch() : parameters.refetch())}>重新整理明細</Button>
            {config.enableExport && <Button variant="outline" size="sm" disabled={exporting || dirty} onClick={() => void exportCsv()}><Download className="size-4" />{exporting ? "匯出中…" : "匯出全部量測 CSV"}</Button>}</div>
        </div>
        <p className="text-sm text-muted-foreground">關聯批號：{displayValue(selected?.related_lots)}</p>
        {Number(selected?.lot_count) > 1 && <p role="status" className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">此單關聯多個批號。下方為整張檢驗單的量測資料，無法保證每筆量測值單獨歸屬本次查詢批號。</p>}
        <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)}><TabsList>
          <TabsTrigger value="measurements">原始量測資料</TabsTrigger><TabsTrigger value="parameters">現行參數設定</TabsTrigger>
        </TabsList></Tabs>
        {tab === "parameters" && <p className="text-sm text-muted-foreground">這是現行設定，不能直接視為量測當時的判定標準；未重新計算合格／不合格。</p>}
        <InspectionTable columns={config[tab]} result={tab === "measurements" ? raw.data : parameters.data}
          loading={tab === "measurements" ? raw.isFetching : parameters.isFetching} error={tab === "measurements" ? raw.isError : parameters.isError}
          pagination={tab === "measurements" ? rawPage : parameterPage} onPaginationChange={tab === "measurements" ? setRawPage : setParameterPage} />
      </section>}
    </>}
    <Dialog open={sql !== null} onOpenChange={(open) => { if (!open) setSql(null) }}><DialogContent className="max-w-5xl">
      <DialogHeader><DialogTitle>查詢 SQL</DialogTitle><DialogDescription>MES 正式區唯讀語法，包含三項查詢的筆數與當前分頁；未選檢驗單時只提供列表 SQL。</DialogDescription></DialogHeader>
      <Button variant="outline" className="w-fit" onClick={() => void copySql()}><Copy className="size-4" />複製 SQL</Button>
      <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-3 text-xs" tabIndex={0}>{sql}</pre>
    </DialogContent></Dialog>
  </div>
}
