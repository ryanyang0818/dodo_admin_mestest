"""Add bulletin board tables.

Revision ID: 0003_bulletin
Revises: 0002_drop_aw
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_bulletin"
down_revision = "0002_drop_aw"
branch_labels = None
depends_on = None


# 建立佈告欄文章與圖片資料表
def upgrade() -> None:
    op.create_table(
        "bulletin_post",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Unicode(200), nullable=False),
        sa.Column("summary", sa.Unicode(500), nullable=True),
        sa.Column("publisher_unit", sa.Unicode(100), nullable=False),
        sa.Column("content_json", sa.JSON(), nullable=False),
        sa.Column("content_text", sa.UnicodeText(), nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default=sa.text("'draft'")
        ),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "pin_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expire_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_bulletin_post_status",
        ),
        sa.CheckConstraint(
            "ISJSON(content_json) = 1", name="ck_bulletin_post_content_json"
        ),
        sa.CheckConstraint("pin_order >= 0", name="ck_bulletin_post_pin_order"),
        sa.CheckConstraint(
            "expire_at IS NULL OR publish_at IS NULL OR expire_at > publish_at",
            name="ck_bulletin_post_publish_window",
        ),
        sa.ForeignKeyConstraint(["author_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_bulletin_post_visibility",
        "bulletin_post",
        ["status", "publish_at", "expire_at"],
    )
    op.create_index(
        "ix_bulletin_post_pinning",
        "bulletin_post",
        ["is_pinned", "pin_order", "publish_at"],
    )
    op.create_index("ix_bulletin_post_updated_at", "bulletin_post", ["updated_at"])

    op.create_table(
        "bulletin_asset",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.Unicode(500), nullable=False),
        sa.Column("original_filename", sa.Unicode(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("alt_text", sa.Unicode(300), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.CheckConstraint("size_bytes >= 0", name="ck_bulletin_asset_size"),
        sa.CheckConstraint(
            "width IS NULL OR width > 0", name="ck_bulletin_asset_width"
        ),
        sa.CheckConstraint(
            "height IS NULL OR height > 0", name="ck_bulletin_asset_height"
        ),
        sa.ForeignKeyConstraint(["post_id"], ["bulletin_post.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_bulletin_asset_storage_key"),
    )
    op.create_index(
        "ix_bulletin_asset_post_created",
        "bulletin_asset",
        ["post_id", "created_at"],
    )


# 依外鍵順序移除佈告欄資料表
def downgrade() -> None:
    op.drop_index("ix_bulletin_asset_post_created", table_name="bulletin_asset")
    op.drop_table("bulletin_asset")
    op.drop_index("ix_bulletin_post_updated_at", table_name="bulletin_post")
    op.drop_index("ix_bulletin_post_pinning", table_name="bulletin_post")
    op.drop_index("ix_bulletin_post_visibility", table_name="bulletin_post")
    op.drop_table("bulletin_post")
