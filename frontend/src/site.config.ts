// 全站設定值集中管理，供各元件載入取代分散的 hardcode
export const siteConfig = {
  appName: "MWF Admin",
  environment: "DEV",
  version: "0.8.9",
  database: "PROD-TPE-01",
  company: "MWF 總公司",
  fiscalYear: 2026,
  language: "繁體中文",
  connectionStatus: "已連線",
} as const
