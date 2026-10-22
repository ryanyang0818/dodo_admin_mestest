"""MES 使用者報表唯讀 API（MES 正式區）。"""
import json
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel import Field, SQLModel

from app.api.deps import menu_key_to_path, require_menu
from app.core.mes_db import MesConnectionDep


MENU_KEY = 'mes.user'
ROW_LIMIT = 2000

router = APIRouter(
  prefix=f'/page/{menu_key_to_path(MENU_KEY)}/report',
  tags=['page-mes-user-report'],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class MesUserRole(SQLModel):
  role_no: str | None = None
  role_name: str | None = None


class MesUserReportRow(SQLModel):
  user_sid: str
  account_no: str
  user_name: str | None = None
  department: str | None = None
  title_name: str | None = None
  is_enabled: bool
  is_admin: bool
  last_login_time: datetime | None = None
  role_names: list[str]
  roles: list[MesUserRole]


class MesUserReportResponse(SQLModel):
  data: list[MesUserReportRow]
  count: int
  truncated: bool
  sql: str
  params: dict[str, str | int]


class MesUserReportSql(SQLModel):
  sql: str
  params: dict[str, str | int]


class MesUserOption(SQLModel):
  value: str
  label: str


class MesUserReportOptions(SQLModel):
  departments: list[MesUserOption]
  roles: list[MesUserOption]


MES_USER_SELECT = '''SELECT TOP (:row_limit)
  u.USER_SID AS user_sid,
  u.ACCOUNT_NO AS account_no,
  u.USER_NAME AS user_name,
  d.DEPARTMENT AS department,
  t.TITLE_NAME AS title_name,
  CASE u.ENABLE_FLAG WHEN 'T' THEN 1 ELSE 0 END AS is_enabled,
  CASE u.ADMIN WHEN 'T' THEN 1 ELSE 0 END AS is_admin,
  lg.LAST_LOGIN_TIME AS last_login_time,
  COALESCE(roles.ROLES_JSON, N'[]') AS roles_json
FROM MWF_GTIMES5.dbo.AD_USER u
LEFT JOIN MWF_GTIMES5.dbo.AD_DEPARTMENT d ON d.DEPT_SID = u.DEPT_SID
LEFT JOIN MWF_GTIMES5.dbo.AD_TITLE t ON t.TITLE_SID = u.TITLE_SID
OUTER APPLY (
  SELECT MAX(l.LOGON_TIME) AS LAST_LOGIN_TIME
  FROM MWF_GTIMES5.dbo.LOG_LOGON l
  WHERE l.USER_NAME = u.ACCOUNT_NO
) lg
OUTER APPLY (
  SELECT (
    SELECT r.ROLE_NO AS role_no, r.ROLE_NAME AS role_name
    FROM MWF_RESOURCE5.dbo.AD_USER_ROLE ur
    JOIN MWF_RESOURCE5.dbo.AD_ROLE r ON r.SID = ur.ROLE_SID
    WHERE ur.USER_SID = u.USER_SID
    ORDER BY r.ROLE_NAME
    FOR JSON PATH
  ) AS ROLES_JSON
) roles'''

MES_DEPARTMENT_OPTIONS_QUERY = text(
  '''
  SELECT DEPT_SID AS value, COALESCE(DEPARTMENT, DEPT_NO) AS label
  FROM MWF_GTIMES5.dbo.AD_DEPARTMENT
  ORDER BY DEPT_NO
  '''
)

MES_ROLE_OPTIONS_QUERY = text(
  '''
  SELECT SID AS value, COALESCE(ROLE_NAME, ROLE_NO) AS label
  FROM MWF_RESOURCE5.dbo.AD_ROLE
  ORDER BY ROLE_NAME
  '''
)


# 跳脫 LIKE 萬用字元，讓關鍵字只做字面比對
def escapeLike(value: str) -> str:
  for char in ('\\', '%', '_', '['):
    value = value.replace(char, f'\\{char}')
  return value


# 依搜尋條件組出參數化 SQL；條件文字固定，使用者輸入只進 bind 參數
def buildMesUserQuery(
  keyword: str | None = None,
  dept_sid: str | None = None,
  enable: Literal['T', 'F'] | None = None,
  admin: Literal['T', 'F'] | None = None,
  role_sid: str | None = None,
) -> tuple[str, dict[str, str | int]]:
  conditions: list[str] = []
  params: dict[str, str | int] = {'row_limit': ROW_LIMIT + 1}

  if keyword and keyword.strip():
    conditions.append(
      "(u.ACCOUNT_NO LIKE :keyword ESCAPE '\\' OR u.USER_NAME LIKE :keyword ESCAPE '\\')"
    )
    params['keyword'] = f'%{escapeLike(keyword.strip())}%'
  if dept_sid:
    conditions.append('u.DEPT_SID = :dept_sid')
    params['dept_sid'] = dept_sid
  if enable == 'T':
    conditions.append("u.ENABLE_FLAG = 'T'")
  elif enable == 'F':
    conditions.append("COALESCE(u.ENABLE_FLAG, 'F') <> 'T'")
  if admin == 'T':
    conditions.append("u.ADMIN = 'T'")
  elif admin == 'F':
    conditions.append("COALESCE(u.ADMIN, 'F') <> 'T'")
  if role_sid:
    conditions.append(
      'EXISTS (SELECT 1 FROM MWF_RESOURCE5.dbo.AD_USER_ROLE fr '
      'WHERE fr.USER_SID = u.USER_SID AND fr.ROLE_SID = :role_sid)'
    )
    params['role_sid'] = role_sid

  sql = MES_USER_SELECT
  if conditions:
    sql += '\nWHERE ' + '\n  AND '.join(conditions)
  sql += '\nORDER BY u.ACCOUNT_NO'
  return sql, params


# 將查詢列轉成報表白名單模型
def mesUserRowFromMapping(row: dict[str, object]) -> MesUserReportRow:
  data = dict(row)
  roles = json.loads(str(data.pop('roles_json')))
  data['roles'] = roles
  data['role_names'] = [role['role_name'] for role in roles if role.get('role_name')]
  return MesUserReportRow.model_validate(data)


class MesUserReportFilters(SQLModel):
  keyword: str | None = Field(default=None, max_length=50)
  dept_sid: str | None = Field(default=None, max_length=50)
  enable: Literal['T', 'F'] | None = None
  admin: Literal['T', 'F'] | None = None
  role_sid: str | None = Field(default=None, max_length=50)


MesUserReportFiltersDep = Annotated[MesUserReportFilters, Query()]


# 只組出預計執行的 SQL，不連 MES
@router.get('/sql', response_model=MesUserReportSql)
def readMesUserReportSql(filters: MesUserReportFiltersDep) -> MesUserReportSql:
  sql, params = buildMesUserQuery(**filters.model_dump())
  return MesUserReportSql(sql=sql, params=params)


# 依條件查詢 MES 使用者報表
@router.get('/', response_model=MesUserReportResponse)
def readMesUserReport(
  connection: MesConnectionDep,
  filters: MesUserReportFiltersDep,
) -> MesUserReportResponse:
  sql, params = buildMesUserQuery(**filters.model_dump())
  rows = connection.execute(text(sql), params).mappings().all()
  data = [mesUserRowFromMapping(dict(row)) for row in rows[:ROW_LIMIT]]
  return MesUserReportResponse(
    data=data,
    count=len(data),
    truncated=len(rows) > ROW_LIMIT,
    sql=sql,
    params=params,
  )


# 取得部門與角色下拉選項
@router.get('/options', response_model=MesUserReportOptions)
def readMesUserReportOptions(connection: MesConnectionDep) -> MesUserReportOptions:
  departments = connection.execute(MES_DEPARTMENT_OPTIONS_QUERY).mappings().all()
  roles = connection.execute(MES_ROLE_OPTIONS_QUERY).mappings().all()
  return MesUserReportOptions(
    departments=[MesUserOption.model_validate(dict(row)) for row in departments],
    roles=[MesUserOption.model_validate(dict(row)) for row in roles],
  )
