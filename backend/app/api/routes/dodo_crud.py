"""Dodo raw SQL table CRUD 共用層。

只收斂「操作模式」：get-or-404 / list 分頁 / update set-clause 組裝 / delete。
業務語意（label 字典、subtype create、delete FK pre-check）一律留在各具體路由檔。
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session


# 每張表一份的 CRUD 設定；table / column 名稱為信任的程式常數，非使用者輸入
@dataclass(frozen=True)
class TableCrudConfig:
    table: str  # schema-qualified 表名，例如 "dbo.aw_production_product"
    pk_column: str  # DB 端 PK 欄位名
    select_fragment: str  # SELECT 欄位片段（含 AS snake_case 別名）
    update_columns: dict[str, str]  # API 欄位 → DB 欄位的 update 白名單
    not_found_detail: str  # 404 訊息
    conflict_detail: str  # create / update 撞 constraint 的 409 訊息
    delete_conflict_detail: Any  # delete 撞 FK 的 409 detail（str 或 dict）
    modified_column: str | None = "modifieddate"  # 更新時間欄位；None 表示不自動補時間
    from_row: Callable[[RowMapping], Any] = field(default=dict)  # row → Public model


# 依 PK 取得單筆，找不到就 404
def fetch_or_404(
    session: Session,
    config: TableCrudConfig,
    pk: int | UUID,
) -> Any:
    row = (
        session.execute(
            text(
                f"""
            SELECT {config.select_fragment}
            FROM {config.table}
            WHERE {config.pk_column} = :pk
            """
            ),
            {"pk": pk},
        )
        .mappings()
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail=config.not_found_detail)
    return config.from_row(row)


# 讀取總筆數與分頁資料列，回傳 (models, count)
def list_page(
    session: Session,
    config: TableCrudConfig,
    skip: int,
    limit: int,
) -> tuple[list[Any], int]:
    count = session.execute(
        text(f"SELECT count(*) FROM {config.table}")
    ).scalar_one()
    rows = (
        session.execute(
            text(
                f"""
            SELECT {config.select_fragment}
            FROM {config.table}
            ORDER BY {config.pk_column}
            OFFSET :skip ROWS
            FETCH NEXT :limit ROWS ONLY
            """
            ),
            {"skip": skip, "limit": limit},
        )
        .mappings()
        .all()
    )

    return [config.from_row(row) for row in rows], count


# 依 update 白名單組 SET 子句並視設定補更新時間；空資料短路回現值，撞 constraint 回 409
def update_by_pk(
    session: Session,
    config: TableCrudConfig,
    pk: int | UUID,
    update_data: dict[str, Any],
) -> Any:
    if not update_data:
        return fetch_or_404(session=session, config=config, pk=pk)

    set_clauses = [
        f"{config.update_columns[key]} = :{key}" for key in update_data.keys()
    ]
    if config.modified_column:
        set_clauses.append(f"{config.modified_column} = SYSUTCDATETIME()")

    try:
        result = session.execute(
            text(
                f"""
            UPDATE {config.table}
            SET {", ".join(set_clauses)}
            WHERE {config.pk_column} = :pk
            """
            ),
            {**update_data, "pk": pk},
        )
        if result.rowcount == 0:
            session.rollback()
            raise HTTPException(status_code=404, detail=config.not_found_detail)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=config.conflict_detail)

    return fetch_or_404(session=session, config=config, pk=pk)


# 依 PK 刪除；被 FK 引用（IntegrityError）時回 409
def delete_by_pk(
    session: Session,
    config: TableCrudConfig,
    pk: int | UUID,
) -> None:
    try:
        session.execute(
            text(f"DELETE FROM {config.table} WHERE {config.pk_column} = :pk"),
            {"pk": pk},
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=config.delete_conflict_detail)
