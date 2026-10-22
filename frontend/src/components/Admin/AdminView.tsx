import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import { PageHeader } from "@/components/Common/PageHeader"
import PendingUsers from "@/components/Pending/PendingUsers"
import useAuth from "@/hooks/useAuth"

// 取得 Admin 使用者列表查詢設定
function getUsersQueryOptions() {
  return {
    queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
    queryKey: ["users"],
  }
}

// 顯示 Admin 使用者資料表內容
function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const { data: users } = useSuspenseQuery(getUsersQueryOptions())

  const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))

  return <DataTable columns={columns} data={tableData} />
}

// 以 Suspense 包裹 Admin 使用者資料表
function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}

// Admin 純內容元件，供 Router 頁面以外的 Tab Header 工作區重用
export function AdminView() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        tabKey="system.users"
        title="Users"
        description="Manage user accounts and permissions"
      />
      <div className="flex justify-end">
        <AddUser />
      </div>
      <UsersTable />
    </div>
  )
}
