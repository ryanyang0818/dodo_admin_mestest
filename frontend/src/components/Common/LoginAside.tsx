import { PublicBulletinBoard } from "@/components/Bulletins/PublicBulletinBoard"
import { ErpItemReadonly } from "@/components/ErpItemReadonly/ErpItemReadonly"
import { ErpWoReadonly } from "@/components/ErpWoReadonly/ErpWoReadonly"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// 登入頁左側的免登入功能區；新增功能時在此加一組 Trigger 與 Content。
export function LoginAside() {
  return (
    <Tabs defaultValue="bulletins" className="h-full w-full min-w-0 gap-0">
      <TabsList className="mx-5 mt-5 lg:mx-10 lg:mt-10">
        <TabsTrigger value="bulletins">最新公告</TabsTrigger>
        <TabsTrigger value="item-query">料號查詢</TabsTrigger>
        <TabsTrigger value="wo-query">工單查詢</TabsTrigger>
      </TabsList>
      <TabsContent value="bulletins">
        <PublicBulletinBoard />
      </TabsContent>
      <TabsContent value="item-query" className="min-w-0 p-5 lg:p-10">
        <ErpItemReadonly />
      </TabsContent>
      <TabsContent value="wo-query" className="min-w-0 p-5 lg:p-10">
        <ErpWoReadonly />
      </TabsContent>
    </Tabs>
  )
}
