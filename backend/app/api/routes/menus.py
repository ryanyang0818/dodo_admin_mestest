from collections.abc import Sequence
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.engine import RowMapping

from app.api.deps import CurrentUser, SessionDep
from app.models import MenuTreeNodePublic

router = APIRouter(prefix="/menus", tags=["menus"])


# 讀取目前登入者可見的樹狀選單
@router.get("/tree", response_model=list[MenuTreeNodePublic])
def readMyMenuTree(
    session: SessionDep,
    current_user: CurrentUser,
) -> list[MenuTreeNodePublic]:
    rows = session.execute(
        text(
            """
            SELECT
              v.menu_id,
              v.menu_key,
              v.menu_label,
              v.menu_path,
              v.menu_sort_order,
              m.parent_id,
              m.icon
            FROM dbo.view_user_visible_menu v
            JOIN dbo.menu m ON m.id = v.menu_id
            WHERE v.user_id = :user_id
            ORDER BY
              v.root_sort_order,
              v.menu_sort_order,
              v.menu_key
            """
        ),
        {"user_id": current_user.id},
    ).mappings()

    return buildMenuTree(list(rows))


# 將平面選單資料組成階層結構
def buildMenuTree(rows: Sequence[RowMapping]) -> list[MenuTreeNodePublic]:
    nodes: dict[Any, MenuTreeNodePublic] = {}
    parent_ids: dict[Any, Any] = {}

    for row in rows:
        menu_id = row["menu_id"]
        nodes[menu_id] = MenuTreeNodePublic(
            id=menu_id,
            key=row["menu_key"],
            label=row["menu_label"],
            path=row["menu_path"],
            icon=row["icon"],
            sortOrder=row["menu_sort_order"],
        )
        parent_ids[menu_id] = row["parent_id"]

    roots: list[MenuTreeNodePublic] = []

    for menu_id, node in nodes.items():
        parent_id = parent_ids[menu_id]
        parent = nodes.get(parent_id)

        if parent:
            parent.children.append(node)
        else:
            roots.append(node)

    return roots
