import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { MenuPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteMenu from "./DeleteMenu"
import EditMenu from "./EditMenu"

interface MenuActionsMenuProps {
  menu: MenuPublic
  menus: MenuPublic[]
}

// 顯示單筆 Menu 的操作選單
export function MenuActionsMenu({ menu, menus }: MenuActionsMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
          <span className="sr-only">Open menu actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditMenu menu={menu} menus={menus} onSuccess={() => setOpen(false)} />
        <DeleteMenu id={menu.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
