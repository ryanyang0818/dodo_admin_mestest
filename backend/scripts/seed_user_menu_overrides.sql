WITH target_users AS (
  SELECT
    (SELECT id FROM "user" WHERE is_superuser = false ORDER BY email LIMIT 1) AS viewer_user_id,
    (SELECT id FROM "user" WHERE is_superuser = true ORDER BY email LIMIT 1) AS admin_user_id
),
override_seed(user_id, menu_key, effect, reason) AS (
  SELECT viewer_user_id, 'finance', 'allow', '特助情境：額外開放財務管理父選單。'
  FROM target_users
  WHERE viewer_user_id IS NOT NULL
  UNION ALL
  SELECT viewer_user_id, 'finance.payments', 'allow', '特助情境：額外開放收付款紀錄。'
  FROM target_users
  WHERE viewer_user_id IS NOT NULL
  UNION ALL
  SELECT admin_user_id, 'hr.payroll', 'deny', '示範 deny 優先：即使角色有權限，也隱藏薪資作業。'
  FROM target_users
  WHERE admin_user_id IS NOT NULL
)
INSERT INTO user_menu_override (user_id, menu_id, effect, reason)
SELECT seed.user_id, menu.id, seed.effect, seed.reason
FROM override_seed seed
JOIN menu ON menu.key = seed.menu_key
ON CONFLICT (user_id, menu_id) DO UPDATE SET
  effect = EXCLUDED.effect,
  reason = EXCLUDED.reason;
