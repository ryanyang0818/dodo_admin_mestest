import type { TabKey } from "@/components/TabHeader/types"

export const SYSTEM_MAX_TAB_INSTANCES_PER_KEY = 3
export const DEFAULT_TAB_MAX_INSTANCES = 1

type TabInstancePolicy = {
  maxInstances: number
}

export const tabInstancePolicy: Record<string, TabInstancePolicy> = {
  // "master-detail": { maxInstances: 0 }, // 0 = use system max 3
}

// 取得單一 TabKey 可開啟的實例數量上限。
export function getTabMaxInstances(key: TabKey): number {
  const configured = tabInstancePolicy[key]?.maxInstances

  if (configured === undefined) return DEFAULT_TAB_MAX_INSTANCES
  if (configured === 0) return SYSTEM_MAX_TAB_INSTANCES_PER_KEY

  return Math.min(Math.max(configured, 1), SYSTEM_MAX_TAB_INSTANCES_PER_KEY)
}
