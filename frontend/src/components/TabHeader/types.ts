// 頁籤註冊表的 key；對應 Menu API key 與 tabRegistry 的索引
export type TabKey = string

// 頁籤實例：只持有識別資訊；title/icon 由 Menu API 補齊，component 由 tabRegistry[key] 取得
// 不把 title/icon/component 存進來，是為了讓持久化只需序列化純資料 {id,key}
export type TabItem = {
  id: string
  key: TabKey
}
