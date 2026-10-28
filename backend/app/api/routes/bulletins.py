import json
import re
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    BulletinAsset,
    BulletinAssetPublic,
    BulletinPost,
    BulletinPostCreate,
    BulletinPostPublic,
    BulletinPostsPublic,
    BulletinPostUpdate,
    BulletinStatus,
    User,
    get_datetime_utc,
)

router = APIRouter(prefix="/bulletins", tags=["bulletins"])
public_router = APIRouter(prefix="/public", tags=["public-bulletins"])

ALLOWED_NODE_TYPES = {
    "doc",
    "paragraph",
    "text",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "hardBreak",
    "image",
}
ALLOWED_MARK_TYPES = {"bold", "italic", "underline", "strike", "code", "link"}
IMAGE_URL_PATTERN = re.compile(
    r"^/api/v1/public/bulletin-assets/([0-9a-fA-F-]{36})/content$"
)
IMAGE_TYPES: dict[str, tuple[str, Callable[[bytes], bool]]] = {
    "image/jpeg": ("jpg", lambda value: value.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda value: value.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        "webp",
        lambda value: len(value) >= 12
        and value.startswith(b"RIFF")
        and value[8:12] == b"WEBP",
    ),
}


# 取得後端管理的圖片根目錄
def getUploadRoot() -> Path:
    configured = Path(settings.BULLETIN_UPLOAD_DIR)
    if configured.is_absolute():
        return configured.resolve()
    backend_root = Path(__file__).resolve().parents[3]
    return (backend_root / configured).resolve()


# 驗證並整理 Tiptap JSON，同時擷取純文字及引用的圖片 ID
def validateContent(
    content: dict[str, Any],
) -> tuple[dict[str, Any], str, set[uuid.UUID]]:
    if not isinstance(content, dict) or content.get("type") != "doc":
        raise HTTPException(status_code=422, detail="內文格式不正確")
    if len(json.dumps(content, ensure_ascii=False)) > 1_000_000:
        raise HTTPException(status_code=413, detail="內文資料過大")

    text_parts: list[str] = []
    asset_ids: set[uuid.UUID] = set()

    # 遞迴驗證編輯器節點白名單
    def visit(node: object) -> None:
        if not isinstance(node, dict):
            raise HTTPException(status_code=422, detail="內文節點格式不正確")
        node_type = node.get("type")
        if node_type not in ALLOWED_NODE_TYPES:
            raise HTTPException(
                status_code=422, detail=f"不支援的內文節點：{node_type}"
            )

        marks = node.get("marks", [])
        if not isinstance(marks, list):
            raise HTTPException(status_code=422, detail="內文格式標記不正確")
        for mark in marks:
            if not isinstance(mark, dict) or mark.get("type") not in ALLOWED_MARK_TYPES:
                raise HTTPException(status_code=422, detail="內文包含不支援的格式")
            if mark.get("type") == "link":
                href = str(mark.get("attrs", {}).get("href", ""))
                if not href.startswith(("https://", "http://", "mailto:")):
                    raise HTTPException(status_code=422, detail="連結格式不正確")

        if node_type == "text":
            value = node.get("text")
            if not isinstance(value, str):
                raise HTTPException(status_code=422, detail="文字節點格式不正確")
            text_parts.append(value)
        elif node_type in {"paragraph", "heading", "listItem"}:
            text_parts.append("\n")
        elif node_type == "image":
            attrs = node.get("attrs")
            if not isinstance(attrs, dict):
                raise HTTPException(status_code=422, detail="圖片節點格式不正確")
            asset_id_value = attrs.get("assetId")
            src = attrs.get("src")
            try:
                asset_id = uuid.UUID(str(asset_id_value))
            except (TypeError, ValueError, AttributeError):
                raise HTTPException(status_code=422, detail="圖片缺少有效的 assetId")
            match = IMAGE_URL_PATTERN.fullmatch(str(src))
            if not match or uuid.UUID(match.group(1)) != asset_id:
                raise HTTPException(
                    status_code=422, detail="圖片 URL 與 assetId 不一致"
                )
            asset_ids.add(asset_id)

        children = node.get("content", [])
        if not isinstance(children, list):
            raise HTTPException(status_code=422, detail="內文子節點格式不正確")
        for child in children:
            visit(child)

    visit(content)
    content_text = " ".join("".join(text_parts).split())
    return content, content_text, asset_ids


# 驗證文章欄位與發布時間範圍
def normalizePostValues(values: dict[str, Any]) -> dict[str, Any]:
    values["title"] = str(values.get("title", "")).strip()
    values["publisher_unit"] = str(values.get("publisher_unit", "")).strip()
    summary = values.get("summary")
    values["summary"] = str(summary).strip() if summary else None
    if not values["title"]:
        raise HTTPException(status_code=422, detail="標題必填")
    if not values["publisher_unit"]:
        raise HTTPException(status_code=422, detail="發布單位必填")

    status_value = values.get("status")
    if status_value == BulletinStatus.published and values.get("publish_at") is None:
        values["publish_at"] = get_datetime_utc()
    publish_at = values.get("publish_at")
    expire_at = values.get("expire_at")
    if publish_at and expire_at and expire_at <= publish_at:
        raise HTTPException(status_code=422, detail="到期時間必須晚於發布時間")
    return values


# 確認文章引用的圖片都屬於同一篇文章
def ensureAssetsBelongToPost(
    session: SessionDep, post_id: uuid.UUID, asset_ids: set[uuid.UUID]
) -> None:
    if not asset_ids:
        return
    rows = session.exec(
        select(BulletinAsset.id).where(
            BulletinAsset.post_id == post_id,
            col(BulletinAsset.id).in_(asset_ids),
        )
    ).all()
    if set(rows) != asset_ids:
        raise HTTPException(status_code=422, detail="內文引用了不屬於本文章的圖片")


# 將資料庫文章與作者名稱轉為 API schema
def toPublicPost(
    post: BulletinPost, full_name: str | None, email: str
) -> BulletinPostPublic:
    return BulletinPostPublic.model_validate(
        {
            **post.model_dump(),
            "author_name": full_name.strip()
            if full_name and full_name.strip()
            else email,
        }
    )


# 建立附作者名稱的文章查詢
def postSelect() -> Any:
    return select(BulletinPost, User.full_name, User.email).join(
        User, col(BulletinPost.author_id) == col(User.id)
    )


# 取得管理用文章列表
@router.get("/", response_model=BulletinPostsPublic)
def readBulletins(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
    keyword: str | None = None,
    status: BulletinStatus | None = None,
    is_pinned: bool | None = None,
) -> BulletinPostsPublic:
    del current_user
    limit = min(max(limit, 1), 200)
    conditions: list[Any] = []
    if keyword and keyword.strip():
        value = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                col(BulletinPost.title).like(value),
                col(BulletinPost.publisher_unit).like(value),
                col(BulletinPost.content_text).like(value),
            )
        )
    if status is not None:
        conditions.append(col(BulletinPost.status) == status)
    if is_pinned is not None:
        conditions.append(col(BulletinPost.is_pinned) == is_pinned)

    count_statement = select(func.count()).select_from(BulletinPost)
    statement = postSelect().order_by(col(BulletinPost.updated_at).desc())
    for condition in conditions:
        count_statement = count_statement.where(condition)
        statement = statement.where(condition)

    count = session.exec(count_statement).one()
    rows = session.exec(statement.offset(max(skip, 0)).limit(limit)).all()
    return BulletinPostsPublic(
        data=[toPublicPost(post, full_name, email) for post, full_name, email in rows],
        count=count,
    )


# 取得管理用單篇文章
@router.get("/{id}", response_model=BulletinPostPublic)
def readBulletin(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> BulletinPostPublic:
    del current_user
    row = session.exec(postSelect().where(BulletinPost.id == id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在")
    post, full_name, email = row
    return toPublicPost(post, full_name, email)


# 建立文章草稿或直接排程發布
@router.post("/", response_model=BulletinPostPublic)
def createBulletin(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    bulletin_in: BulletinPostCreate,
) -> BulletinPostPublic:
    content_json, content_text, asset_ids = validateContent(bulletin_in.content_json)
    if asset_ids:
        raise HTTPException(status_code=422, detail="新文章尚不能引用既有圖片")
    values = normalizePostValues(bulletin_in.model_dump())
    if (
        values["status"] == BulletinStatus.published
        and not content_text
        and not asset_ids
    ):
        raise HTTPException(status_code=422, detail="發布前必須填寫內文")
    post = BulletinPost.model_validate(
        values,
        update={
            "content_json": content_json,
            "content_text": content_text,
            "author_id": current_user.id,
            "updated_by": current_user.id,
        },
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return toPublicPost(post, current_user.full_name, current_user.email)


# 更新文章內容及發布狀態
@router.patch("/{id}", response_model=BulletinPostPublic)
def updateBulletin(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    bulletin_in: BulletinPostUpdate,
) -> BulletinPostPublic:
    post = session.get(BulletinPost, id)
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    patch_values = bulletin_in.model_dump(exclude_unset=True)
    final_values = post.model_dump()
    final_values.update(patch_values)
    final_values = normalizePostValues(final_values)
    content_json, content_text, asset_ids = validateContent(
        final_values["content_json"]
    )
    ensureAssetsBelongToPost(session, post.id, asset_ids)
    if (
        final_values["status"] == BulletinStatus.published
        and not content_text
        and not asset_ids
    ):
        raise HTTPException(status_code=422, detail="發布前必須填寫內文")

    update_values = {
        key: final_values[key]
        for key in patch_values
        if key in final_values and key != "content_json"
    }
    if "content_json" in patch_values:
        update_values["content_json"] = content_json
        update_values["content_text"] = content_text
    if (
        final_values.get("status") == BulletinStatus.published
        and post.publish_at is None
    ):
        update_values["publish_at"] = final_values["publish_at"]
    update_values["updated_by"] = current_user.id
    update_values["updated_at"] = get_datetime_utc()
    post.sqlmodel_update(update_values)
    session.add(post)
    session.commit()
    session.refresh(post)

    author = session.get(User, post.author_id)
    if not author:
        raise HTTPException(status_code=500, detail="文章建立者不存在")
    return toPublicPost(post, author.full_name, author.email)


# 上傳文章內嵌圖片
@router.post("/{id}/assets", response_model=BulletinAssetPublic)
async def uploadBulletinAsset(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    file: UploadFile = File(...),
) -> BulletinAssetPublic:
    if not session.get(BulletinPost, id):
        raise HTTPException(status_code=404, detail="文章不存在")
    content = await file.read(settings.BULLETIN_MAX_IMAGE_BYTES + 1)
    if len(content) > settings.BULLETIN_MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="圖片大小不得超過 5 MB")
    if not content:
        raise HTTPException(status_code=422, detail="圖片內容為空")

    detected: tuple[str, str] | None = None
    for mime_type, (extension, matcher) in IMAGE_TYPES.items():
        if matcher(content):
            detected = (mime_type, extension)
            break
    if not detected or file.content_type != detected[0]:
        raise HTTPException(status_code=422, detail="只接受 JPEG、PNG、WebP 圖片")

    asset_id = uuid.uuid4()
    storage_key = f"{id}/{asset_id}.{detected[1]}"
    upload_root = getUploadRoot()
    target_path = (upload_root / storage_key).resolve()
    if upload_root not in target_path.parents:
        raise HTTPException(status_code=422, detail="圖片儲存路徑不正確")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)

    asset = BulletinAsset(
        id=asset_id,
        post_id=id,
        storage_key=storage_key,
        original_filename=Path(file.filename or "image").name[:255],
        mime_type=detected[0],
        size_bytes=len(content),
        created_by=current_user.id,
    )
    try:
        session.add(asset)
        session.commit()
        session.refresh(asset)
    except Exception:
        session.rollback()
        target_path.unlink(missing_ok=True)
        raise

    return BulletinAssetPublic(
        id=asset.id,
        post_id=asset.post_id,
        url=f"/api/v1/public/bulletin-assets/{asset.id}/content",
        original_filename=asset.original_filename,
        mime_type=asset.mime_type,
        size_bytes=asset.size_bytes,
        width=asset.width,
        height=asset.height,
        alt_text=asset.alt_text,
    )


# 取得登入頁公開文章列表
@public_router.get("/bulletins", response_model=BulletinPostsPublic)
def readPublicBulletins(
    session: SessionDep,
    skip: int = 0,
    limit: int = 10,
    keyword: str | None = None,
) -> BulletinPostsPublic:
    now = datetime.now(timezone.utc)
    conditions = [
        col(BulletinPost.status) == BulletinStatus.published,
        col(BulletinPost.publish_at).is_not(None),
        col(BulletinPost.publish_at) <= now,
        or_(col(BulletinPost.expire_at).is_(None), col(BulletinPost.expire_at) > now),
    ]
    if keyword and keyword.strip():
        value = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                col(BulletinPost.title).like(value),
                col(BulletinPost.publisher_unit).like(value),
                col(BulletinPost.content_text).like(value),
            )
        )

    count_statement = select(func.count()).select_from(BulletinPost).where(*conditions)
    statement = (
        postSelect()
        .where(*conditions)
        .order_by(
            col(BulletinPost.is_pinned).desc(),
            col(BulletinPost.pin_order).asc(),
            col(BulletinPost.publish_at).desc(),
        )
    )
    count = session.exec(count_statement).one()
    rows = session.exec(
        statement.offset(max(skip, 0)).limit(min(max(limit, 1), 50))
    ).all()
    return BulletinPostsPublic(
        data=[toPublicPost(post, full_name, email) for post, full_name, email in rows],
        count=count,
    )


# 取得登入頁公開單篇文章
@public_router.get("/bulletins/{id}", response_model=BulletinPostPublic)
def readPublicBulletin(session: SessionDep, id: uuid.UUID) -> BulletinPostPublic:
    now = datetime.now(timezone.utc)
    row = session.exec(
        postSelect().where(
            BulletinPost.id == id,
            col(BulletinPost.status) == BulletinStatus.published,
            col(BulletinPost.publish_at).is_not(None),
            col(BulletinPost.publish_at) <= now,
            or_(
                col(BulletinPost.expire_at).is_(None), col(BulletinPost.expire_at) > now
            ),
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在或已下架")
    post, full_name, email = row
    return toPublicPost(post, full_name, email)


# 以穩定公開 URL 傳回文章圖片
@public_router.get("/bulletin-assets/{id}/content", response_class=FileResponse)
def readPublicBulletinAsset(session: SessionDep, id: uuid.UUID) -> FileResponse:
    asset = session.get(BulletinAsset, id)
    if not asset:
        raise HTTPException(status_code=404, detail="圖片不存在")
    upload_root = getUploadRoot()
    file_path = (upload_root / asset.storage_key).resolve()
    if upload_root not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail="圖片檔案不存在")
    return FileResponse(
        path=file_path,
        media_type=asset.mime_type,
        filename=asset.original_filename,
        content_disposition_type="inline",
        headers={"Cache-Control": "public, max-age=86400"},
    )
