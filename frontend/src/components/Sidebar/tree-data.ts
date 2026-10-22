import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CreditCard,
  FileText,
  Folder,
  Package,
  Settings,
  ShoppingCart,
  TrendingUp,
} from "lucide-react"

export type TreeLeaf = {
  type: "leaf"
  icon: LucideIcon
  label: string
  code?: string
  path?: string
  badge?: number
  badgeVariant?: "default" | "warn"
}

export type TreeFolder = {
  type: "folder"
  icon: LucideIcon
  label: string
  children: TreeLeaf[]
}

export type TreeGroup = {
  type: "group"
  icon: LucideIcon
  label: string
  children: TreeFolder[]
  badge?: number
  badgeVariant?: "default" | "warn"
}

export const TREE_DATA: TreeGroup[] = [
  {
    type: "group",
    icon: ShoppingCart,
    label: "採購管理",
    badge: 28,
    children: [
      {
        type: "folder",
        icon: Folder,
        label: "採購訂單",
        children: [
          { type: "leaf", icon: FileText, label: "訂單管理", code: "PUR001" },
          { type: "leaf", icon: FileText, label: "到貨確認", code: "PUR002" },
          { type: "leaf", icon: FileText, label: "退貨處理", code: "PUR003" },
          {
            type: "leaf",
            icon: FileText,
            label: "採購異常處理",
            code: "PUR004",
            badge: 3,
            badgeVariant: "warn",
          },
          {
            type: "leaf",
            icon: FileText,
            label: "採購結案作業",
            code: "PUR005",
          },
        ],
      },
      {
        type: "folder",
        icon: Folder,
        label: "詢價作業",
        children: [
          { type: "leaf", icon: FileText, label: "詢價單建立", code: "PUR011" },
          { type: "leaf", icon: FileText, label: "報價比較", code: "PUR012" },
          { type: "leaf", icon: FileText, label: "詢價歷史", code: "PUR013" },
        ],
      },
      {
        type: "folder",
        icon: Folder,
        label: "供應商管理",
        children: [
          { type: "leaf", icon: FileText, label: "廠商主檔", code: "PUR021" },
          { type: "leaf", icon: FileText, label: "廠商評鑑", code: "PUR022" },
          {
            type: "leaf",
            icon: FileText,
            label: "廠商分類維護",
            code: "PUR023",
          },
          {
            type: "leaf",
            icon: FileText,
            label: "廠商往來明細",
            code: "PUR024",
          },
        ],
      },
    ],
  },
  {
    type: "group",
    icon: TrendingUp,
    label: "銷售管理",
    badge: 15,
    children: [
      { type: "folder", icon: Folder, label: "銷售訂單", children: [] },
      { type: "folder", icon: Folder, label: "出貨作業", children: [] },
      { type: "folder", icon: Folder, label: "客戶管理", children: [] },
    ],
  },
  {
    type: "group",
    icon: Package,
    label: "庫存管理",
    badge: 22,
    children: [
      { type: "folder", icon: Folder, label: "進貨作業", children: [] },
      { type: "folder", icon: Folder, label: "出貨作業", children: [] },
      { type: "folder", icon: Folder, label: "盤點作業", children: [] },
      { type: "folder", icon: Folder, label: "調撥作業", children: [] },
      { type: "folder", icon: Folder, label: "庫存查詢", children: [] },
    ],
  },
  {
    type: "group",
    icon: CreditCard,
    label: "財務管理",
    badge: 7,
    badgeVariant: "warn",
    children: [
      { type: "folder", icon: Folder, label: "應收帳款", children: [] },
      { type: "folder", icon: Folder, label: "應付帳款", children: [] },
      { type: "folder", icon: Folder, label: "收付款處理", children: [] },
      { type: "folder", icon: Folder, label: "發票管理", children: [] },
    ],
  },
  {
    type: "group",
    icon: BarChart3,
    label: "報表中心",
    children: [],
  },
  {
    type: "group",
    icon: Settings,
    label: "系統設定",
    children: [],
  },
]

// 依搜尋字串過濾樹狀資料，保留完整父子路徑
export function filterTree(data: TreeGroup[], query: string): TreeGroup[] {
  if (!query.trim()) return data
  const q = query.toLowerCase()

  return data
    .map((group): TreeGroup | null => {
      if (group.label.toLowerCase().includes(q)) return group

      const matchedFolders = group.children
        .map((folder): TreeFolder | null => {
          if (folder.label.toLowerCase().includes(q)) return folder

          const matchedLeaves = folder.children.filter(
            (leaf) =>
              leaf.label.toLowerCase().includes(q) ||
              (leaf.code?.toLowerCase().includes(q) ?? false),
          )
          if (matchedLeaves.length > 0)
            return { ...folder, children: matchedLeaves }
          return null
        })
        .filter((f): f is TreeFolder => f !== null)

      if (matchedFolders.length > 0)
        return { ...group, children: matchedFolders }
      return null
    })
    .filter((g): g is TreeGroup => g !== null)
}
