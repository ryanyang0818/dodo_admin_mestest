import { PublicBulletinBoard } from "@/components/Bulletins/PublicBulletinBoard"
import { ErpItemReadonly } from "@/components/ErpItemReadonly/ErpItemReadonly"
import { ErpWoReadonly } from "@/components/ErpWoReadonly/ErpWoReadonly"
import { ProductionWhiteboard } from "@/components/ProductionWhiteboard/ProductionWhiteboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// 登入頁左側的免登入功能區；新增功能時在此加一組 Trigger 與 Content。
export function LoginAside({ loginAction }: { loginAction?: React.ReactNode }) {
  return (
    <Tabs defaultValue="bulletins" className="h-full w-full min-w-0 gap-0">
      <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 lg:mx-10 lg:mt-10">
        <TabsList>
          <TabsTrigger value="bulletins">最新公告</TabsTrigger>
          <TabsTrigger value="item-query">料號查詢</TabsTrigger>
          <TabsTrigger value="wo-query">工單查詢</TabsTrigger>
          <TabsTrigger value="production-whiteboard">生產白板</TabsTrigger>
        </TabsList>
        {loginAction}
      </div>
      <TabsContent value="bulletins">
        <PublicBulletinBoard />
      </TabsContent>
      <TabsContent value="item-query" className="min-w-0 p-5 lg:p-10">
        <ErpItemReadonly />
      </TabsContent>
      <TabsContent value="wo-query" className="min-w-0 p-5 lg:p-10">
        <ErpWoReadonly />
      </TabsContent>
      <TabsContent
        value="production-whiteboard"
        className="min-w-0 p-5 lg:p-10"
      >
        <ProductionWhiteboard />
      </TabsContent>
    </Tabs>
  )
}
