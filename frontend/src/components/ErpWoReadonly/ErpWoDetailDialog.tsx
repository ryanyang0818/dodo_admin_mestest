import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import {
  PageErpWoReadonlyService as Api,
  type ErpWoDetail,
  type ErpWoMaterial,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ErpWoFieldKey } from "./dodo-report.config"
import { woError, woText } from "./format"

const dash = "—"
const woStatus: Record<string, string> = {
  "1": "確認生產工單(firm plan)",
  "2": "工單已發放,料表尚未列印",
  "3": "工單已發放,料表已列印",
  "4": "工單已發料",
  "5": "在製過程中",
  "6": "工單已完工,進入F.Q.C",
  "7": "入庫",
  "8": "結案",
}
const completionMethods: Record<string, string> = {
  "1": "撿料(發料)",
  "2": "入庫倒扣料",
}
const approvalStatus: Record<string, string> = {
  "0": "開立",
  "1": "已核准",
  "2": "不准",
  "3": "送簽中",
  "4": "取消",
}
const sourceLabels: Record<string, string> = {
  P: "採購件",
  M: "自製件",
  T: "外包件",
  U: "開窗件",
  V: "虛擬件",
  Z: "雜項",
}

// 代碼加說明，如 7:入庫；沒有對照時只顯示代碼。
function code(
  value: string | null | undefined,
  labels: Record<string, string>,
) {
  if (value == null || value.trim() === "") return dash
  return labels[value] ? `${value}:${labels[value]}` : value
}

function text(value: string | number | null | undefined) {
  return value == null || value === "" ? dash : String(value)
}

function date(value: string | null | undefined) {
  return value ? value.slice(0, 10).replaceAll("-", "/") : dash
}

function qty(value: number | null | undefined, digits = 3) {
  return value == null
    ? dash
    : value.toLocaleString("en-US", {
        useGrouping: false,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
}

// 標籤＋唯讀欄位；寬度由所在 grid 決定。
function Field({
  label,
  children,
  className = "",
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-[135px_minmax(0,1fr)] items-start gap-2 ${className}`}
    >
      <dt className="pt-1 text-right">{label}</dt>
      <dd className="min-h-6 break-words border border-[#aaa] bg-white px-1.5 py-1">
        {children}
      </dd>
    </div>
  )
}

const tabClass =
  "relative -mb-px rounded-none border-x-0 border-t-0 border-r border-b border-[#999] bg-[#efefef] px-2 py-0.5 text-xs leading-4 font-normal text-[#333] shadow-none data-[state=active]:border-t data-[state=active]:border-b-[#efefef] data-[state=active]:bg-[#efefef] data-[state=active]:shadow-none"

// 欄位來自列表設定的，沿用共用格式。
function Listed({
  field,
  detail,
  label,
}: {
  field: ErpWoFieldKey
  detail: ErpWoDetail
  label: string
}) {
  return <Field label={label}>{woText(field, detail[field])}</Field>
}

function BasicSection({ d }: { d: ErpWoDetail }) {
  return (
    <fieldset className="border border-[#aaa] p-2">
      <legend className="px-1">基本資料</legend>
      <dl className="flex flex-wrap items-start gap-x-6 gap-y-1.5">
        <div className="grid w-[330px] gap-1.5">
          <Field label="工單編號">{d.wo}</Field>
          <Field label="工單名稱">{text(d.wo_name)}</Field>
          <Field label="變更序號">{text(d.change_no)}</Field>
          <Field label="申請人">
            {d.applicant ? `${d.applicant} ${d.applicant_name ?? ""}` : dash}
          </Field>
          <Check label="倉庫檢驗否" value={d.warehouse_check} />
        </div>
        <div className="grid w-[330px] gap-1.5">
          <Field label="輸入日期">{date(d.input_date)}</Field>
          <Listed field="wo_type" label="工單型態" detail={d} />
          <Field label="完工方式">
            {code(d.completion_method, completionMethods)}
          </Field>
        </div>
        <div className="grid w-[330px] gap-1.5">
          <Listed field="confirmed" label="確認否" detail={d} />
          <Field label="工單狀態">{code(d.status, woStatus)}</Field>
          <Field label="工單結案狀態">
            {text(d.close_status)}　{d.close_date ? date(d.close_date) : ""}
          </Field>
          <Field label="簽核狀況">
            {code(d.approval_status, approvalStatus)}
          </Field>
          <Field label="是否簽核">{text(d.need_sign)}</Field>
        </div>
        {d.approval_status === "1" && (
          <span
            role="img"
            aria-label="已核准"
            className="grid size-10 place-items-center rounded-full border-2 border-red-600 text-lg font-bold text-red-600"
          >
            核
          </span>
        )}
      </dl>
    </fieldset>
  )
}

// 對照 asfi301 畫面分三欄；找不到來源的欄位先顯示「—」，待核對。
function WoInfoOne({ d }: { d: ErpWoDetail }) {
  return (
    <dl className="flex flex-wrap items-start gap-x-6 gap-y-1.5">
      <div className="grid w-[330px] content-start gap-1.5">
        <Field label="成本中心">{text(d.cost_center)}</Field>
        <Field label="成本中心名稱">{text(d.cost_center_name)}</Field>
        <Field label="製造部門/委外廠商">{text(d.vendor_dept)}</Field>
        <Field label="生產線(MES報工預設)">{text(d.line_no)}</Field>
        <Field label="訂單編號/預測工單編號">
          {d.order_no ? `${d.order_no} / ${text(d.order_item)}` : dash}
        </Field>
        <Field label="製造通知單">{text(d.notice_no)}</Field>
        <Field label="母工單號碼">{text(d.parent_wo)}</Field>
      </div>
      <div className="grid w-[420px] content-start gap-1.5">
        <Field label="料件編號">
          {text(d.part_no)}
          {d.unit ? `　${d.unit}` : ""}
        </Field>
        <Field label="品名">{text(d.name)}</Field>
        <Field label="規格">{text(d.specification)}</Field>
        <Field label="生產數量">{qty(d.plan_qty)}</Field>
        <Field label="版本">{text(d.bom_version)}</Field>
        <Field label="產品結構指定有效日期">{date(d.structure_date)}</Field>
        <Field label="製程否">{text(d.has_routing)}</Field>
        <Field label="使用製程編號">{text(d.routing_no)}</Field>
        <Field label="PBI NO(Picking Batch ID)">{text(d.pbi_no)}</Field>
      </div>
      <div className="grid w-[330px] content-start gap-1.5">
        <Field label="預計起始生產日期">{date(d.plan_start_date)}</Field>
        <Field label="預計結束生產日期">{date(d.plan_end_date)}</Field>
        <Field label="實際開工日">{date(d.actual_start_date)}</Field>
        <Field label="已發料套數">{qty(d.issued_qty)}</Field>
        <Field label="完工入庫數量">{qty(d.completed_qty)}</Field>
        <Field label="報廢數量">{qty(d.scrap_qty)}</Field>
        <Field label="工單發料結束日期">{date(d.issue_end_date)}</Field>
        <Field label="工單發料及工時結束日">
          {date(d.issue_labor_end_date)}
        </Field>
        <Field label="工單製程變更序號">{text(d.change_routing_no)}</Field>
        <Field label="出口國">
          {d.export_country
            ? `${d.export_country} ${d.export_country_name ?? ""}`
            : dash}
        </Field>
      </div>
    </dl>
  )
}

const outsourceTypes: Record<string, string> = { "1": "一對一" }

// 唯讀勾選框（Y 為勾選）。
function Check({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={value === "Y"} disabled readOnly />
      {label}
    </label>
  )
}

// 頁簽高度固定，切換頁簽時版面不會跳動。
const tabPanel = "mt-0 min-h-[400px] pt-2"

// 工單資料(二)只顯示備料檔產生否與委外型態。
function WoInfoTwo({ d }: { d: ErpWoDetail }) {
  return (
    <dl className="grid w-[330px] content-start gap-3">
      <Check label="備料檔產生否" value={d.backup_generated} />
      <Field label="委外型態">{code(d.outsource_type, outsourceTypes)}</Field>
    </dl>
  )
}

// 自訂欄位依 ERP 畫面分三欄；sfbud03 畫面未顯示，故不列。
function CustomFields({ d }: { d: ErpWoDetail }) {
  return (
    <dl className="flex flex-wrap items-start gap-x-6 gap-y-1.5">
      <div className="grid w-[330px] content-start gap-1.5">
        <Field label="自訂欄位-Textedit">{text(d.custom_01)}</Field>
        <Listed field="lot_no" label="生產批號" detail={d} />
        <Field label="自訂欄位-文字">{text(d.custom_04)}</Field>
        <Field label="自訂欄位-文字">{text(d.custom_05)}</Field>
        <Field label="自訂欄位-文字">{text(d.custom_06)}</Field>
      </div>
      <div className="grid w-[330px] content-start gap-1.5">
        <Field label="自訂欄位-數值">{text(d.custom_07)}</Field>
        <Field label="自訂欄位-數值">{text(d.custom_08)}</Field>
        <Field label="自訂欄位-數值">{text(d.custom_09)}</Field>
        <Field label="MES工單流程類型">{text(d.mes_flow_type)}</Field>
        <Field label="自訂欄位-整數">{text(d.custom_11)}</Field>
        <Field label="自訂欄位-整數">{text(d.custom_12)}</Field>
      </div>
      <div className="grid w-[330px] content-start gap-1.5">
        <Field label="自訂欄位-日期">{date(d.custom_13)}</Field>
        <Field label="自訂欄位-日期">{date(d.custom_14)}</Field>
        <Field label="自訂欄位-日期">{date(d.custom_15)}</Field>
      </div>
    </dl>
  )
}

const materialHeaders = [
  "被替代料號",
  "作業編號",
  "替代碼",
  "替代率",
  "料件編號",
  "品名",
  "規格",
  "來源碼",
  "發料單位",
  "發料單位/庫存單位換算率",
  "旗標",
  "標準單位用量",
  "實際單位用量 (Actual QPA)",
  "發料誤差允許率",
  "應發數量",
  "委外代買量",
  "已發數量",
  "超領數量",
  "欠料量",
  "報廢數量",
  "盤損數量",
  "指定倉庫",
]

function MaterialTable({ wo }: { wo: string }) {
  const query = useQuery({
    queryKey: ["erp.wo-readonly", "materials", wo],
    queryFn: () => Api.readErpWoMaterials({ wo }),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
  })
  const rows: ErpWoMaterial[] = query.data ?? []
  return (
    <div className="mt-2">
      {query.isPending && <p role="status">讀取用料明細中…</p>}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {woError(query.error)}
        </p>
      )}
      {query.isSuccess && (
        <>
          <div className="max-h-56 overflow-auto border border-[#8b8b8b] bg-white">
            <table
              aria-label="工單用料明細"
              className="w-full min-w-[2600px] border-collapse text-[12px] leading-[16px]"
            >
              <thead className="sticky top-0 bg-[#eeeeee]">
                <tr>
                  {materialHeaders.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-r border-[#8b8b8b] px-1 py-0.5 text-left font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr
                    key={`${m.part_no}-${m.operation_no ?? ""}-${i}`}
                    className={i % 2 ? "bg-white" : "bg-[#f3f0d8]"}
                  >
                    <td className="px-1">{text(m.replaced_part_no)}</td>
                    <td className="px-1">{text(m.operation_no)}</td>
                    <td className="px-1">
                      {m.substitute_code === "0"
                        ? "0:不可取替代"
                        : text(m.substitute_code)}
                    </td>
                    <td className="px-1 text-right">
                      {qty(m.substitute_rate, 6)}
                    </td>
                    <td className="px-1">{m.part_no}</td>
                    <td className="px-1">{text(m.name)}</td>
                    <td className="px-1">{text(m.specification)}</td>
                    <td className="px-1">{code(m.source, sourceLabels)}</td>
                    <td className="px-1">{text(m.unit)}</td>
                    <td className="px-1 text-right">{qty(m.unit_rate, 8)}</td>
                    <td className="px-1">{text(m.flag)}</td>
                    <td className="px-1 text-right">{qty(m.std_qpa, 8)}</td>
                    <td className="px-1 text-right">{qty(m.actual_qpa, 8)}</td>
                    <td className="px-1 text-right">
                      {qty(m.tolerance_rate, 4)}
                    </td>
                    <td className="px-1 text-right">{qty(m.required_qty)}</td>
                    <td className="px-1 text-right">
                      {qty(m.outsource_buy_qty)}
                    </td>
                    <td className="px-1 text-right">{qty(m.issued_qty)}</td>
                    <td className="px-1 text-right">
                      {qty(m.over_issued_qty)}
                    </td>
                    <td className="px-1 text-right">{qty(m.shortage_qty)}</td>
                    <td className="px-1 text-right">{qty(m.scrap_qty)}</td>
                    <td className="px-1 text-right">{qty(m.stock_loss_qty)}</td>
                    <td className="px-1">{text(m.warehouse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1">總筆數：{rows.length}</p>
        </>
      )}
    </div>
  )
}

// 雙擊工單後，以唯一工單編號取得明細並呈現 ERP 唯讀視窗；
// wos 為列表目前順序，可用上一張／下一張（Alt+←／→）切換。
// 元件只在視窗開啟時掛載，避免重開時殘留上一張的資料。
export function ErpWoDetailDialog({
  wo,
  wos,
  onNavigate,
  onClose,
}: {
  wo: string
  wos: string[]
  onNavigate: (wo: string) => void
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: ["erp.wo-readonly", "detail", wo],
    queryFn: () => Api.readErpWoDetail({ wo }),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
  })
  const index = wos.indexOf(wo)
  const prev = index > 0 ? wos[index - 1] : null
  const next = index >= 0 && index < wos.length - 1 ? wos[index + 1] : null

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey) return
      const target =
        event.key === "ArrowLeft"
          ? prev
          : event.key === "ArrowRight"
            ? next
            : undefined
      if (target === undefined) return
      event.preventDefault()
      if (target) onNavigate(target)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prev, next, onNavigate])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border border-[#777] bg-[#efefef] p-0 shadow-2xl sm:max-w-[min(1200px,calc(100%-2rem))]"
        style={{ fontFamily: '"MingLiU", "PMingLiU", serif' }}
      >
        <DialogHeader className="flex-row items-start justify-between gap-0.5 border-b border-[#aaa] bg-[#e9e9e9] px-2 py-1.5 text-left">
          <div>
            <DialogTitle className="text-sm font-normal">工單明細</DialogTitle>
            <DialogDescription className="text-xs text-[#555]">
              工單編號：{wo}（唯讀）
            </DialogDescription>
          </div>
          <div className="mr-8 flex items-center gap-1 text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-0.5 px-2"
              disabled={!prev}
              title="上一張（Alt+←）"
              onClick={() => prev && onNavigate(prev)}
            >
              <ChevronLeft className="size-3.5" />
              上一張
            </Button>
            <span className="min-w-14 text-center" aria-live="polite">
              {index >= 0 ? `${index + 1} / ${wos.length}` : dash}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-0.5 px-2"
              disabled={!next}
              title="下一張（Alt+→）"
              onClick={() => next && onNavigate(next)}
            >
              下一張
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </DialogHeader>
        {/* 外層同時捲動 X/Y，水平捲軸固定在視窗底部；內層給定最小寬度，頁簽內容變寬時整體橫向捲動。 */}
        <div className="min-h-0 overflow-auto text-xs text-[#222]">
          <div className="min-w-[1400px] p-2">
            {query.isPending && <p role="status">讀取工單明細中…</p>}
            {query.isError && (
              <p role="alert" className="text-destructive">
                {woError(query.error)}
              </p>
            )}
            {query.data && (
              <>
                <BasicSection d={query.data} />
                <Tabs defaultValue="one" className="mt-2 gap-0">
                  <div className="overflow-x-auto border-b border-[#888]">
                    <TabsList className="h-auto w-max gap-0 rounded-none bg-[#efefef] p-0">
                      {[
                        ["one", "工單資料(一)"],
                        ["two", "工單資料(二)"],
                        ["custom", "自訂欄位"],
                      ].map(([value, label]) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className={tabClass}
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  <TabsContent value="one" className={tabPanel}>
                    <WoInfoOne d={query.data} />
                  </TabsContent>
                  <TabsContent value="two" className={tabPanel}>
                    <WoInfoTwo d={query.data} />
                  </TabsContent>
                  <TabsContent value="custom" className={tabPanel}>
                    <CustomFields d={query.data} />
                  </TabsContent>
                </Tabs>
                <MaterialTable wo={wo} />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
