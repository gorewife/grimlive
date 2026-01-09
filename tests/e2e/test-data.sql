-- Test data for E2E integration tests

INSERT INTO guilds (guild_id, botc_category_id, storyteller_role_id) VALUES 
  (123456789, NULL, NULL),
  (987654321, NULL, NULL)
ON CONFLICT (guild_id) DO NOTHING;

INSERT INTO sessions (guild_id, category_id, storyteller_user_id, session_code, created_at, last_active) VALUES 
  (123456789, 111111111, 999888777, 's1', EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW())),
  (987654321, 222222222, 888777666, 's2', EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()))
ON CONFLICT (guild_id, category_id) DO UPDATE SET
  last_active = EXCLUDED.last_active;
