import { createFileRoute } from "@tanstack/react-router"

import { BulletinManager } from "@/components/Bulletins/BulletinManager"

export const Route = createFileRoute("/_layout/bulletins")({
  component: BulletinManager,
  head: () => ({
    meta: [{ title: "佈告欄管理 - DoDo Admin" }],
  }),
})
