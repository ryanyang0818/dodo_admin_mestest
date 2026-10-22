"""Drop AdventureWorks (aw_*) tables.

Revision ID: 0002_drop_aw
Revises: 0001_sqlserver
"""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic import op


revision = "0002_drop_aw"
down_revision = "0001_sqlserver"
branch_labels = None
depends_on = None


# 依外鍵相依順序排列：子表在前、父表在後（與 baseline downgrade 相同）
AW_TABLES = (
  "aw_production_productinventory",
  "aw_production_location",
  "aw_purchasing_purchaseorderheader",
  "aw_purchasing_productvendor",
  "aw_purchasing_vendor",
  "aw_production_product",
  "aw_production_productsubcategory",
  "aw_purchasing_shipmethod",
  "aw_production_unitmeasure",
  "aw_humanresources_employee",
  "aw_person_businessentity",
)


# 移除 aw_* 表；表不存在時略過，避免重跑出錯
# 注意：資料會一併消失，downgrade 只能還原結構，無法還原資料
def upgrade() -> None:
  inspector = sa.inspect(op.get_bind())

  for table_name in AW_TABLES:
    if inspector.has_table(table_name):
      op.drop_table(table_name)


# 重用 baseline 的建表函式還原「空」的 aw_* 結構
def downgrade() -> None:
  baseline_path = Path(__file__).with_name("0001_sqlserver_initial_baseline.py")
  spec = importlib.util.spec_from_file_location("baseline_0001", baseline_path)
  assert spec and spec.loader
  baseline = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(baseline)
  baseline.create_adventureworks_tables()
