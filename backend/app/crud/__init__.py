"""CRUD 操作層：依資源拆分檔案，於此集中 re-export 以維持 `from app import crud` 相容。"""

from app.crud.item import (
    create_item,
    delete_item,
    get_item,
    get_items,
    update_item,
)
from app.crud.user import (
    DUMMY_HASH,
    authenticate,
    create_user,
    get_user_by_email,
    update_user,
)

__all__ = [
    "DUMMY_HASH",
    "authenticate",
    "create_item",
    "create_user",
    "delete_item",
    "get_item",
    "get_items",
    "get_user_by_email",
    "update_item",
    "update_user",
]
