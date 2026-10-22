"""角色權限報表唯讀 API。"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import SQLModel

from app.api.deps import SessionDep, menu_key_to_path, require_menu


MENU_KEY = 'system.role-report'

router = APIRouter(
  prefix=f'/page/{menu_key_to_path(MENU_KEY)}/report',
  tags=['page-system-role-report'],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class RoleMenuItem(SQLModel):
  key: str
  label: str
  path: str | None = None


class RoleReportRow(SQLModel):
  id: str
  code: str
  name: str
  description: str | None = None
  is_active: bool
  sort_order: int
  user_count: int
  menu_count: int
  menu_keys: list[str]
  menu_labels: list[str]
  menus: list[RoleMenuItem]
  created_at: datetime
  updated_at: datetime


class RoleReportResponse(SQLModel):
  data: list[RoleReportRow]
  count: int


ROLE_REPORT_QUERY = text(
  '''
  SELECT
    CONVERT(varchar(36), r.id) AS id,
    r.code,
    r.name,
    r.description,
    r.is_active,
    r.sort_order,
    (SELECT count(*) FROM dbo.user_role ur WHERE ur.role_id = r.id) AS user_count,
    (SELECT count(*) FROM dbo.view_role_menu vrm WHERE vrm.role_id = r.id) AS menu_count,
    COALESCE((
      SELECT menu_key AS [key], menu_label AS label, menu_path AS path
      FROM dbo.view_role_menu vrm
      WHERE vrm.role_id = r.id
      ORDER BY menu_key
      FOR JSON PATH
    ), N'[]') AS menus_json,
    r.created_at,
    r.updated_at
  FROM dbo.[role] r
  ORDER BY r.sort_order, r.code
  '''
)


# 將查詢列轉成報表白名單模型
def roleReportRowFromMapping(row: dict[str, object]) -> RoleReportRow:
  data = dict(row)
  menus = json.loads(str(data.pop('menus_json')))
  data['menus'] = menus
  data['menu_keys'] = [menu['key'] for menu in menus]
  data['menu_labels'] = [menu['label'] for menu in menus]
  return RoleReportRow.model_validate(data)


# 取得全部角色權限報表資料
@router.get('/', response_model=RoleReportResponse)
def readRoleReport(session: SessionDep) -> RoleReportResponse:
  rows = session.execute(ROLE_REPORT_QUERY).mappings().all()
  data = [roleReportRowFromMapping(dict(row)) for row in rows]
  return RoleReportResponse(data=data, count=len(data))
