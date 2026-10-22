import { createFileRoute, redirect } from "@tanstack/react-router"

import { UsersService } from "@/client"
import { AdminView } from "@/components/Admin/AdminView"

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const user = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Admin - DoDo Admin",
      },
    ],
  }),
})

// Standalone /admin route 共用頁籤工作區的 AdminView，避免兩套 UI 漂移。
function Admin() {
  return <AdminView />
}
