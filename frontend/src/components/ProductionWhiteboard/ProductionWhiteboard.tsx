import {
  DndContext,
  type DragEndEvent,
  type Modifier,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { toast } from "sonner"
import { ApiError, type ErpWoDetail, PageErpWoReadonlyService } from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Station = { id: string; name: string }
type OrderNotes = {
  dateFrom: string
  dateTo: string
  remark: string
  comment: string
}
const emptyNotes: OrderNotes = {
  dateFrom: "",
  dateTo: "",
  remark: "",
  comment: "",
}
type BoardOrder = {
  detail: ErpWoDetail
  stationId: string | null
  notes?: OrderNotes
}
type OrderPlacement = {
  orders: BoardOrder[]
  onEdit: (order: BoardOrder) => void
  onMove: (wo: string, stationId: string | null) => void
}
const WORK_ORDER_DRAG_TYPE = "application/x-production-whiteboard-order"

function WorkOrderArea({
  orders,
  onMove,
  onEdit,
  stationId,
  label,
}: OrderPlacement & { stationId: string | null; label: string }) {
  const [isOver, setIsOver] = useState(false)
  const visibleOrders = orders.filter((order) => order.stationId === stationId)
  return (
    <section
      aria-label={label}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(WORK_ORDER_DRAG_TYPE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        setIsOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setIsOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsOver(false)
        const wo = event.dataTransfer.getData(WORK_ORDER_DRAG_TYPE)
        if (wo) onMove(wo, stationId)
      }}
      className={`min-h-36 flex-1 space-y-2 overflow-x-auto p-3 ${isOver ? "bg-sky-100/60 ring-2 ring-inset ring-sky-400" : ""}`}
    >
      {visibleOrders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {stationId === null
            ? "搜尋工單後會加入此處，可拖曳至各站別。"
            : "將工單拖曳至此"}
        </p>
      )}
      {visibleOrders.map((order) => {
        const { detail, notes } = order
        const dates = [notes?.dateFrom, notes?.dateTo]
          .filter(Boolean)
          .map((date) => date?.replaceAll("-", "."))
          .join(" ～ ")
        return (
          <Tooltip key={detail.wo}>
            <TooltipTrigger asChild>
              <button
                type="button"
                key={detail.wo}
                aria-label={`工單 ${detail.wo}`}
                draggable
                onDoubleClick={() => onEdit(order)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onEdit(order)
                  }
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData(WORK_ORDER_DRAG_TYPE, detail.wo)
                  event.dataTransfer.effectAllowed = "move"
                }}
                className="w-fit min-w-full text-left focus-visible:outline-2 focus-visible:outline-ring cursor-grab rounded border bg-background px-3 py-2 shadow-sm active:cursor-grabbing"
              >
                <span className="flex items-baseline justify-between gap-3 whitespace-nowrap font-semibold">
                  <span>{detail.wo}</span>
                  {dates && (
                    <span className="text-xs text-red-600">{dates}</span>
                  )}
                </span>
                <span className="mt-1 flex gap-3 whitespace-nowrap text-xs text-muted-foreground">
                  <span>批號：{detail.lot_no || "—"}</span>
                  <span>料號：{detail.part_no || "—"}</span>
                  <span>
                    數量：{detail.plan_qty?.toLocaleString("zh-TW") ?? "—"}
                  </span>
                </span>
                {notes?.remark && (
                  <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-blue-600">
                    {notes.remark}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {notes?.comment && (
              <TooltipContent className="max-w-sm whitespace-pre-wrap break-words text-orange-400">
                {notes.comment}
              </TooltipContent>
            )}
          </Tooltip>
        )
      })}
    </section>
  )
}

const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
})

function SortableStation({
  station,
  orders,
  onMove,
  onEdit,
}: { station: Station } & OrderPlacement) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: station.id })

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`whiteboard-station-${station.id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="relative min-w-0"
    >
      <div className="flex h-full min-w-0 flex-col border border-r-[3px] border-b-[3px] border-muted-foreground/20 border-r-muted-foreground/60 border-b-muted-foreground/60 bg-muted/20 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
        <h3 id={`whiteboard-station-${station.id}`}>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`拖曳 ${station.name} 調整同樓層順序`}
            className="flex w-full touch-none cursor-grab items-center gap-2 border-b border-muted-foreground/20 px-3 py-2 text-left text-base font-semibold active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring"
          >
            <GripVertical
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            {station.name}
          </button>
        </h3>
        <WorkOrderArea
          orders={orders}
          onMove={onMove}
          onEdit={onEdit}
          stationId={station.id}
          label={`${station.name} 工單區`}
        />
      </div>
    </section>
  )
}

// 每層各自管理排序與拖曳範圍，其他樓層不會成為可放置目標。
function FloorStations({
  stations: initialStations,
  orders,
  onMove,
  onEdit,
}: { stations: Station[] } & OrderPlacement) {
  const [stations, setStations] = useState(initialStations)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setStations((current) => {
      const from = current.findIndex((station) => station.id === active.id)
      const to = current.findIndex((station) => station.id === over.id)
      return from < 0 || to < 0 ? current : arrayMove(current, from, to)
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={stations}
        strategy={horizontalListSortingStrategy}
      >
        <div
          className="grid min-w-0 gap-1.5 md:gap-3"
          style={{
            gridTemplateColumns: `repeat(${stations.length}, minmax(0, 1fr))`,
          }}
        >
          {stations.map((station) => (
            <SortableStation
              key={station.id}
              station={station}
              orders={orders}
              onMove={onMove}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export function ProductionWhiteboard() {
  const workOrderInputId = useId()
  const [workOrder, setWorkOrder] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [orders, setOrders] = useState<BoardOrder[]>([])

  const [editing, setEditing] = useState<{
    wo: string
    notes: OrderNotes
  } | null>(null)
  const editorId = useId()

  function editOrder(order: BoardOrder) {
    setEditing({
      wo: order.detail.wo,
      notes: { ...(order.notes ?? emptyNotes) },
    })
  }

  function updateNote(key: keyof OrderNotes, value: string) {
    setEditing((current) =>
      current
        ? { ...current, notes: { ...current.notes, [key]: value } }
        : current,
    )
  }

  function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const { dateFrom, dateTo } = editing.notes
    if (
      Boolean(dateFrom) !== Boolean(dateTo) ||
      (dateFrom && dateTo < dateFrom)
    ) {
      toast.error("請填寫完整日期區間，結束日期不可早於開始日期")
      return
    }
    setOrders((current) =>
      current.map((order) =>
        order.detail.wo === editing.wo
          ? { ...order, notes: { ...editing.notes } }
          : order,
      ),
    )
    setEditing(null)
  }

  function moveOrder(wo: string, stationId: string | null) {
    setOrders((current) =>
      current.map((order) =>
        order.detail.wo === wo ? { ...order, stationId } : order,
      ),
    )
  }

  async function searchWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const wo = workOrder.trim()
    if (isSearching) return
    if (!wo) {
      toast.error("請輸入工單號碼")
      return
    }
    setIsSearching(true)
    try {
      const detail = await PageErpWoReadonlyService.readErpWoDetail({ wo })
      if (orders.some((order) => order.detail.wo === detail.wo)) {
        toast.info("此工單已在白板或暫存區中")
        return
      }
      setOrders((current) =>
        current.some((order) => order.detail.wo === detail.wo)
          ? current
          : [...current, { detail, stationId: null }],
      )
      toast.success("OK", { description: `ERP 找到工單：${wo}` })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.error("NG", { description: `ERP 查無工單：${wo}` })
      } else if (error instanceof ApiError && error.status === 422) {
        toast.error("工單號碼格式錯誤，請確認後重試")
      } else {
        toast.error("查詢失敗", {
          description: "無法確認工單是否存在，請稍後重試。",
        })
      }
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        tabKey="production.whiteboard"
        title="生產白板"
        description="拖曳站別標題可調整同樓層順序；工單卡片可在暫存區與各樓層站別間移動。雙擊工單卡片可編輯日期區間、備註與註解。數量為 ERP 工單生產數量。資料僅暫存於本頁，重新整理後清空並恢復預設順序。"
      />
      <div className="flex min-w-0 flex-col items-start gap-4 lg:flex-row">
        <div className="w-full min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
          {[
            {
              floor: 6,
              stations: [
                { id: "6f-1", name: "6F-1" },
                { id: "6f-2", name: "6F-2" },
                { id: "6f-3", name: "6F-泡泡染" },
                { id: "6f-4", name: "6F-DN601" },
                { id: "6f-5", name: "6F-DN霜劑" },
              ],
            },
            {
              floor: 5,
              stations: [
                { id: "5f-1", name: "5F-充填3" },
                { id: "5f-2", name: "5F-軟管" },
                { id: "5f-3", name: "5F-CD" },
              ],
            },
            {
              floor: 4,
              stations: [
                { id: "4f-1", name: "4F-1" },
                { id: "4f-2", name: "4F-2" },
                { id: "4f-3", name: "4F-3" },
              ],
            },
          ].map(({ floor, stations }, index) => (
            <section
              key={floor}
              aria-labelledby={`whiteboard-floor-${floor}`}
              className="relative grid min-h-56 grid-cols-[3.25rem_minmax(0,1fr)] gap-3 px-4 py-4 md:min-h-64"
            >
              {index > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-emerald-500/70"
                />
              )}
              <h2
                id={`whiteboard-floor-${floor}`}
                className="mt-3 self-start justify-self-start rounded-sm border-2 border-red-400/70 px-3 py-1 text-xl font-semibold tracking-wider text-red-500"
              >
                {floor}F
              </h2>
              <FloorStations
                stations={stations}
                orders={orders}
                onMove={moveOrder}
                onEdit={editOrder}
              />
            </section>
          ))}
        </div>
        <details
          open
          className="w-full min-w-0 shrink-0 rounded-lg border bg-card lg:w-auto lg:open:w-[320px]"
        >
          <summary className="cursor-pointer select-none rounded-t-lg px-5 py-4 text-base font-semibold focus-visible:outline-2 focus-visible:outline-ring">
            編輯區塊
          </summary>
          <div className="min-h-[480px] border-t p-5 md:min-h-[560px]">
            <form onSubmit={searchWorkOrder} className="max-w-lg space-y-2">
              <label htmlFor={workOrderInputId} className="text-sm font-medium">
                工單號碼
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={workOrderInputId}
                  value={workOrder}
                  onChange={(event) => setWorkOrder(event.target.value)}
                  placeholder="請輸入完整工單號碼"
                  maxLength={50}
                  required
                  disabled={isSearching}
                />
                <Button type="submit" disabled={isSearching}>
                  {isSearching ? "搜尋中…" : "搜尋"}
                </Button>
              </div>
            </form>
            <section className="mt-5 rounded-lg border">
              <h2 className="border-b px-4 py-3 font-semibold">暫存區</h2>
              <WorkOrderArea
                orders={orders}
                onMove={moveOrder}
                onEdit={editOrder}
                stationId={null}
                label="暫存區工單"
              />
            </section>
          </div>
        </details>
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯工單 {editing?.wo}</DialogTitle>
            <DialogDescription>
              資料暫存於本頁，重新整理或離開本頁後清空。日期區間可留白。
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={saveNotes} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  日期區間（年.月.日）
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor={`${editorId}-from`} className="text-sm">
                      開始日期
                    </label>
                    <Input
                      id={`${editorId}-from`}
                      type="date"
                      className="text-red-600"
                      value={editing.notes.dateFrom}
                      required={!!editing.notes.dateTo}
                      onChange={(e) => updateNote("dateFrom", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`${editorId}-to`} className="text-sm">
                      結束日期
                    </label>
                    <Input
                      id={`${editorId}-to`}
                      type="date"
                      className="text-red-600"
                      min={editing.notes.dateFrom || undefined}
                      value={editing.notes.dateTo}
                      required={!!editing.notes.dateFrom}
                      onChange={(e) => updateNote("dateTo", e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-red-600">
                  {[editing.notes.dateFrom, editing.notes.dateTo]
                    .filter(Boolean)
                    .map((date) => date.replaceAll("-", "."))
                    .join(" ～ ")}
                </p>
              </fieldset>
              <div className="space-y-1">
                <label
                  htmlFor={`${editorId}-remark`}
                  className="text-sm font-medium"
                >
                  備註
                </label>
                <Input
                  id={`${editorId}-remark`}
                  className="text-blue-600"
                  value={editing.notes.remark}
                  onChange={(e) => updateNote("remark", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${editorId}-comment`}
                  className="text-sm font-medium"
                >
                  註解
                </label>
                <textarea
                  id={`${editorId}-comment`}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-orange-600 shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
                  value={editing.notes.comment}
                  onChange={(e) => updateNote("comment", e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  取消
                </Button>
                <Button type="submit">儲存</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
