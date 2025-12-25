-- Add starting role tracking to game_players
-- This allows tracking role changes (drunk sobering, marionette reveals, etc.)

ALTER TABLE game_players 
ADD COLUMN starting_role_id TEXT,
ADD COLUMN starting_role_name TEXT,
ADD COLUMN starting_team TEXT CHECK (starting_team IN ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled'));

-- Rename existing role columns to be explicit about being final state
ALTER TABLE game_players 
RENAME COLUMN role_id TO final_role_id;

ALTER TABLE game_players 
RENAME COLUMN role_name TO final_role_name;

ALTER TABLE game_players 
RENAME COLUMN team TO final_team;

-- Add comments for clarity
COMMENT ON COLUMN game_players.starting_role_id IS 'Role assigned at game start';
COMMENT ON COLUMN game_players.final_role_id IS 'Role at game end (may differ if drunk/marionette)';
