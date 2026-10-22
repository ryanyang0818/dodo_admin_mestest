import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, func, select

from app.api.deps import SessionDep, menu_key_to_path, require_menu
from app.api.routes.dodo_crud import (
    TableCrudConfig,
    delete_by_pk,
    fetch_or_404,
    update_by_pk,
)
from app.models import (
    Menu,
    MenuCreate,
    MenuPublic,
    MenusPublic,
    MenuUpdate,
    Message,
    RoleMenu,
    UserMenuOverride,
)

MENU_KEY = "system.menus"

router = APIRouter(
    prefix=f"/page/{menu_key_to_path(MENU_KEY)}/menus",
    tags=["page-system-menus"],
    dependencies=[Depends(require_menu(MENU_KEY))],
)

MENU_SELECT = """
    id,
    [key] AS [key],
    label,
    path,
    parent_id,
    sort_order,
    icon,
    is_active,
    is_visible,
    access_policy,
    created_at
"""

MENU_UPDATE_COLUMNS = {
    "key": "[key]",
    "label": "label",
    "path": "path",
    "parent_id": "parent_id",
    "sort_order": "sort_order",
    "icon": "icon",
    "is_active": "is_active",
    "is_visible": "is_visible",
    "access_policy": "access_policy",
}


# 將共用 CRUD 查詢結果轉成 Menu 公開模型
def menuFromRow(row: RowMapping) -> MenuPublic:
    return MenuPublic.model_validate(dict(row))


MENU_CRUD = TableCrudConfig(
    table="dbo.menu",
    pk_column="id",
    select_fragment=MENU_SELECT,
    update_columns=MENU_UPDATE_COLUMNS,
    not_found_detail="Menu not found",
    conflict_detail="Menu violates database constraints",
    delete_conflict_detail="Menu is referenced and cannot be deleted",
    modified_column=None,
    from_row=menuFromRow,
)


# 確認 menu key 沒有被其他資料使用
def ensureMenuKeyAvailable(
    session: SessionDep,
    key: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    statement = select(Menu).where(Menu.key == key)
    existing_menu = session.exec(statement).first()

    if existing_menu and existing_menu.id != exclude_id:
        raise HTTPException(status_code=409, detail="Menu key already exists")


# 驗證 parent_id 存在且不會形成循環
def ensureValidParentId(
    session: SessionDep,
    parent_id: uuid.UUID | None,
    current_id: uuid.UUID | None = None,
) -> None:
    if parent_id is None:
        return

    if current_id and parent_id == current_id:
        raise HTTPException(status_code=400, detail="Menu cannot be its own parent")

    parent = session.get(Menu, parent_id)
    if not parent:
        raise HTTPException(status_code=400, detail="Parent menu not found")

    visited_ids: set[uuid.UUID] = set()
    ancestor = parent

    while ancestor.parent_id:
        if ancestor.id in visited_ids:
            raise HTTPException(status_code=400, detail="Menu parent cycle detected")
        visited_ids.add(ancestor.id)

        if current_id and ancestor.parent_id == current_id:
            raise HTTPException(status_code=400, detail="Menu parent cycle detected")

        next_ancestor = session.get(Menu, ancestor.parent_id)
        if not next_ancestor:
            return
        ancestor = next_ancestor


# 確認 menu 沒有其他資料關聯，避免刪除時連帶破壞權限設定
def ensureMenuCanBeDeleted(session: SessionDep, id: uuid.UUID) -> None:
    child_count = session.exec(
        select(func.count()).select_from(Menu).where(Menu.parent_id == id)
    ).one()
    if child_count > 0:
        raise HTTPException(status_code=409, detail="Menu has child menus")

    role_menu_count = session.exec(
        select(func.count()).select_from(RoleMenu).where(RoleMenu.menu_id == id)
    ).one()
    if role_menu_count > 0:
        raise HTTPException(status_code=409, detail="Menu is assigned to roles")

    override_count = session.exec(
        select(func.count())
        .select_from(UserMenuOverride)
        .where(UserMenuOverride.menu_id == id)
    ).one()
    if override_count > 0:
        raise HTTPException(status_code=409, detail="Menu has user overrides")


# 讀取管理用 menu 清單
@router.get("/", response_model=MenusPublic)
def read_menus(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    count_statement = select(func.count()).select_from(Menu)
    count = session.exec(count_statement).one()
    statement = (
        select(Menu).order_by(col(Menu.parent_id), col(Menu.sort_order), col(Menu.key))
        .offset(skip)
        .limit(limit)
    )
    menus = session.exec(statement).all()
    menus_public = [MenuPublic.model_validate(menu) for menu in menus]

    return MenusPublic(data=menus_public, count=count)


# 新增 menu
@router.post("/", response_model=MenuPublic)
def create_menu(*, session: SessionDep, menu_in: MenuCreate) -> Any:
    ensureMenuKeyAvailable(session=session, key=menu_in.key)
    ensureValidParentId(session=session, parent_id=menu_in.parent_id)

    menu = Menu.model_validate(menu_in)
    session.add(menu)
    try:
        session.commit()
        session.refresh(menu)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=MENU_CRUD.conflict_detail)

    return menu


# 讀取單筆 menu
@router.get("/{id}", response_model=MenuPublic)
def read_menu(session: SessionDep, id: uuid.UUID) -> Any:
    return fetch_or_404(session=session, config=MENU_CRUD, pk=id)


# 更新 menu
@router.patch("/{id}", response_model=MenuPublic)
def update_menu(
    *,
    session: SessionDep,
    id: uuid.UUID,
    menu_in: MenuUpdate,
) -> Any:
    fetch_or_404(session=session, config=MENU_CRUD, pk=id)
    update_dict = menu_in.model_dump(exclude_unset=True)

    if "key" in update_dict:
        ensureMenuKeyAvailable(session=session, key=update_dict["key"], exclude_id=id)

    if "parent_id" in update_dict:
        ensureValidParentId(
            session=session,
            parent_id=update_dict["parent_id"],
            current_id=id,
        )

    return update_by_pk(
        session=session,
        config=MENU_CRUD,
        pk=id,
        update_data=update_dict,
    )


# 刪除 menu
@router.delete("/{id}", response_model=Message)
def delete_menu(session: SessionDep, id: uuid.UUID) -> Message:
    fetch_or_404(session=session, config=MENU_CRUD, pk=id)
    ensureMenuCanBeDeleted(session=session, id=id)
    delete_by_pk(session=session, config=MENU_CRUD, pk=id)

    return Message(message="Menu deleted successfully")
