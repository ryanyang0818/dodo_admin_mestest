export type KeyboardActionMeta = {
  key: string
  label: string
  group: "導航" | "頁籤"
}

// 第二鍵對應表：同時作為 LeaderHintOverlay 的顯示資料與 useLeaderKeyListener 的比對依據
export const keyboardActionsMeta: KeyboardActionMeta[] = [
  { key: "s", label: "跳到搜尋", group: "導航" },
  { key: "h", label: "跳到首頁", group: "導航" },
  { key: "p", label: "開啟命令清單", group: "導航" },
  { key: "n", label: "開新頁籤", group: "頁籤" },
  { key: "w", label: "關閉目前頁籤", group: "頁籤" },
  { key: "]", label: "下一個頁籤", group: "頁籤" },
  { key: "[", label: "上一個頁籤", group: "頁籤" },
]
