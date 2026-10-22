export const statusLabels = {
  todo: '待辦',
  doing: '進行中',
  done: '完成',
} as const

export const termLabels = {
  tomorrow: '明天',
  short_term: '短期',
  mid_term: '中期',
  long_term: '長期',
  uncategorized: '未分類',
} as const

export const dodoReportConfig = {
  reportKey: 'todo-report',
  reportTitle: '我的待辦報表',
  reportDescription: '查詢目前登入者自己的待辦狀態、期限、標籤與建立時間。',
  enableExport: true,
  enableGlobalSearch: true,
  enableFilters: true,
  enableSorting: true,
  enablePagination: false,
  enableColumnVisibility: true,
  enableColumnOrder: true,
  enableColumnPinning: false,
  enableRowExpansion: false,
  enableGrouping: false,
  fields: {
    id: { label: 'Todo ID', visible: false, sortable: false, filterable: false, exportable: true, format: 'text', emptyText: '—', width: 300 },
    content: { label: '待辦內容', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 420 },
    status: { label: '狀態', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 120 },
    term: { label: '期限類別', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '未分類', width: 130 },
    due_date: { label: '到期日', visible: true, sortable: true, filterable: true, exportable: true, format: 'date', emptyText: '—', width: 140 },
    tags: { label: '標籤', visible: true, sortable: false, filterable: true, exportable: true, format: 'badge-list', emptyText: '無標籤', width: 260 },
    is_pinned: { label: '釘選', visible: true, sortable: true, filterable: true, exportable: true, format: 'boolean', emptyText: '—', width: 100 },
    sort_order: { label: '看板排序', visible: false, sortable: true, filterable: false, exportable: true, format: 'number', emptyText: '0', width: 120 },
    created_at: { label: '建立時間', visible: true, sortable: true, filterable: true, exportable: true, format: 'datetime', emptyText: '—', width: 180 },
  },
} as const

export type TodoReportFieldKey = keyof typeof dodoReportConfig.fields
