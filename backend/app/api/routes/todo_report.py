"""我的待辦報表唯讀 API。"""
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import SQLModel

from app.api.deps import CurrentUser, SessionDep, menu_key_to_path, require_menu


MENU_KEY = 'todo-report'

router = APIRouter(
  prefix=f'/page/{menu_key_to_path(MENU_KEY)}/report',
  tags=['page-todo-report'],
  dependencies=[Depends(require_menu(MENU_KEY))],
)


class TodoReportRow(SQLModel):
  id: str
  content: str
  status: str
  term: str
  due_date: date | None = None
  tags: list[str]
  is_pinned: bool
  sort_order: float
  created_at: datetime | None = None


class TodoReportResponse(SQLModel):
  data: list[TodoReportRow]
  count: int


TODO_REPORT_QUERY = text(
  '''
  SELECT
    CONVERT(varchar(36), id) AS id,
    content,
    status,
    term,
    due_date,
    COALESCE(tags, N'[]') AS tags_json,
    is_pinned,
    sort_order,
    created_at
  FROM dbo.todo
  WHERE owner_id = :owner_id
  ORDER BY is_pinned DESC, sort_order, created_at, id
  '''
)


# 將查詢列轉成報表白名單模型
def todoReportRowFromMapping(row: dict[str, object]) -> TodoReportRow:
  data = dict(row)
  data['tags'] = json.loads(str(data.pop('tags_json')))
  return TodoReportRow.model_validate(data)


# 取得目前登入者自己的待辦報表
@router.get('/', response_model=TodoReportResponse)
def readTodoReport(
  session: SessionDep,
  current_user: CurrentUser,
) -> TodoReportResponse:
  rows = session.execute(
    TODO_REPORT_QUERY,
    {'owner_id': current_user.id},
  ).mappings().all()
  data = [todoReportRowFromMapping(dict(row)) for row in rows]
  return TodoReportResponse(data=data, count=len(data))
