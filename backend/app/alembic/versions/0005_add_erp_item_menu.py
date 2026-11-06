"""Add the item report Workspace entry without changing ERP data."""
from alembic import op

revision = "0005_erp_item_menu"
down_revision = "0004_bulletin_menu"
branch_labels = None
depends_on = None


# 新增根目錄選單；匿名頁與 API 不依賴此登入選單策略。
def upgrade() -> None:
  op.execute("""
    INSERT INTO dbo.menu ([id], [key], label, path, parent_id, sort_order,
      icon, is_active, is_visible, access_policy)
    SELECT NEWID(), 'erp.item-readonly', N'料號基本資料', '/erp/item-readonly',
      NULL, 27, 'TableProperties', 1, 1, 'authenticated'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.menu WHERE [key] = 'erp.item-readonly')
    UPDATE dbo.menu SET is_active = 1, is_visible = 1
    WHERE [key] = 'erp.item-readonly'
  """)


# 降版僅停用入口，保留選單資料；公開端點由部署版本決定。
def downgrade() -> None:
  op.execute("UPDATE dbo.menu SET is_active = 0, is_visible = 0 WHERE [key] = 'erp.item-readonly'")
