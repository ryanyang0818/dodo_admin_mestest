import { create } from "zustand"
import { persist } from "zustand/middleware"

import { getTabMaxInstances } from "@/components/TabHeader/tabInstancePolicy"
import type { TabItem, TabKey } from "@/components/TabHeader/types"

// 頁籤總量上限；達到後 openTab 直接回傳 false，由呼叫端 toast 提示，不自動關閉舊頁籤
export const MAX_TABS = 20

// 固定頁籤的 id 與 key：Dashboard 永久存在、無法關閉/拖移，且永遠位於最左 (index 0)
export const FIXED_TAB_ID = "dashboard"
const FIXED_TAB_KEY: TabKey = "dashboard"

// localStorage 的 key；v4 改用 Menu API key，避免舊 tab key 狀態回灌
export const TAB_STORAGE_KEY = "dodo.tabs.v4"
const LEGACY_TAB_STORAGE_KEYS = ["dodo.tabs.v2", "dodo.tabs.v3"]

// 清除舊版頁籤狀態，避免 rehydrate 帶回不符合 instance policy 的重複頁籤。
const clearLegacyTabStorage = () => {
  if (typeof window === "undefined") return

  try {
    for (const key of LEGACY_TAB_STORAGE_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // ponytail: 清舊狀態失敗不能阻止 app 啟動；若未來需診斷再接 telemetry
  }
}

clearLegacyTabStorage()

// 產生固定頁籤實例的工廠：reset / rehydrate 補位共用，避免散落的字面量不一致
// 固定頁籤 id 必為常數 FIXED_TAB_ID，這樣 closeTab / reorder 才能用 id 比對鎖定它
const createFixedTab = (): TabItem => ({ id: FIXED_TAB_ID, key: FIXED_TAB_KEY })

// 遞增計數器：給非固定頁籤產生唯一 id。tab id 不顯示於網址、使用者看不到
let idCounter = 0

// 產生新頁籤 id：以時間戳為主、遞增 counter 為輔，確保跨 rehydrate 不撞號（id 不外露，格式不重要）
const nextTabId = (): string => {
  idCounter += 1
  return `tab-${Date.now().toString(36)}-${idCounter}`
}

// store 的完整型別：狀態 + 全部動作（簽名與 API 契約一字不差）
type TabStore = {
  tabs: TabItem[]
  activeId: string
  openTab: (key: TabKey) => boolean
  setActive: (id: string) => void
  closeTab: (id: string) => void
  closeRight: (id: string) => void
  closeAll: () => void
  reorder: (activeId2: string, overId: string) => void
  reset: () => void
  cycleTab: (direction: "next" | "prev") => void
}

// 計算「初始狀態」：只有固定頁籤、active 指向固定頁籤。reset 與 store 初值都用它
const initialState = (): Pick<TabStore, "tabs" | "activeId"> => ({
  tabs: [createFixedTab()],
  activeId: FIXED_TAB_ID,
})

// 唯一真相來源：所有頁籤顯示、active 標記、排序都讀這個 store；Router 完全不參與
export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      // 開啟頁籤：依 TabKey instance policy 決定新增或聚焦既有同 key 頁籤
      // dashboard key → 不新增，只聚焦既有固定頁籤；總量達上限 (>=20) → 回傳 false（硬擋，不自動關）
      openTab: (key) => {
        // 固定頁籤特例：永遠存在且唯一，重複「開啟」只是把焦點移回它
        if (key === FIXED_TAB_KEY) {
          set({ activeId: FIXED_TAB_ID })
          return true
        }

        const { tabs } = get()
        const maxInstances = getTabMaxInstances(key)
        const sameKeyTabs = tabs.filter((t) => t.key === key)

        if (sameKeyTabs.length >= maxInstances) {
          const latestSameKeyTab = sameKeyTabs[sameKeyTabs.length - 1]
          set({ activeId: latestSameKeyTab.id })
          return true
        }

        // 上限硬擋：第 21 個直接拒絕。回傳 false 讓 useOpenTab 跳 toast
        if (tabs.length >= MAX_TABS) {
          return false
        }

        // 同 key 未達 instance 上限時，新增一個全新實例並設為 active
        const tab: TabItem = { id: nextTabId(), key }
        set({ tabs: [...tabs, tab], activeId: tab.id })
        return true
      },

      // 切換 active：純粹更新 activeId；目標不存在則靜默忽略，避免 active 指向幽靈 id
      setActive: (id) => {
        const { tabs, activeId } = get()
        if (id === activeId) return
        if (!tabs.some((t) => t.id === id)) return
        set({ activeId: id })
      },

      // 關閉頁籤：固定頁籤忽略（無 X、不可關）
      // 若關掉的是當前 active → 優先遞補「右邊」，沒有右邊才往「左邊」
      closeTab: (id) => {
        if (id === FIXED_TAB_ID) return

        const { tabs, activeId } = get()
        const index = tabs.findIndex((t) => t.id === id)
        if (index === -1) return

        const nextTabs = tabs.filter((t) => t.id !== id)

        let nextActiveId = activeId
        if (activeId === id) {
          // filter 後同 index 已被右側元素遞補到此位置；沒有右邊才退取左邊 (index-1)
          const fallback = nextTabs[index] ?? nextTabs[index - 1]
          nextActiveId = fallback ? fallback.id : FIXED_TAB_ID
        }

        set({ tabs: nextTabs, activeId: nextActiveId })
      },

      // 關閉右側全部：保留指定頁籤及其左側（固定頁籤永遠在最左，不受影響）
      closeRight: (id) => {
        const { tabs, activeId } = get()
        const index = tabs.findIndex((t) => t.id === id)
        if (index === -1) return

        const nextTabs = tabs.slice(0, index + 1)
        // 無變化 (本來就沒有右側) 則略過 set，避免多餘渲染
        if (nextTabs.length === tabs.length) return

        const stillExists = nextTabs.some((t) => t.id === activeId)
        set({ tabs: nextTabs, activeId: stillExists ? activeId : id })
      },

      // 關閉全部：清掉除固定頁籤以外的所有頁籤，active 設回固定頁籤
      closeAll: () => set(initialState()),

      // 水平重排（dnd-kit 拖拉結束時呼叫）：把 activeId2 移到 overId 的位置
      // 鐵律：固定頁籤鎖在 index 0，不可被移動、也不可被別人插到它前面 → 目標 index clamp >= 1
      reorder: (activeId2, overId) => {
        if (activeId2 === FIXED_TAB_ID) return

        const { tabs } = get()
        const fromIndex = tabs.findIndex((t) => t.id === activeId2)
        let toIndex = tabs.findIndex((t) => t.id === overId)
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

        // clamp 下界為 1：即使拖到固定頁籤上 (index 0)，目標也被夾到 1
        if (toIndex < 1) toIndex = 1

        const nextTabs = [...tabs]
        const [moved] = nextTabs.splice(fromIndex, 1)
        nextTabs.splice(toIndex, 0, moved)
        set({ tabs: nextTabs })
      },

      // 重置：還原成「只有固定頁籤 + active=固定頁籤」。唯一呼叫點 = 登入成功時
      reset: () => set(initialState()),

      // 循環切換頁籤：next 往右、prev 往左，到頭時循環
      cycleTab: (direction) => {
        const { tabs, activeId } = get()
        const index = tabs.findIndex((t) => t.id === activeId)
        if (index === -1) return
        const len = tabs.length
        const newIndex =
          direction === "next" ? (index + 1) % len : (index - 1 + len) % len
        set({ activeId: tabs[newIndex].id })
      },
    }),
    {
      name: TAB_STORAGE_KEY,
      // partialize：只持久化純資料 {id,key} 與 activeId；不存 title/icon/component
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({ id: t.id, key: t.key })),
        activeId: state.activeId,
      }),
      // rehydrate (F5 還原) 後修復：保證 tabs[0] 永遠是固定 dashboard，否則整套鎖定規則失效
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // 防衛 1：localStorage 壞掉/為空 → 重建成初始狀態
        if (!Array.isArray(state.tabs) || state.tabs.length === 0) {
          state.tabs = [createFixedTab()]
          state.activeId = FIXED_TAB_ID
          return
        }

        // 防衛 2：固定頁籤可能不在最前或被竄改 key → 濾掉任何 FIXED_TAB_ID 舊項，強制以工廠補回 index 0
        const others = state.tabs.filter((t) => t.id !== FIXED_TAB_ID)
        state.tabs = [createFixedTab(), ...others]

        // 防衛 3：activeId 指向的頁籤若已不存在 → 收斂回固定頁籤
        if (!state.tabs.some((t) => t.id === state.activeId)) {
          state.activeId = FIXED_TAB_ID
        }
      },
    },
  ),
)
