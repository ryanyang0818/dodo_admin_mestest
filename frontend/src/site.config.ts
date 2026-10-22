// 全站設定值集中管理，供各元件載入取代分散的 hardcode
export const siteConfig = {
  appName: "DoDo Admin",
  environment: "DEV",
  version: "0.8.9",
  database: "PROD-TPE-01",
  company: "DoDo 總公司",
  fiscalYear: 2026,
  language: "繁體中文",
  connectionStatus: "已連線",
} as const
