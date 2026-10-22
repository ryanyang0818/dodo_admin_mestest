from sqlalchemy import event
from sqlmodel import Session, col, create_engine, select

from app import crud
from app.core.config import settings
from app.models import User, UserCreate

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    connect_args={"timeout": settings.DB_QUERY_TIMEOUT},
)


# pyodbc 的 connection.timeout 是每個 SQL 指令的逾時秒數。
@event.listens_for(engine, "connect")
def set_query_timeout(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    dbapi_connection.timeout = settings.DB_QUERY_TIMEOUT


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


# 確保資料庫至少存在一位超級管理員
def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    superuser = session.exec(select(User).where(col(User.is_superuser))).first()
    if not superuser:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        crud.create_user(session=session, user_create=user_in)
