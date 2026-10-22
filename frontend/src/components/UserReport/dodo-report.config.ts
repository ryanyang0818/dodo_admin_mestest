export const dodoReportConfig = {
  reportKey: 'hr.user-report',
  reportTitle: '員工帳號報表',
  reportDescription: '查詢員工帳號狀態、角色與個別選單權限例外。',
  enableExport: true,
  enableGlobalSearch: true,
  enableFilters: true,
  enableSorting: true,
  enablePagination: false,
  enableColumnVisibility: true,
  enableColumnOrder: true,
  enableColumnPinning: true,
  enableRowExpansion: false,
  enableGrouping: false,
  fields: {
    id: {
      label: 'User ID', visible: false, sortable: false, filterable: false,
      filterType: 'none', exportable: true, format: 'text', emptyText: '—',
      width: 300, pinned: null, options: [],
    },
    email: {
      label: '電子郵件', visible: true, sortable: true, filterable: true,
      filterType: 'text', exportable: true, format: 'text', emptyText: '—',
      width: 260, pinned: 'left', options: [],
    },
    full_name: {
      label: '姓名', visible: true, sortable: true, filterable: true,
      filterType: 'text', exportable: true, format: 'text', emptyText: '未填寫',
      width: 180, pinned: null, options: [],
    },
    is_active: {
      label: '帳號狀態', visible: true, sortable: true, filterable: true,
      filterType: 'boolean', exportable: true, format: 'boolean', emptyText: '—',
      width: 120, pinned: null,
      options: [{ value: true, label: '啟用' }, { value: false, label: '停用' }],
    },
    is_superuser: {
      label: 'Superuser', visible: true, sortable: true, filterable: true,
      filterType: 'boolean', exportable: true, format: 'boolean', emptyText: '—',
      width: 120, pinned: null,
      options: [{ value: true, label: '是' }, { value: false, label: '否' }],
    },
    roles: {
      label: '角色', visible: true, sortable: true, filterable: true,
      filterType: 'select', exportable: true, format: 'badge-list', emptyText: '無',
      width: 320, pinned: null, options: [],
    },
    menu_overrides: {
      label: '特別權限', visible: true, sortable: false, filterable: true,
      filterType: 'text', exportable: true, format: 'text', emptyText: '無',
      width: 440, pinned: null, options: [],
    },
    override_count: {
      label: '特別權限數', visible: false, sortable: true, filterable: true,
      filterType: 'number-range', exportable: true, format: 'number', emptyText: '0',
      width: 140, pinned: null, options: [],
    },
    created_at: {
      label: '建立時間', visible: true, sortable: true, filterable: true,
      filterType: 'date-range', exportable: true, format: 'datetime', emptyText: '—',
      width: 180, pinned: null, options: [],
    },
    updated_at: {
      label: '更新時間', visible: false, sortable: true, filterable: true,
      filterType: 'date-range', exportable: true, format: 'datetime', emptyText: '—',
      width: 180, pinned: null, options: [],
    },
    last_login_at: {
      label: '最後登入時間', visible: true, sortable: true, filterable: true,
      filterType: 'date-range', exportable: true, format: 'datetime',
      emptyText: '從未登入', width: 180, pinned: null, options: [],
    },
  },
} as const

export type UserReportFieldKey = keyof typeof dodoReportConfig.fields
