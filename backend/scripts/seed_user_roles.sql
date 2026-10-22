INSERT INTO user_role (user_id, role_id)
SELECT u.id, r.id
FROM "user" u
JOIN role r ON r.code = 'system_admin'
WHERE u.is_superuser = true
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_role (user_id, role_id)
SELECT u.id, r.id
FROM "user" u
JOIN role r ON r.code = 'viewer'
WHERE u.is_superuser = false
ON CONFLICT (user_id, role_id) DO NOTHING;
