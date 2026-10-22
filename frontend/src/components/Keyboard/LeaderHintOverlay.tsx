import { keyboardActionsMeta } from "@/lib/keyboardActions"
import { useLeaderStore } from "@/stores/leaderStore"

const GROUPS = ["導航", "頁籤"] as const

// 進入 leader 模式時右下角被動提示浮層，列出可用第二鍵
export function LeaderHintOverlay() {
  const phase = useLeaderStore((s) => s.phase)

  if (phase !== "waitingSecondKey") return null

  return (
    <div className="fixed bottom-4 right-4 z-50 min-w-36 rounded-[var(--radius)] border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        D D →
      </div>
      {GROUPS.map((group) => (
        <div key={group} className="mb-1.5 last:mb-0">
          <div className="mb-1 text-xs text-muted-foreground">{group}</div>
          {keyboardActionsMeta
            .filter((a) => a.group === group)
            .map((a) => (
              <div key={a.key} className="flex items-center gap-2 py-0.5">
                <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {a.key}
                </kbd>
                <span className="text-xs">{a.label}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
