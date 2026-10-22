import uuid

from sqlmodel import Session, col, func, select

from app.models import Item, ItemCreate, ItemUpdate


# 建立 item，並指定擁有者
def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# 以 id 取得單一 item，查無則回傳 None
def get_item(*, session: Session, item_id: uuid.UUID) -> Item | None:
    return session.get(Item, item_id)


# 取得 item 列表與總數；傳入 owner_id 時僅回傳該擁有者的資料
def get_items(
    *,
    session: Session,
    owner_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[Item], int]:
    count_statement = select(func.count()).select_from(Item)
    statement = select(Item).order_by(col(Item.created_at).desc())
    if owner_id is not None:
        count_statement = count_statement.where(Item.owner_id == owner_id)
        statement = statement.where(Item.owner_id == owner_id)
    count = session.exec(count_statement).one()
    items = session.exec(statement.offset(skip).limit(limit)).all()
    return list(items), count


# 更新 item，僅套用有提供的欄位
def update_item(*, session: Session, db_item: Item, item_in: ItemUpdate) -> Item:
    update_dict = item_in.model_dump(exclude_unset=True)
    db_item.sqlmodel_update(update_dict)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# 刪除 item
def delete_item(*, session: Session, db_item: Item) -> None:
    session.delete(db_item)
    session.commit()
