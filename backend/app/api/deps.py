from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy import text
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# 建立 menu 權限檢查 dependency
def require_menu(menu_key: str):
    # 驗證目前登入者是否可見指定 menu
    def verify_menu_access(
        session: SessionDep,
        current_user: CurrentUser,
    ) -> User:
        row = session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM dbo.view_user_visible_menu
                WHERE user_id = :user_id
                  AND menu_key = :menu_key
                """
            ),
            {"user_id": current_user.id, "menu_key": menu_key},
        ).first()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The user doesn't have enough menu privileges",
            )

        return current_user

    return verify_menu_access


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


# 將 menu key 轉成 page API namespace path
def menu_key_to_path(menu_key: str) -> str:
    value = menu_key.strip()

    if not value:
        raise ValueError("menu_key cannot be empty")

    if "/" in value:
        raise ValueError('menu_key cannot contain "/"')

    if "_" in value:
        raise ValueError('menu_key cannot contain "_"')

    return value.replace(".", "_")
