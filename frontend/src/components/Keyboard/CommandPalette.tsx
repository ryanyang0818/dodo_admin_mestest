import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { keyboardActionsMeta } from "@/lib/keyboardActions"
import { useLeaderStore } from "@/stores/leaderStore"

// D D p 觸發的固定動作清單 dialog
export function CommandPalette() {
  const commandPaletteOpen = useLeaderStore((s) => s.commandPaletteOpen)
  const closeCommandPalette = useLeaderStore((s) => s.closeCommandPalette)

  return (
    <Dialog
      open={commandPaletteOpen}
      onOpenChange={(open) => !open && closeCommandPalette()}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>快捷鍵清單（D D →）</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {keyboardActionsMeta.map((action) => (
            <div
              key={action.key}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="w-10 text-xs text-muted-foreground">
                {action.group}
              </span>
              <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                {action.key}
              </kbd>
              <span>{action.label}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
