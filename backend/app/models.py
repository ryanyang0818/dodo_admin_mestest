import re
import uuid
from datetime import date, datetime, timezone
from enum import Enum

from pydantic import EmailStr, field_validator
from sqlalchemy import JSON, Column, DateTime, UniqueConstraint, text
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )
    last_login_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    todos: list["Todo"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared role properties
class RoleBase(SQLModel):
    code: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    sort_order: int = 0


# Database model, database table inferred from class name
class Role(RoleBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )


# Shared menu properties
class MenuBase(SQLModel):
    key: str = Field(unique=True, index=True, min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=100)
    path: str | None = Field(default=None, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    icon: str | None = Field(default=None, max_length=100)
    is_active: bool = True
    is_visible: bool = True
    access_policy: str = Field(default="role", max_length=30)

    # 清理並驗證 Menu key 格式
    @field_validator("key")
    @classmethod
    def validateMenuKey(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Menu key cannot be null")
        normalized = value.strip()
        if not re.fullmatch(r"[a-z0-9]+(?:[._-][a-z0-9]+)*", normalized):
            raise ValueError("Menu key has an invalid format")
        return normalized

    # 清理並驗證選單名稱
    @field_validator("label")
    @classmethod
    def validateMenuLabel(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Menu label cannot be null")
        normalized = value.strip()
        if not normalized:
            raise ValueError("Menu label cannot be blank")
        return normalized

    # 清理並驗證選單路徑
    @field_validator("path")
    @classmethod
    def validateMenuPath(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        if normalized and not normalized.startswith("/"):
            raise ValueError("Menu path must start with /")
        return normalized

    # 清理並驗證選單圖示名稱
    @field_validator("icon")
    @classmethod
    def validateMenuIcon(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None

    # 驗證存取策略白名單
    @field_validator("access_policy")
    @classmethod
    def validateMenuAccessPolicy(cls, value: str | None) -> str:
        if value not in {"role", "authenticated"}:
            raise ValueError("Menu access policy is invalid")
        return value

    # 防止部分更新把非 nullable 狀態欄位清成 null
    @field_validator("sort_order", "is_active", "is_visible")
    @classmethod
    def validateMenuRequiredState(cls, value: int | bool | None) -> int | bool:
        if value is None:
            raise ValueError("Menu required state cannot be null")
        return value


# Properties to receive on menu creation
class MenuCreate(MenuBase):
    parent_id: uuid.UUID | None = None


# Properties to receive on menu update
class MenuUpdate(MenuBase):
    key: str | None = Field(default=None, min_length=1, max_length=100)  # type: ignore[assignment]
    label: str | None = Field(default=None, min_length=1, max_length=100)  # type: ignore[assignment]
    path: str | None = Field(default=None, max_length=255)
    parent_id: uuid.UUID | None = None
    sort_order: int | None = Field(default=None, ge=0)
    icon: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None
    is_visible: bool | None = None
    access_policy: str | None = Field(default=None, max_length=30)


# Database model, database table inferred from class name
class Menu(MenuBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    parent_id: uuid.UUID | None = Field(default=None, foreign_key="menu.id")
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )


# Properties to return via API, id is always required
class MenuPublic(MenuBase):
    id: uuid.UUID
    parent_id: uuid.UUID | None = None
    created_at: datetime


class MenusPublic(SQLModel):
    data: list[MenuPublic]
    count: int


class MenuTreeNodePublic(SQLModel):
    id: uuid.UUID
    key: str
    label: str
    path: str | None = None
    icon: str | None = None
    sortOrder: int
    children: list["MenuTreeNodePublic"] = Field(default_factory=list)


# Database model for user and role many-to-many relationship
class UserRole(SQLModel, table=True):
    __tablename__ = "user_role"

    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    role_id: uuid.UUID = Field(foreign_key="role.id", primary_key=True)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )


# Database model for role and menu many-to-many relationship
class RoleMenu(SQLModel, table=True):
    __tablename__ = "role_menu"
    __table_args__ = (
        UniqueConstraint("role_id", "menu_id", name="uq_role_menu_role_id_menu_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    role_id: uuid.UUID = Field(foreign_key="role.id")
    menu_id: uuid.UUID = Field(foreign_key="menu.id")
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("SYSUTCDATETIME()"),
        ),
    )


# Database model for user-specific menu allow or deny overrides
class UserMenuOverride(SQLModel, table=True):
    __tablename__ = "user_menu_override"

    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    menu_id: uuid.UUID = Field(foreign_key="menu.id", primary_key=True)
    effect: str = Field(max_length=10)
    reason: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("CURRENT_TIMESTAMP"),
        ),
    )


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore[assignment]


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# 待辦任務的期限類別（與狀態互相獨立的第二維度）
class TodoTerm(str, Enum):
    long_term = "long_term"
    mid_term = "mid_term"
    short_term = "short_term"
    tomorrow = "tomorrow"
    uncategorized = "uncategorized"


# 待辦任務的看板狀態（Kanban 欄位維度）
class TodoStatus(str, Enum):
    todo = "todo"
    doing = "doing"
    done = "done"


# Shared todo properties
class TodoBase(SQLModel):
    content: str = Field(min_length=1, max_length=2000)
    term: TodoTerm = Field(default=TodoTerm.uncategorized)
    status: TodoStatus = Field(default=TodoStatus.todo)
    due_date: date | None = Field(default=None)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_pinned: bool = Field(default=False)
    sort_order: float = Field(default=0)


# Properties to receive on todo creation
class TodoCreate(TodoBase):
    pass


# Properties to receive on todo update, all are optional
class TodoUpdate(SQLModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    term: TodoTerm | None = Field(default=None)
    status: TodoStatus | None = Field(default=None)
    due_date: date | None = Field(default=None)
    tags: list[str] | None = Field(default=None)
    is_pinned: bool | None = Field(default=None)
    sort_order: float | None = Field(default=None)


# Database model, database table inferred from class name
class Todo(TodoBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="todos")


# Properties to return via API, id is always required
class TodoPublic(TodoBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class TodosPublic(SQLModel):
    data: list[TodoPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
