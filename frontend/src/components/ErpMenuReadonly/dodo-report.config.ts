export const dodoReportConfig = {
  reportKey: 'erp.menu-readonly',
  reportTitle: '功能表程式清單',
  reportDescription: '唯讀顯示 TIPTOP 功能表（zm_file）裡的程式與名稱、作業目的（gaz_file），同一程式只顯示一次；可用程式代號、程式名稱快速過濾。',
  fields: {
    program_code: { label: '程式代號', sortable: true, width: 170 },
    program_name: { label: '程式名稱', sortable: true, width: 280 },
    purpose: { label: '作業目的', sortable: false, width: 520 },
  },
} as const

export type ErpMenuFieldKey = keyof typeof dodoReportConfig.fields
