"""Add the production whiteboard Workspace entry."""

from alembic import op

revision = "0007_production_whiteboard"
down_revision = "0006_erp_wo_menu"
branch_labels = None
depends_on = None

MENU_SQL = """
INSERT INTO dbo.menu ([id], [key], label, path, parent_id, sort_order,
    icon, is_active, is_visible, access_policy)
SELECT NEWID(), 'production.whiteboard', N'生產白板', '/production/whiteboard',
    parent_id, sort_order + 1, 'ClipboardList', 1, 1, 'authenticated'
FROM dbo.menu
WHERE [key] = 'erp.wo-readonly'
    AND NOT EXISTS (
        SELECT 1 FROM dbo.menu WHERE [key] = 'production.whiteboard'
    )
"""


def upgrade() -> None:
    op.execute(MENU_SQL)


def downgrade() -> None:
    op.execute(
        "UPDATE dbo.menu SET is_active = 0, is_visible = 0 "
        "WHERE [key] = 'production.whiteboard'"
    )
