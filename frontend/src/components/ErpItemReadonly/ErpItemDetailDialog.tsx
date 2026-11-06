import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"

import {
  PageErpItemReadonlyService as Api,
  ApiError,
  type ItemDetail,
} from "@/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  replenishmentLabels,
  sourceLabels,
  statusLabels,
  vendorControlLabels,
} from "./dodo-report.config"

type Props = {
  partNo: string | null
  onOpenChange: (open: boolean) => void
}

const lotControlLabels: Record<string, string> = {
  "1": "必須輸入批號",
}

function valueText(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  return typeof value === "number" ? String(value) : value.trim() || "—"
}

// API 日期為 YYYY-MM-DD；直接取字串，避免時區換算造成日期偏移。
function dateText(value: string | null | undefined): string {
  if (!value) return "—"
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.slice(2).replaceAll("-", "/")
    : valueText(value)
}

function codeText(
  value: string | null | undefined,
  labels: Record<string, string>,
): string {
  const code = value?.trim()
  if (!code) return "—"
  return `${code}:${labels[code] ?? "未定義"}`
}

function detailError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  )
    return error.body.detail
  return "料件明細讀取失敗，請稍後再試。"
}

function DetailField({
  label,
  value,
  className = "",
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-1 ${className}`}
    >
      <dt className="text-xs leading-4 text-[#202020]">{label}</dt>
      <dd
        className="min-h-5 min-w-0 overflow-hidden border border-[#9b9b9b] bg-[#f8f8f8] px-1 py-0 text-xs leading-[18px] text-ellipsis whitespace-nowrap text-[#111] shadow-[inset_1px_1px_0_#666,inset_-1px_-1px_0_#fff]"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

function CheckField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="flex min-h-5 items-center gap-1 text-xs leading-4 text-[#555]">
      <input
        type="checkbox"
        checked={value === "Y"}
        disabled
        readOnly
        aria-label={`${label}：${value === "Y" ? "是" : "否"}`}
        className="size-3 shrink-0 accent-[#333]"
      />
      <span>{label}</span>
    </div>
  )
}

function YellowPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
      <legend className="px-1 text-xs leading-4 font-normal text-[#222]">
        {title}
      </legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  )
}

function DetailContent({ detail }: { detail: ItemDetail }) {
  const keeper = detail.warehouse_keeper?.trim()
  const group = detail.group_code
    ? `${detail.group_code}${detail.group_name ? ` ${detail.group_name}` : ""}`
    : "—"

  return (
    <>
      <section className="grid gap-x-3 gap-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff] md:grid-cols-2">
        <DetailField label="料件編號" value={valueText(detail.part_no)} />
        <DetailField label="分群碼" value={group} />
        <DetailField label="品名" value={valueText(detail.name)} />
        <DetailField
          label="來源碼"
          value={codeText(detail.source, sourceLabels)}
        />
        <DetailField
          label="規格"
          value={valueText(detail.specification)}
          className="md:col-span-2"
        />
        <DetailField
          label="狀況"
          value={codeText(detail.status, statusLabels)}
        />
        <DetailField label="處理狀況" value={valueText(detail.processing)} />
        <DetailField
          label="供應商管制"
          value={codeText(detail.vendor_control, vendorControlLabels)}
        />
        <DetailField label="資料來源" value={valueText(detail.origin)} />
      </section>

      <Tabs defaultValue="engineering" className="mt-1.5 gap-0">
        <div className="overflow-x-auto border-b border-[#888]">
          <TabsList className="h-auto w-max gap-0 rounded-none bg-[#efefef] p-0">
            {[
              ["engineering", "工程／計劃／庫存"],
              ["lot-serial", "批／序號管理"],
              ["accounting", "會計／其它狀態／其它分群"],
              ["dates", "參考日期"],
              ["combination", "組合品資料"],
              ["health", "健保資料"],
              ["custom", "自訂欄位"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative -mb-px rounded-none border-x-0 border-t-0 border-r border-b border-[#999] bg-[#efefef] px-2 py-0.5 text-xs leading-4 font-normal text-[#333] shadow-none data-[state=active]:border-t data-[state=active]:border-b-[#efefef] data-[state=active]:bg-[#efefef] data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="engineering" className="mt-0 pt-1">
          <div className="grid items-start gap-1.5 lg:grid-cols-[1.1fr_0.9fr_1fr]">
            <YellowPanel title="工程">
              <div className="grid gap-y-0.5">
                <CheckField label="軟體物件" value={detail.software_object} />
                <CheckField label="聯產品" value={detail.co_product} />
                <CheckField label="工程料件" value={detail.engineering_item} />
                <CheckField label="檢驗" value={detail.inspection} />
                <CheckField
                  label="自動開窗輸入插件位置"
                  value={detail.auto_plugin_position}
                />
                <CheckField
                  label="重覆性生產料件"
                  value={detail.repetitive_production}
                />
                <CheckField
                  label="插件位置與QPA應要勾稽"
                  value={detail.plugin_qpa_check}
                />
              </div>
              <DetailField
                label="材料類別"
                value={valueText(detail.material_category)}
              />
            </YellowPanel>

            <YellowPanel title="計劃">
              <DetailField
                label="ABC碼"
                value={
                  detail.abc_code
                    ? `${detail.abc_code}:${detail.abc_code}`
                    : "—"
                }
              />
              <CheckField label="消耗料件" value={detail.consumable} />
              <DetailField
                label="補貨策略"
                value={codeText(
                  detail.replenishment_strategy,
                  replenishmentLabels,
                )}
              />
              <DetailField
                label="經濟訂購量"
                value={valueText(detail.economic_order_qty)}
              />
              <DetailField
                label="平均訂購量"
                value={valueText(detail.average_order_qty)}
              />
              <DetailField
                label="安全存量"
                value={valueText(detail.safety_stock)}
              />
              <DetailField
                label="安全期間"
                value={valueText(detail.safety_period)}
              />
              <DetailField
                label="最高存量"
                value={valueText(detail.max_stock)}
              />
              <DetailField
                label="有效天數"
                value={valueText(detail.shelf_life_days)}
              />
            </YellowPanel>

            <YellowPanel title="庫存">
              <DetailField
                label="庫存單位"
                value={valueText(detail.stock_unit)}
              />
              <DetailField
                label="主要倉庫"
                value={valueText(detail.primary_warehouse)}
              />
              <DetailField
                label="主要儲位"
                value={valueText(detail.primary_location)}
              />
              <DetailField
                label="倉管員"
                value={
                  keeper
                    ? `${keeper}${detail.warehouse_keeper_name ? ` ${detail.warehouse_keeper_name}` : ""}`
                    : "—"
                }
              />
              <DetailField
                label="批號控管方式"
                value={codeText(detail.lot_control, lotControlLabels)}
              />
              <DetailField
                label="棧板滿板數量（庫存單位）"
                value={valueText(detail.pallet_full_qty)}
              />
            </YellowPanel>
          </div>
        </TabsContent>
        <TabsContent value="lot-serial" className="mt-0 pt-1">
          <div className="grid items-stretch gap-1.5 lg:grid-cols-[1.1fr_0.9fr_1.8fr]">
            <YellowPanel title="製造批號管理">
              <CheckField
                label="製造批號管理否"
                value={detail.manufacturing_lot_control}
              />
              <CheckField
                label="製造批號自動編碼否"
                value={detail.manufacturing_lot_auto_number}
              />
              <DetailField
                label="製造批號編碼原則"
                value={valueText(detail.manufacturing_lot_rule)}
              />
            </YellowPanel>
            <YellowPanel title="序號管理">
              <CheckField label="序號管理否" value={detail.serial_control} />
              <CheckField
                label="序號自動編碼否"
                value={detail.serial_auto_number}
              />
              <DetailField
                label="序號編碼原則"
                value={valueText(detail.serial_rule)}
              />
              <CheckField label="序號唯一否" value={detail.serial_unique} />
            </YellowPanel>
            <YellowPanel title="排序">
              <DetailField
                label="排序方式"
                value={codeText(detail.lot_sort_method, { "3": "製造日期" })}
              />
              <DetailField
                label="品牌(LINE)"
                value={
                  detail.brand_code
                    ? `${detail.brand_code}${detail.brand_name ? ` ${detail.brand_name}` : ""}`
                    : "—"
                }
              />
              <DetailField
                label="系列"
                value={
                  detail.series_code
                    ? `${detail.series_code}${detail.series_name ? ` ${detail.series_name}` : ""}`
                    : "—"
                }
              />
              <DetailField
                label="製造原廠"
                value={valueText(detail.manufacturer)}
              />
            </YellowPanel>
          </div>
        </TabsContent>
        <TabsContent value="accounting" className="mt-0 pt-1">
          <div className="grid items-stretch gap-1.5 md:grid-cols-2 lg:grid-cols-[1fr_1.25fr_1fr_0.9fr]">
            <YellowPanel title="會計">
              <DetailField
                label="成本分群"
                value={valueText(detail.cost_group)}
              />
              <DetailField
                label="會計科目"
                value={valueText(detail.account_code)}
              />
            </YellowPanel>
            <YellowPanel title="狀態">
              <CheckField label="保稅料件" value={detail.bonded_item} />
              <DetailField
                label="BOM異動"
                value={valueText(detail.bom_changed)}
              />
              <DetailField
                label="低階碼"
                value={valueText(detail.low_level_code)}
              />
              <CheckField
                label="當月入聯產品"
                value={detail.monthly_joint_product}
              />
              <DetailField
                label="稅收分類編碼版本"
                value={valueText(detail.tax_classification_version)}
              />
              <DetailField
                label="稅收分類編碼"
                value={valueText(detail.tax_classification_code)}
              />
            </YellowPanel>
            <YellowPanel title="其它分群碼">
              <DetailField
                label="其他分群碼一"
                value={valueText(detail.other_group_1)}
              />
              <DetailField
                label="其他分群碼二"
                value={valueText(detail.other_group_2)}
              />
              <DetailField
                label="其他分群碼三"
                value={valueText(detail.other_group_3)}
              />
            </YellowPanel>
            <YellowPanel title="規格替代">
              <DetailField
                label="量化規格"
                value={valueText(detail.quantitative_specification)}
              />
              <DetailField
                label="量化單位"
                value={valueText(detail.quantitative_unit)}
              />
            </YellowPanel>
          </div>
        </TabsContent>
        <TabsContent value="dates" className="mt-0 pt-1">
          <div className="grid max-w-[540px] items-stretch gap-1.5 sm:grid-cols-2">
            <div className="space-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
              <DetailField
                label="首次建檔日"
                value={dateText(detail.first_created_date)}
              />
              <DetailField
                label="呆滯日期"
                value={dateText(detail.stagnation_date)}
              />
              <DetailField
                label="開帳呆滯日"
                value={dateText(detail.opening_stagnation_date)}
              />
              <DetailField
                label="最近採購日"
                value={dateText(detail.last_purchase_date)}
              />
              <DetailField
                label="最近入庫日"
                value={dateText(detail.last_receipt_date)}
              />
            </div>
            <div className="space-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
              <DetailField
                label="最近出庫日"
                value={dateText(detail.last_issue_date)}
              />
              <DetailField
                label="最近異動日"
                value={dateText(detail.last_movement_date)}
              />
              <DetailField
                label="最近盤點日"
                value={dateText(detail.last_stocktake_date)}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="combination" className="mt-0 pt-1">
          <div className="max-w-[420px] space-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
            <DetailField
              label="出貨有效天數"
              value={valueText(detail.shipping_valid_days)}
            />
            <CheckField label="組合品否" value={detail.combination_item} />
            <DetailField
              label="組合品生效日"
              value={dateText(detail.combination_effective_date)}
            />
            <DetailField
              label="組合品失效日"
              value={dateText(detail.combination_expiry_date)}
            />
          </div>
        </TabsContent>
        <TabsContent value="health" className="mt-0 pt-1">
          <div className="max-w-[420px] space-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
            <DetailField
              label="健保料號"
              value={valueText(detail.health_insurance_item_no)}
            />
            <DetailField
              label="衛生署字號"
              value={valueText(detail.health_license_no)}
            />
            <DetailField
              label="證號有效期限"
              value={dateText(detail.health_license_expiry_date)}
            />
            <DetailField
              label="複驗天數"
              value={valueText(detail.reinspection_days)}
            />
            <DetailField
              label="管制藥品"
              value={codeText(detail.controlled_drug, { "3": "非管制" })}
            />
            <DetailField
              label="冰品"
              value={codeText(detail.cold_item, { "2": "非冰品" })}
            />
          </div>
        </TabsContent>
        <TabsContent value="custom" className="mt-0 pt-1">
          <div className="max-w-[420px] space-y-0.5 border border-[#aaa] bg-[#ededed] p-1.5 shadow-[inset_1px_1px_0_#fff]">
            <DetailField
              label="藥品申報否"
              value={codeText(detail.drug_declaration, { Y: "是", N: "否" })}
            />
            <DetailField
              label="觀察品項"
              value={codeText(detail.observation_item, { "1": "正常生產" })}
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}

export function ErpItemDetailDialog({ partNo, onOpenChange }: Props) {
  const query = useQuery({
    queryKey: ["erp.item-readonly", "detail", partNo],
    queryFn: () => Api.readItemDetail({ partNo: partNo ?? "" }),
    enabled: Boolean(partNo),
    retry: false,
    staleTime: 60_000,
  })

  return (
    <Dialog open={Boolean(partNo)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border border-[#777] bg-[#efefef] p-0 shadow-2xl sm:max-w-[min(1100px,calc(100%-2rem))]"
        style={{ fontFamily: '"MingLiU", "PMingLiU", serif' }}
      >
        <DialogHeader className="border-b border-[#aaa] bg-[#e9e9e9] gap-0.5 px-2 py-1.5 text-left shadow-[inset_0_-1px_0_#fff]">
          <DialogTitle className="pr-8 text-sm font-normal">
            料件明細
          </DialogTitle>
          <DialogDescription className="text-xs leading-4 text-[#555]">
            {partNo ? `料件編號：${partNo}` : "唯讀料件資料"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-1.5 text-xs leading-4">
          {query.isPending && <p role="status">讀取料件明細中…</p>}
          {query.isError && (
            <p role="alert" className="text-destructive">
              {detailError(query.error)}
            </p>
          )}
          {query.data && <DetailContent detail={query.data} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
