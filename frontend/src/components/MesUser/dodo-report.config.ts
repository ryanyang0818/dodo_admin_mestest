export const dodoReportConfig = {
  reportKey: 'mes.user',
  reportTitle: 'MES 使用者報表',
  reportDescription: '查詢 MES 正式區使用者、部門、職稱、最後登入時間與擁有角色（唯讀）。',
  fields: {
    user_sid: { label: 'User SID', visible: false, sortable: false, filterable: false, exportable: true, format: 'text', emptyText: '—', width: 300 },
    account_no: { label: '帳號', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 140 },
    user_name: { label: '姓名', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 140 },
    department: { label: '部門', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 160 },
    title_name: { label: '職稱', visible: true, sortable: true, filterable: true, exportable: true, format: 'text', emptyText: '—', width: 140 },
    is_enabled: { label: '帳號狀態', visible: true, sortable: true, filterable: false, exportable: true, format: 'boolean', emptyText: '—', width: 110 },
    is_admin: { label: '系統管理員', visible: true, sortable: true, filterable: false, exportable: true, format: 'boolean', emptyText: '—', width: 120 },
    last_login_time: { label: '最後登入時間', visible: true, sortable: true, filterable: false, exportable: true, format: 'datetime', emptyText: '從未登入', width: 170 },
    role_names: { label: '擁有角色', visible: true, sortable: false, filterable: true, exportable: true, format: 'badge-list', emptyText: '無', width: 420 },
  },
} as const

export type MesUserFieldKey = keyof typeof dodoReportConfig.fields
