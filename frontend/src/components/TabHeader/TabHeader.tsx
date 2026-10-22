import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { LucideIcon } from "lucide-react"
import { X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { FIXED_TAB_ID } from "@/stores/tabStore"
import type { TabKey } from "./types"

// 拖曳排序時鎖定垂直位移，避免上下亂飄
const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
})

// Controller 注入的 render 形態：store 的 {id,key} 併入 tabRegistry 的 {title,icon}
export type RenderTab = {
  id: string
  key: TabKey
  title: string
  icon: LucideIcon
}

type TabHeaderProps = {
  tabs: RenderTab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCloseRight: (id: string) => void
  onCloseAll: () => void
  onReorder: (activeId: string, overId: string) => void
}

// 純展示頁籤列：水平排序 + 右鍵選單 + 固定頁籤鎖定，狀態全由 props 控制
export function TabHeader({
  tabs,
  activeId,
  onSelect,
  onClose,
  onCloseRight,
  onCloseAll,
  onReorder,
}: TabHeaderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  // 待確認關閉的頁籤 id；非 null 時彈出 Dialog
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)

  // 拖曳結束：擋掉拖曳源為固定頁籤、以及落到固定頁籤之前的無效落點，其餘交回 store
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.id === FIXED_TAB_ID) return
    if (over.id === FIXED_TAB_ID) return
    onReorder(String(active.id), String(over.id))
  }

  const pendingCloseTab = tabs.find((t) => t.id === pendingCloseId)

  return (
    <ScrollArea className="w-full min-w-0 max-w-full overflow-hidden border-b border-border">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          {/* 固定高度＝pt-1(4px) + active 頁籤外框高(35px)，避免 active/inactive 切換動畫時整列高度跳動 */}
          <div className="flex h-[39px] w-max min-w-full items-end gap-1 bg-background pl-1 pt-1">
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeId}
                onSelect={onSelect}
                onClose={onClose}
                onRequestClose={setPendingCloseId}
                onCloseRight={onCloseRight}
                onCloseAll={onCloseAll}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <ScrollBar orientation="horizontal" />

      <Dialog
        open={pendingCloseId !== null}
        onOpenChange={(open) => !open && setPendingCloseId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>關閉頁籤</DialogTitle>
            <DialogDescription>
              確定要關閉「{pendingCloseTab?.title}」嗎？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingCloseId) onClose(pendingCloseId)
                setPendingCloseId(null)
              }}
            >
              確認關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

type SortableTabProps = {
  tab: RenderTab
  isActive: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRequestClose: (id: string) => void
  onCloseRight: (id: string) => void
  onCloseAll: () => void
}

// 單一頁籤：固定頁籤不可拖、無 X；外包右鍵選單三項
function SortableTab({
  tab,
  isActive,
  onSelect,
  onClose,
  onRequestClose,
  onCloseRight,
  onCloseAll,
}: SortableTabProps) {
  const isFixed = tab.id === FIXED_TAB_ID
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: tab.id, disabled: isFixed })
  const style = {
    transform: CSS.Transform.toString(transform),
  }
  const Icon = tab.icon
  // 固定頁籤不掛拖曳 attributes/listeners，徹底擋住拖曳
  const dragProps = isFixed ? {} : { ...attributes, ...listeners }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-tab-id={tab.id}
          data-tab-key={tab.key}
          className={cn(
            "relative flex shrink-0 items-stretch overflow-hidden rounded-t-[10px] rounded-b-none border border-border",
            isDragging ? "transition-none" : "transition-colors",
            isActive
              ? "bg-background border-border/60 shadow-sm"
              : "bg-muted hover:bg-muted/40",
            isDragging && "z-10 opacity-80",
          )}
        >
          {/* 頂部 indicator，active 時顯示 primary 色 */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-0.5 transition-colors",
              isActive && "bg-primary",
            )}
          />
          <button
            type="button"
            {...dragProps}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-1.5",
              isDragging ? "transition-none" : "transition-colors",
              isActive ? "pt-[5px] pb-2 text-sm" : "py-1 text-xs",
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                isDragging ? "transition-none" : "transition-colors",
                isActive
                  ? "size-4 text-primary"
                  : "size-3.5 text-muted-foreground",
              )}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span
              className={cn(
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab.title}
            </span>
          </button>
          {!isFixed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRequestClose(tab.id)
              }}
              className={cn(
                "my-auto mr-1 flex items-center justify-center rounded-sm text-muted-foreground/40 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragging ? "transition-none" : "transition-colors",
                isActive ? "size-5" : "size-4",
              )}
              aria-label={`關閉 ${tab.title}`}
            >
              <X size={isActive ? 10 : 9} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-44">
        {/* 固定頁籤本身不可關閉，故 disabled（radix Item disabled 時 onSelect 不會觸發） */}
        <ContextMenuItem
          variant="destructive"
          disabled={isFixed}
          onSelect={() => onClose(tab.id)}
        >
          關閉本頁籤
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCloseRight(tab.id)}>
          關閉右側頁籤
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onCloseAll()}>
          關閉全部頁籤
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
