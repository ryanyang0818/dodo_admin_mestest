"""MES 正式區唯讀連線。"""
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import Connection, create_engine, event

from app.core.config import settings

# ponytail: 目前帳號可能是 sa，唯讀靠「路由只執行寫死的 SELECT + bind 參數」保證；
# 換成 db_datareader 帳號後才有資料庫層級的唯讀保護。
mes_engine = (
  create_engine(
    settings.MES_SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    connect_args={'timeout': settings.DB_QUERY_TIMEOUT},
  )
  if settings.MES_SQLALCHEMY_DATABASE_URI
  else None
)

if mes_engine is not None:
  # pyodbc 的 connection.timeout 是每個 SQL 指令的逾時秒數。
  @event.listens_for(mes_engine, 'connect')
  def setMesQueryTimeout(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    dbapi_connection.timeout = settings.DB_QUERY_TIMEOUT


# 取得 MES 連線；未設定時回 503
def getMesConnection() -> Generator[Connection, None, None]:
  if mes_engine is None:
    raise HTTPException(
      status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
      detail='MES 資料庫未設定',
    )
  with mes_engine.connect() as connection:
    yield connection


MesConnectionDep = Annotated[Connection, Depends(getMesConnection)]
