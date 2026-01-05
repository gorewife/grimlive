-- Test data for E2E integration tests

INSERT INTO guilds (guild_id, language) VALUES 
  (123456789, 'en'),
  (987654321, 'en')
ON CONFLICT (guild_id) DO NOTHING;

INSERT INTO sessions (guild_id, category_id, storyteller_user_id, session_code, last_active) VALUES 
  (123456789, 111111111, 999888777, 's1', EXTRACT(EPOCH FROM NOW())::INTEGER),
  (987654321, 222222222, 888777666, 's2', EXTRACT(EPOCH FROM NOW())::INTEGER)
ON CONFLICT (guild_id, category_id) DO UPDATE SET
  last_active = EXCLUDED.last_active;
