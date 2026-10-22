import type { ColumnDef } from "@tanstack/react-table"

import type { MenuPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MenuActionsMenu } from "./MenuActionsMenu"

const ACCESS_POLICY_LABELS: Record<string, string> = {
  authenticated: "Authenticated",
  role: "Role",
}

// 依 parent_id 取得父層 Menu 名稱
function getParentLabel(menu: MenuPublic, menus: MenuPublic[]) {
  if (!menu.parent_id) return "Root"
  return (
    menus.find((candidate) => candidate.id === menu.parent_id)?.label ??
    "Unknown"
  )
}

// 建立 Menu 管理表格欄位
export function getMenuColumns(menus: MenuPublic[]): ColumnDef<MenuPublic>[] {
  return [
    {
      accessorKey: "key",
      header: "Key",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.key}
        </span>
      ),
    },
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.label}</span>
      ),
    },
    {
      accessorKey: "parent_id",
      header: "Parent",
      cell: ({ row }) => (
        <span
          className={cn(
            "text-muted-foreground",
            !row.original.parent_id && "italic",
          )}
        >
          {getParentLabel(row.original, menus)}
        </span>
      ),
    },
    {
      accessorKey: "path",
      header: "Path",
      cell: ({ row }) => (
        <span
          className={cn(
            "block max-w-xs truncate text-muted-foreground",
            !row.original.path && "italic",
          )}
        >
          {row.original.path || "No path"}
        </span>
      ),
    },
    {
      accessorKey: "sort_order",
      header: "Order",
      cell: ({ row }) => <span>{row.original.sort_order ?? 0}</span>,
    },
    {
      accessorKey: "icon",
      header: "Icon",
      cell: ({ row }) => (
        <span
          className={cn(
            "text-muted-foreground",
            !row.original.icon && "italic",
          )}
        >
          {row.original.icon || "No icon"}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "is_visible",
      header: "Visible",
      cell: ({ row }) => (
        <Badge variant={row.original.is_visible ? "default" : "secondary"}>
          {row.original.is_visible ? "Visible" : "Hidden"}
        </Badge>
      ),
    },
    {
      accessorKey: "access_policy",
      header: "Access",
      cell: ({ row }) => {
        const accessPolicy = row.original.access_policy ?? "role"

        return (
          <Badge
            variant={accessPolicy === "authenticated" ? "default" : "secondary"}
          >
            {ACCESS_POLICY_LABELS[accessPolicy] ?? accessPolicy}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MenuActionsMenu menu={row.original} menus={menus} />
        </div>
      ),
    },
  ]
}
