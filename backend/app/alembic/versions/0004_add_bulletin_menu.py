"""Add bulletin board menu entry.

Revision ID: 0004_bulletin_menu
Revises: 0003_bulletin
"""

from alembic import op

revision = "0004_bulletin_menu"
down_revision = "0003_bulletin"
branch_labels = None
depends_on = None


# 將佈告欄管理加入所有登入使用者可見的 Workspace 選單
def upgrade() -> None:
    op.execute(
        """
        IF EXISTS (SELECT 1 FROM dbo.menu WHERE [key] = 'bulletins')
        BEGIN
          UPDATE dbo.menu
          SET label = N'佈告欄管理',
              path = '/bulletins',
              parent_id = NULL,
              sort_order = 26,
              icon = 'Megaphone',
              access_policy = 'authenticated',
              is_active = 1,
              is_visible = 1
          WHERE [key] = 'bulletins';
        END
        ELSE
        BEGIN
          INSERT INTO dbo.menu (
            [key], label, path, parent_id, sort_order, icon,
            access_policy, is_active, is_visible
          )
          VALUES (
            'bulletins', N'佈告欄管理', '/bulletins', NULL, 26, 'Megaphone',
            'authenticated', 1, 1
          );
        END
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM dbo.menu WHERE [key] = 'bulletins'")
