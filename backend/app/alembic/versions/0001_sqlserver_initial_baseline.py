"""SQL Server initial baseline.

Revision ID: 0001_sqlserver
Revises:
"""

import sqlalchemy as sa
from alembic import op


revision = "0001_sqlserver"
down_revision = None
branch_labels = None
depends_on = None


CORE_VIEWS = (
  """
  CREATE VIEW dbo.view_user_role AS
  SELECT
    ur.user_id,
    u.email,
    u.full_name,
    ur.role_id,
    r.code AS role_code,
    r.name AS role_name,
    ur.created_at AS assigned_at
  FROM dbo.user_role ur
  JOIN dbo.[user] u ON u.id = ur.user_id
  JOIN dbo.[role] r ON r.id = ur.role_id
  """,
  """
  CREATE VIEW dbo.view_user_roles_summary AS
  SELECT
    u.id AS user_id,
    u.email,
    u.full_name,
    STRING_AGG(CAST(r.code AS nvarchar(max)), ', ')
      WITHIN GROUP (ORDER BY r.sort_order, r.code) AS role_codes,
    STRING_AGG(CAST(r.name AS nvarchar(max)), ', ')
      WITHIN GROUP (ORDER BY r.sort_order, r.code) AS role_names
  FROM dbo.[user] u
  LEFT JOIN dbo.user_role ur ON ur.user_id = u.id
  LEFT JOIN dbo.[role] r ON r.id = ur.role_id
  GROUP BY u.id, u.email, u.full_name
  """,
  """
  CREATE VIEW dbo.view_role_menu AS
  SELECT
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    m.id AS menu_id,
    m.[key] AS menu_key,
    m.label AS menu_label,
    m.path AS menu_path,
    parent.[key] AS parent_menu_key,
    parent.label AS parent_menu_label,
    m.sort_order AS menu_sort_order,
    rm.created_at AS assigned_at,
    rm.id AS role_menu_id
  FROM dbo.[role] r
  JOIN dbo.role_menu rm ON rm.role_id = r.id
  JOIN dbo.menu m ON m.id = rm.menu_id
  LEFT JOIN dbo.menu parent ON parent.id = m.parent_id
  """,
  """
  CREATE VIEW dbo.view_role_menus_summary AS
  SELECT
    r.id AS role_id,
    r.code AS role_code,
    r.name AS role_name,
    STRING_AGG(CAST(m.[key] AS nvarchar(max)), ', ')
      WITHIN GROUP (ORDER BY m.[key]) AS menu_keys,
    STRING_AGG(CAST(m.label AS nvarchar(max)), ', ')
      WITHIN GROUP (ORDER BY m.[key]) AS menu_labels
  FROM dbo.[role] r
  LEFT JOIN dbo.role_menu rm ON rm.role_id = r.id
  LEFT JOIN dbo.menu m ON m.id = rm.menu_id
  GROUP BY r.id, r.code, r.name
  """,
  """
  CREATE VIEW dbo.view_user_menu_override AS
  SELECT
    u.id AS user_id,
    u.email,
    u.full_name,
    m.id AS menu_id,
    m.[key] AS menu_key,
    m.label AS menu_label,
    parent.[key] AS parent_menu_key,
    parent.label AS parent_menu_label,
    umo.effect,
    umo.reason,
    umo.created_at AS assigned_at
  FROM dbo.user_menu_override umo
  JOIN dbo.[user] u ON u.id = umo.user_id
  JOIN dbo.menu m ON m.id = umo.menu_id
  LEFT JOIN dbo.menu parent ON parent.id = m.parent_id
  """,
  """
  CREATE VIEW dbo.view_user_visible_menu AS
  WITH role_visible_menu AS (
    SELECT DISTINCT u.id AS user_id, m.id AS menu_id
    FROM dbo.[user] u
    JOIN dbo.user_role ur ON ur.user_id = u.id
    JOIN dbo.role_menu rm ON rm.role_id = ur.role_id
    JOIN dbo.[role] r ON r.id = ur.role_id
    JOIN dbo.menu m ON m.id = rm.menu_id
    WHERE u.is_active = 1
      AND r.is_active = 1
      AND m.is_active = 1
      AND m.is_visible = 1
      AND m.access_policy = 'role'
  ),
  authenticated_menu AS (
    SELECT DISTINCT u.id AS user_id, m.id AS menu_id
    FROM dbo.[user] u
    CROSS JOIN dbo.menu m
    WHERE u.is_active = 1
      AND m.is_active = 1
      AND m.is_visible = 1
      AND m.access_policy = 'authenticated'
  ),
  user_allow_menu AS (
    SELECT DISTINCT umo.user_id, umo.menu_id
    FROM dbo.user_menu_override umo
    JOIN dbo.menu m ON m.id = umo.menu_id
    WHERE umo.effect = 'allow'
      AND m.is_active = 1
      AND m.is_visible = 1
  ),
  candidate_menu AS (
    SELECT user_id, menu_id FROM role_visible_menu
    UNION
    SELECT user_id, menu_id FROM authenticated_menu
    UNION
    SELECT user_id, menu_id FROM user_allow_menu
  )
  SELECT
    u.id AS user_id,
    u.email,
    u.full_name,
    m.id AS menu_id,
    m.[key] AS menu_key,
    m.label AS menu_label,
    m.path AS menu_path,
    parent.[key] AS parent_menu_key,
    parent.label AS parent_menu_label,
    COALESCE(parent.sort_order, m.sort_order) AS root_sort_order,
    m.sort_order AS menu_sort_order
  FROM candidate_menu candidate
  JOIN dbo.[user] u ON u.id = candidate.user_id
  JOIN dbo.menu m ON m.id = candidate.menu_id
  LEFT JOIN dbo.menu parent ON parent.id = m.parent_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.user_menu_override denied_override
    WHERE denied_override.user_id = candidate.user_id
      AND denied_override.menu_id = candidate.menu_id
      AND denied_override.effect = 'deny'
  )
  """,
)


# 建立 SQL Server 核心資料表
def create_core_tables() -> None:
  op.create_table(
    "user",
    sa.Column("email", sa.String(255), nullable=False),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column("full_name", sa.String(255), nullable=True),
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("hashed_password", sa.String(255), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_user_email", "user", ["email"], unique=True)

  op.create_table(
    "role",
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("code", sa.String(100), nullable=False),
    sa.Column("name", sa.String(100), nullable=False),
    sa.Column("description", sa.String(255), nullable=True),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_role_code", "role", ["code"], unique=True)

  op.create_table(
    "menu",
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("key", sa.String(100), nullable=False),
    sa.Column("label", sa.String(100), nullable=False),
    sa.Column("path", sa.String(255), nullable=True),
    sa.Column("parent_id", sa.Uuid(), nullable=True),
    sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    sa.Column("icon", sa.String(100), nullable=True),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("access_policy", sa.String(30), nullable=False, server_default=sa.text("'role'")),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.CheckConstraint("access_policy IN ('role', 'authenticated')", name="ck_menu_access_policy"),
    sa.ForeignKeyConstraint(["parent_id"], ["menu.id"]),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_menu_key", "menu", ["key"], unique=True)
  op.create_index("ix_menu_parent_id", "menu", ["parent_id"])
  op.create_index("ix_menu_sort_order", "menu", ["sort_order"])

  op.create_table(
    "item",
    sa.Column("title", sa.String(255), nullable=False),
    sa.Column("description", sa.String(255), nullable=True),
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("SYSUTCDATETIME()")),
    sa.Column("owner_id", sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
  )

  op.create_table(
    "todo",
    sa.Column("content", sa.String(2000), nullable=False),
    sa.Column("term", sa.String(30), nullable=False, server_default=sa.text("'uncategorized'")),
    sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'todo'")),
    sa.Column("due_date", sa.Date(), nullable=True),
    sa.Column("tags", sa.JSON(), nullable=True),
    sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.Column("sort_order", sa.Float(), nullable=False, server_default=sa.text("0")),
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("SYSUTCDATETIME()")),
    sa.Column("owner_id", sa.Uuid(), nullable=False),
    sa.CheckConstraint("term IN ('long_term', 'mid_term', 'short_term', 'tomorrow', 'uncategorized')", name="ck_todo_term"),
    sa.CheckConstraint("status IN ('todo', 'doing', 'done')", name="ck_todo_status"),
    sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
  )

  op.create_table(
    "user_role",
    sa.Column("user_id", sa.Uuid(), nullable=False),
    sa.Column("role_id", sa.Uuid(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.ForeignKeyConstraint(["role_id"], ["role.id"]),
    sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
    sa.PrimaryKeyConstraint("user_id", "role_id"),
  )
  op.create_index("ix_user_role_role_id", "user_role", ["role_id"])
  op.create_index("ix_user_role_user_id", "user_role", ["user_id"])

  op.create_table(
    "role_menu",
    sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("NEWID()")),
    sa.Column("role_id", sa.Uuid(), nullable=False),
    sa.Column("menu_id", sa.Uuid(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.ForeignKeyConstraint(["menu_id"], ["menu.id"]),
    sa.ForeignKeyConstraint(["role_id"], ["role.id"]),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("role_id", "menu_id", name="uq_role_menu_role_id_menu_id"),
  )
  op.create_index("ix_role_menu_menu_id", "role_menu", ["menu_id"])
  op.create_index("ix_role_menu_role_id", "role_menu", ["role_id"])

  op.create_table(
    "user_menu_override",
    sa.Column("user_id", sa.Uuid(), nullable=False),
    sa.Column("menu_id", sa.Uuid(), nullable=False),
    sa.Column("effect", sa.String(10), nullable=False),
    sa.Column("reason", sa.String(255), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("SYSUTCDATETIME()")),
    sa.CheckConstraint("effect IN ('allow', 'deny')", name="ck_user_menu_override_effect"),
    sa.ForeignKeyConstraint(["menu_id"], ["menu.id"]),
    sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
    sa.PrimaryKeyConstraint("user_id", "menu_id"),
  )
  op.create_index("ix_user_menu_override_menu_id", "user_menu_override", ["menu_id"])
  op.create_index("ix_user_menu_override_user_id", "user_menu_override", ["user_id"])


# 建立頁面需要的 AdventureWorks 替代表
def create_adventureworks_tables() -> None:
  utc_now = sa.text("SYSUTCDATETIME()")
  new_id = sa.text("NEWID()")

  op.create_table(
    "aw_person_businessentity",
    sa.Column("businessentityid", sa.Integer(), sa.Identity(), nullable=False),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.PrimaryKeyConstraint("businessentityid", name="pk_aw_person_businessentity"),
  )
  op.create_table(
    "aw_humanresources_employee",
    sa.Column("businessentityid", sa.Integer(), nullable=False),
    sa.Column("nationalidnumber", sa.String(15), nullable=False),
    sa.Column("loginid", sa.String(256), nullable=False),
    sa.Column("jobtitle", sa.String(50), nullable=False),
    sa.Column("birthdate", sa.Date(), nullable=False),
    sa.Column("maritalstatus", sa.String(1), nullable=False),
    sa.Column("gender", sa.String(1), nullable=False),
    sa.Column("hiredate", sa.Date(), nullable=False),
    sa.Column("salariedflag", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("vacationhours", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
    sa.Column("sickleavehours", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
    sa.Column("currentflag", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.Column("organizationnode", sa.String(255), nullable=True, server_default=sa.text("'/'")),
    sa.CheckConstraint("UPPER(gender) IN ('M', 'F')", name="ck_aw_employee_gender"),
    sa.CheckConstraint("UPPER(maritalstatus) IN ('M', 'S')", name="ck_aw_employee_maritalstatus"),
    sa.CheckConstraint("sickleavehours BETWEEN 0 AND 120", name="ck_aw_employee_sickleavehours"),
    sa.CheckConstraint("vacationhours BETWEEN -40 AND 240", name="ck_aw_employee_vacationhours"),
    sa.PrimaryKeyConstraint("businessentityid", name="pk_aw_humanresources_employee"),
  )
  op.create_table(
    "aw_production_unitmeasure",
    sa.Column("unitmeasurecode", sa.CHAR(3), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.PrimaryKeyConstraint("unitmeasurecode", name="pk_aw_production_unitmeasure"),
  )
  op.create_table(
    "aw_purchasing_shipmethod",
    sa.Column("shipmethodid", sa.Integer(), sa.Identity(), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("shipbase", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("shiprate", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("shipbase > 0", name="ck_aw_shipmethod_shipbase"),
    sa.CheckConstraint("shiprate > 0", name="ck_aw_shipmethod_shiprate"),
    sa.PrimaryKeyConstraint("shipmethodid", name="pk_aw_purchasing_shipmethod"),
  )
  op.create_table(
    "aw_production_productsubcategory",
    sa.Column("productsubcategoryid", sa.Integer(), sa.Identity(), nullable=False),
    sa.Column("productcategoryid", sa.Integer(), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.PrimaryKeyConstraint("productsubcategoryid", name="pk_aw_production_productsubcategory"),
  )
  op.create_table(
    "aw_production_product",
    sa.Column("productid", sa.Integer(), sa.Identity(), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("productnumber", sa.String(25), nullable=False),
    sa.Column("makeflag", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("finishedgoodsflag", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("color", sa.String(15), nullable=True),
    sa.Column("safetystocklevel", sa.SmallInteger(), nullable=False),
    sa.Column("reorderpoint", sa.SmallInteger(), nullable=False),
    sa.Column("standardcost", sa.Numeric(19, 4), nullable=False),
    sa.Column("listprice", sa.Numeric(19, 4), nullable=False),
    sa.Column("size", sa.String(5), nullable=True),
    sa.Column("sizeunitmeasurecode", sa.CHAR(3), nullable=True),
    sa.Column("weightunitmeasurecode", sa.CHAR(3), nullable=True),
    sa.Column("weight", sa.Numeric(8, 2), nullable=True),
    sa.Column("daystomanufacture", sa.Integer(), nullable=False),
    sa.Column("productline", sa.CHAR(2), nullable=True),
    sa.Column("class", sa.CHAR(2), nullable=True),
    sa.Column("style", sa.CHAR(2), nullable=True),
    sa.Column("productsubcategoryid", sa.Integer(), nullable=True),
    sa.Column("productmodelid", sa.Integer(), nullable=True),
    sa.Column("sellstartdate", sa.DateTime(), nullable=False),
    sa.Column("sellenddate", sa.DateTime(), nullable=True),
    sa.Column("discontinueddate", sa.DateTime(), nullable=True),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("[class] IS NULL OR UPPER([class]) IN ('L', 'M', 'H')", name="ck_aw_product_class"),
    sa.CheckConstraint("daystomanufacture >= 0", name="ck_aw_product_daystomanufacture"),
    sa.CheckConstraint("listprice >= 0", name="ck_aw_product_listprice"),
    sa.CheckConstraint("reorderpoint > 0", name="ck_aw_product_reorderpoint"),
    sa.CheckConstraint("safetystocklevel > 0", name="ck_aw_product_safetystocklevel"),
    sa.CheckConstraint("sellenddate IS NULL OR sellenddate >= sellstartdate", name="ck_aw_product_sellenddate"),
    sa.CheckConstraint("standardcost >= 0", name="ck_aw_product_standardcost"),
    sa.CheckConstraint("weight IS NULL OR weight > 0", name="ck_aw_product_weight"),
    sa.ForeignKeyConstraint(["productsubcategoryid"], ["aw_production_productsubcategory.productsubcategoryid"]),
    sa.ForeignKeyConstraint(["sizeunitmeasurecode"], ["aw_production_unitmeasure.unitmeasurecode"]),
    sa.ForeignKeyConstraint(["weightunitmeasurecode"], ["aw_production_unitmeasure.unitmeasurecode"]),
    sa.PrimaryKeyConstraint("productid", name="pk_aw_production_product"),
  )
  op.create_table(
    "aw_purchasing_vendor",
    sa.Column("businessentityid", sa.Integer(), nullable=False),
    sa.Column("accountnumber", sa.String(15), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("creditrating", sa.SmallInteger(), nullable=False),
    sa.Column("preferredvendorstatus", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("activeflag", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("purchasingwebserviceurl", sa.String(1024), nullable=True),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("creditrating BETWEEN 1 AND 5", name="ck_aw_vendor_creditrating"),
    sa.ForeignKeyConstraint(["businessentityid"], ["aw_person_businessentity.businessentityid"]),
    sa.PrimaryKeyConstraint("businessentityid", name="pk_aw_purchasing_vendor"),
  )
  op.create_table(
    "aw_purchasing_productvendor",
    sa.Column("productid", sa.Integer(), nullable=False),
    sa.Column("businessentityid", sa.Integer(), nullable=False),
    sa.Column("averageleadtime", sa.Integer(), nullable=False),
    sa.Column("standardprice", sa.Numeric(19, 4), nullable=False),
    sa.Column("lastreceiptcost", sa.Numeric(19, 4), nullable=True),
    sa.Column("lastreceiptdate", sa.DateTime(), nullable=True),
    sa.Column("minorderqty", sa.Integer(), nullable=False),
    sa.Column("maxorderqty", sa.Integer(), nullable=False),
    sa.Column("onorderqty", sa.Integer(), nullable=True),
    sa.Column("unitmeasurecode", sa.CHAR(3), nullable=False),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("averageleadtime >= 1", name="ck_aw_productvendor_averageleadtime"),
    sa.CheckConstraint("lastreceiptcost IS NULL OR lastreceiptcost > 0", name="ck_aw_productvendor_lastreceiptcost"),
    sa.CheckConstraint("maxorderqty >= 1", name="ck_aw_productvendor_maxorderqty"),
    sa.CheckConstraint("minorderqty >= 1", name="ck_aw_productvendor_minorderqty"),
    sa.CheckConstraint("onorderqty IS NULL OR onorderqty >= 0", name="ck_aw_productvendor_onorderqty"),
    sa.CheckConstraint("standardprice > 0", name="ck_aw_productvendor_standardprice"),
    sa.ForeignKeyConstraint(["productid"], ["aw_production_product.productid"]),
    sa.ForeignKeyConstraint(["unitmeasurecode"], ["aw_production_unitmeasure.unitmeasurecode"]),
    sa.ForeignKeyConstraint(["businessentityid"], ["aw_purchasing_vendor.businessentityid"]),
    sa.PrimaryKeyConstraint("productid", "businessentityid", name="pk_aw_purchasing_productvendor"),
  )
  op.create_table(
    "aw_purchasing_purchaseorderheader",
    sa.Column("purchaseorderid", sa.Integer(), sa.Identity(), nullable=False),
    sa.Column("revisionnumber", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
    sa.Column("status", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
    sa.Column("employeeid", sa.Integer(), nullable=False),
    sa.Column("vendorid", sa.Integer(), nullable=False),
    sa.Column("shipmethodid", sa.Integer(), nullable=False),
    sa.Column("orderdate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.Column("shipdate", sa.DateTime(), nullable=True),
    sa.Column("subtotal", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("taxamt", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("freight", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("freight >= 0", name="ck_aw_poh_freight"),
    sa.CheckConstraint("shipdate IS NULL OR shipdate >= orderdate", name="ck_aw_poh_shipdate"),
    sa.CheckConstraint("status BETWEEN 1 AND 4", name="ck_aw_poh_status"),
    sa.CheckConstraint("subtotal >= 0", name="ck_aw_poh_subtotal"),
    sa.CheckConstraint("taxamt >= 0", name="ck_aw_poh_taxamt"),
    sa.ForeignKeyConstraint(["employeeid"], ["aw_humanresources_employee.businessentityid"]),
    sa.ForeignKeyConstraint(["shipmethodid"], ["aw_purchasing_shipmethod.shipmethodid"]),
    sa.ForeignKeyConstraint(["vendorid"], ["aw_purchasing_vendor.businessentityid"]),
    sa.PrimaryKeyConstraint("purchaseorderid", name="pk_aw_purchasing_purchaseorderheader"),
  )
  op.create_table(
    "aw_production_location",
    sa.Column("locationid", sa.SmallInteger(), sa.Identity(), nullable=False),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("costrate", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("availability", sa.Numeric(19, 4), nullable=False, server_default=sa.text("0")),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("costrate >= 0", name="ck_aw_location_costrate"),
    sa.CheckConstraint("availability >= 0", name="ck_aw_location_availability"),
    sa.PrimaryKeyConstraint("locationid", name="pk_aw_production_location"),
  )
  op.create_table(
    "aw_production_productinventory",
    sa.Column("productid", sa.Integer(), nullable=False),
    sa.Column("locationid", sa.SmallInteger(), nullable=False),
    sa.Column("shelf", sa.String(10), nullable=False),
    sa.Column("bin", sa.SmallInteger(), nullable=False),
    sa.Column("quantity", sa.SmallInteger(), nullable=False, server_default=sa.text("0")),
    sa.Column("rowguid", sa.Uuid(), nullable=False, server_default=new_id),
    sa.Column("modifieddate", sa.DateTime(), nullable=False, server_default=utc_now),
    sa.CheckConstraint("bin BETWEEN 0 AND 100", name="ck_aw_productinventory_bin"),
    sa.ForeignKeyConstraint(["productid"], ["aw_production_product.productid"]),
    sa.ForeignKeyConstraint(["locationid"], ["aw_production_location.locationid"]),
    sa.PrimaryKeyConstraint("productid", "locationid", name="pk_aw_production_productinventory"),
  )


# 建立 SQL Server 初始結構
def upgrade() -> None:
  create_core_tables()
  create_adventureworks_tables()
  for view_sql in CORE_VIEWS:
    op.execute(view_sql)


# 依外鍵相依順序移除本 baseline 建立的物件
def downgrade() -> None:
  for view_name in (
    "view_user_visible_menu",
    "view_user_menu_override",
    "view_role_menus_summary",
    "view_role_menu",
    "view_user_roles_summary",
    "view_user_role",
  ):
    op.execute(f"DROP VIEW IF EXISTS dbo.{view_name}")

  for table_name in (
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
    "user_menu_override",
    "role_menu",
    "user_role",
    "todo",
    "item",
    "menu",
    "role",
    "user",
  ):
    op.drop_table(table_name)
