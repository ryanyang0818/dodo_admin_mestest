import type { ComponentType } from "react"

import { AdminView } from "@/components/Admin/AdminView"
import { DashboardView } from "@/components/Dashboard/DashboardView"
import { TtDictionary } from "@/components/TtDictionary/TtDictionary"
import { MesDictionary } from "@/components/MesDictionary/MesDictionary"
import { ErpMenuReadonly } from "@/components/ErpMenuReadonly/ErpMenuReadonly"
import { ErpSlipReadonly } from "@/components/ErpSlipReadonly/ErpSlipReadonly"
import { ErpWoReadonly } from "@/components/ErpWoReadonly/ErpWoReadonly"
import { ItemsView } from "@/components/Items/ItemsView"
import { ItemsCRUD } from "@/components/ItemsCRUD/ItemsCRUD"
import { MasterDetailDemo } from "@/components/MasterDetailDemo/MasterDetailDemo"
import { MenusCRUDV2 } from "@/components/MenusCRUDV2/MenusCRUDV2"
import { MesUserView } from "@/components/MesUser/MesUserView"
import { MesWoReport } from "@/components/MesWoReport/MesWoReport"
import { MesWorkReport } from "@/components/MesWorkReport/MesWorkReport"
import { MesInspectionQuery } from "@/components/MesInspectionQuery/MesInspectionQuery"
import { RoleReport } from "@/components/RoleReport/RoleReport"
import type { TabKey } from "@/components/TabHeader/types"
import { TodoReport } from "@/components/TodoReport/TodoReport"
import { TodosView } from "@/components/Todos/TodosView"
import { UserReport } from "@/components/UserReport/UserReport"

// 單一頁籤種類的定義：只保存前端元件；標題與 icon 以 Menu API 為準。
type TabDefinition = {
  component: ComponentType
}

// 頁籤種類對照表：Menu API key → 前端內容元件。
export const tabRegistry: Record<TabKey, TabDefinition> = {
  dashboard: {
    component: DashboardView,
  },
  items: {
    component: ItemsView,
  },
  todos: {
    component: TodosView,
  },
  "todo-report": {
    component: TodoReport,
  },
  "items-crud": {
    component: ItemsCRUD,
  },
  "hr.user-report": {
    component: UserReport,
  },
  "master-detail": {
    component: MasterDetailDemo,
  },
  "system.users": {
    component: AdminView,
  },
  "system.menus": {
    component: MenusCRUDV2,
  },
  "system.role-report": {
    component: RoleReport,
  },
  "mes.user": {
    component: MesUserView,
  },
  "mes.wo": {
    component: MesWoReport,
  },
  "mes.work-report": {
    component: MesWorkReport,
  },
  "mes.inspection-query": {
    component: MesInspectionQuery,
  },
  "erp.wo-readonly": {
    component: ErpWoReadonly,
  },
  "erp.slip-readonly": {
    component: ErpSlipReadonly,
  },
  "erp.menu-readonly": {
    component: ErpMenuReadonly,
  },
  "database.tt-dictionary": {
    component: TtDictionary,
  },
  "database.mes-dictionary": {
    component: MesDictionary,
  },
}

// 以 key 取得頁籤定義；查無對應時回傳 undefined（呼叫端需自行防呆）
export function getTabDefinition(key: TabKey): TabDefinition | undefined {
  return tabRegistry[key]
}

// 判斷 Menu API key 是否有對應的前端頁籤元件。
export function hasTabDefinition(key: TabKey): boolean {
  return key in tabRegistry
}
