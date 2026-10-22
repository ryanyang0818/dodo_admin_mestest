import * as Icons from "lucide-react"
import { FileText, type LucideIcon } from "lucide-react"

const iconRegistry = Icons as Record<string, unknown>

// 判斷傳入值是否為 Lucide React icon 元件
function isLucideIcon(value: unknown): value is LucideIcon {
  return typeof value === "object" && value !== null && "displayName" in value
}

// 依後端 icon 名稱取得 Lucide React 元件，無效時使用 FileText
export function getMenuIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return FileText

  const icon = iconRegistry[iconName]
  return isLucideIcon(icon) ? icon : FileText
}
