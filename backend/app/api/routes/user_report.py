"""員工帳號報表唯讀 API。"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import SQLModel

from app.api.deps import SessionDep, menu_key_to_path, require_menu


MENU_KEY = 'hr.user-report'

router = APIRouter(
  prefix=f'/page/{menu_key_to_path(MENU_KEY)}/report',
  tags=['page-hr-user-report'],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class UserReportRow(SQLModel):
  id: str
  email: str
  full_name: str | None = None
  is_active: bool
  is_superuser: bool
  roles: list[str]
  menu_overrides: str | None = None
  override_count: int
  created_at: datetime
  updated_at: datetime
  last_login_at: datetime | None = None


class UserReportResponse(SQLModel):
  data: list[UserReportRow]
  count: int


USER_REPORT_QUERY = text(
  '''
  SELECT
    CONVERT(varchar(36), u.id) AS id,
    u.email,
    u.full_name,
    u.is_active,
    u.is_superuser,
    COALESCE((
      SELECT CONCAT(r.code, N'（', r.name, N'）') AS [value]
      FROM dbo.user_role ur
      JOIN dbo.[role] r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
      ORDER BY r.sort_order, r.code
      FOR JSON PATH
    ), N'[]') AS roles_json,
    (
      SELECT STRING_AGG(
        CAST(CONCAT(
          CASE effect
            WHEN 'allow' THEN N'允許'
            WHEN 'deny' THEN N'拒絕'
            ELSE effect
          END,
          N'－', menu_label, N' [', menu_key, N']',
          CASE
            WHEN reason IS NULL OR LTRIM(RTRIM(reason)) = '' THEN N''
            ELSE CONCAT(N'－', reason)
          END
        ) AS nvarchar(max)), N', '
      ) WITHIN GROUP (ORDER BY assigned_at, menu_key)
      FROM dbo.view_user_menu_override
      WHERE user_id = u.id
    ) AS menu_overrides,
    (
      SELECT count(*)
      FROM dbo.view_user_menu_override
      WHERE user_id = u.id
    ) AS override_count,
    u.created_at,
    u.updated_at,
    u.last_login_at
  FROM dbo.[user] u
  ORDER BY u.email
  '''
)


# 將查詢列轉成報表白名單模型
def userReportRowFromMapping(row: dict[str, object]) -> UserReportRow:
  data = dict(row)
  roles = json.loads(str(data.pop('roles_json')))
  data['roles'] = [item['value'] for item in roles]
  return UserReportRow.model_validate(data)


# 取得全部員工帳號報表資料
@router.get('/', response_model=UserReportResponse)
def readUserReport(session: SessionDep) -> UserReportResponse:
  rows = session.execute(USER_REPORT_QUERY).mappings().all()
  data = [userReportRowFromMapping(dict(row)) for row in rows]
  return UserReportResponse(data=data, count=len(data))
