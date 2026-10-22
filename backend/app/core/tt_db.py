"""TIPTOP 唯讀連線：經 MES 測試機的 linked server TOPPROD（Oracle）查詢。"""
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import Connection, create_engine, event

from app.core.config import settings

# ponytail: TIPTOP 只能經 MES 測試機的 OPENQUERY(TOPPROD, ...) 存取；
# 唯讀靠「路由只執行寫死的 SELECT，且 OPENQUERY 字串內的值全部先經白名單驗證」保證。
tt_engine = (
  create_engine(
    settings.MES_TEST_SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    connect_args={'timeout': settings.MES_TEST_DB_QUERY_TIMEOUT},
  )
  if settings.MES_TEST_SQLALCHEMY_DATABASE_URI
  else None
)

if tt_engine is not None:
  # pyodbc 的 connection.timeout 是每個 SQL 指令的逾時秒數。
  @event.listens_for(tt_engine, 'connect')
  def setTtQueryTimeout(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    dbapi_connection.timeout = settings.MES_TEST_DB_QUERY_TIMEOUT


# 取得 TIPTOP 連線；未設定時回 503
def getTtConnection() -> Generator[Connection, None, None]:
  if tt_engine is None:
    raise HTTPException(
      status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
      detail='TIPTOP 連線（MES 測試區）未設定',
    )
  with tt_engine.connect() as connection:
    yield connection


TtConnectionDep = Annotated[Connection, Depends(getTtConnection)]
