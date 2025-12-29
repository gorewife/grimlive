 Cleanup script for orphaned/incomplete game entries
 Run this to remove games that were started but never completed due to errors

 Show orphaned games before deletion (games with < 5 players OR created > 24 hours ago with no end_time)
SELECT 
    g.game_id,
    g.script,
    g.start_time,
    g.end_time,
    g.player_count,
    COUNT(gp.id) as actual_players,
    EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(g.start_time))) / 3600 as hours_since_start
FROM games g
LEFT JOIN game_players gp ON g.game_id = gp.game_id
WHERE 
    g.is_active = true 
    AND (
        g.player_count < 5  \ Likely test/incomplete games
        OR (
            g.end_time IS NULL 
            AND EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(g.start_time))) > 86400   > 24 hours old
        )
    )
GROUP BY g.game_id
ORDER BY g.game_id;

 Uncomment the lines below to actually delete the orphaned games
 WARNING: This cannot be undone!

 Delete game_players for orphaned games
 DELETE FROM game_players 
 WHERE game_id IN (
     SELECT g.game_id
     FROM games g
     LEFT JOIN game_players gp ON g.game_id = gp.game_id
     WHERE 
         g.is_active = true 
         AND (
             g.player_count < 5
             OR (
                 g.end_time IS NULL 
                 AND EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(g.start_time))) > 86400
             )
         )
     GROUP BY g.game_id
 );

 Delete orphaned games
 DELETE FROM games 
 WHERE 
     is_active = true 
     AND (
         player_count < 5
         OR (
             end_time IS NULL 
             AND EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(start_time))) > 86400
         )
     );

 To delete specific game IDs (like the ones from your error):
 DELETE FROM game_players WHERE game_id IN (119, 120, 121, 122, 123, 124, 125);
 DELETE FROM games WHERE game_id IN (119, 120, 121, 122, 123, 124, 125);

 Verify deletion
 SELECT COUNT(*) as remaining_orphaned_games
 FROM games
 WHERE 
     is_active = true 
     AND (
         player_count < 5
         OR (
             end_time IS NULL 
             AND EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(start_time))) > 86400
         )
     );
