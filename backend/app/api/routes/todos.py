import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, menu_key_to_path, require_menu
from app.models import Message, Todo, TodoCreate, TodoPublic, TodosPublic, TodoUpdate

MENU_KEY = "todos"

router = APIRouter(
    prefix=f"/page/{menu_key_to_path(MENU_KEY)}/todos",
    tags=["page-todos"],
    dependencies=[Depends(require_menu(MENU_KEY))],
)


# 取得 todo，找不到時回傳 404
def getTodoOr404(session: SessionDep, id: uuid.UUID) -> Todo:
    todo = session.get(Todo, id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


# 確認目前使用者可操作這筆 todo：僅擁有者本人可以（Todo 是個人工具，superuser 也不例外）
def ensureTodoAccess(current_user: CurrentUser, todo: Todo) -> None:
    if todo.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")


# 取得 todo 列表；每個人只看得到自己的，superuser 也不例外
# 排序規則：釘選優先，其次依 sort_order 升冪（看板欄內順序）
@router.get("/", response_model=TodosPublic)
def read_todos(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve todos.
    """
    count_statement = select(func.count()).select_from(Todo).where(
        Todo.owner_id == current_user.id
    )
    statement = (
        select(Todo)
        .where(Todo.owner_id == current_user.id)
        .order_by(col(Todo.is_pinned).desc(), col(Todo.sort_order).asc())
    )
    count = session.exec(count_statement).one()
    todos = session.exec(statement.offset(skip).limit(limit)).all()
    todos_public = [TodoPublic.model_validate(todo) for todo in todos]
    return TodosPublic(data=todos_public, count=count)


# 取得單一 todo，含存在性與擁有權檢查
@router.get("/{id}", response_model=TodoPublic)
def read_todo(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get todo by ID.
    """
    todo = getTodoOr404(session=session, id=id)
    ensureTodoAccess(current_user, todo)
    return todo


# 建立新 todo，擁有者為目前登入使用者
@router.post("/", response_model=TodoPublic)
def create_todo(
    *, session: SessionDep, current_user: CurrentUser, todo_in: TodoCreate
) -> Any:
    """
    Create new todo.
    """
    todo = Todo.model_validate(todo_in, update={"owner_id": current_user.id})
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return todo


# 更新 todo（編輯內容、拖曳排序、跨欄移動、釘選共用），含存在性與擁有權檢查
@router.put("/{id}", response_model=TodoPublic)
def update_todo(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    todo_in: TodoUpdate,
) -> Any:
    """
    Update a todo.
    """
    todo = getTodoOr404(session=session, id=id)
    ensureTodoAccess(current_user, todo)
    update_dict = todo_in.model_dump(exclude_unset=True)
    todo.sqlmodel_update(update_dict)
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return todo


# 刪除 todo，含存在性與擁有權檢查
@router.delete("/{id}")
def delete_todo(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete a todo.
    """
    todo = getTodoOr404(session=session, id=id)
    ensureTodoAccess(current_user, todo)
    session.delete(todo)
    session.commit()
    return Message(message="Todo deleted successfully")
