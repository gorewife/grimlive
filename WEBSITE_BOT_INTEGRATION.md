# Website-Bot Integration Flow

## Overview
The grimlive website integrates with the grimkeeper Discord bot to provide seamless game tracking, announcements, and session management. This document outlines the complete user flow and technical implementation.

## User Flow

### 1. Initial Setup (Discord Bot)
1. **User runs `/game` command in Discord**
   - Bot creates a session in PostgreSQL `sessions` table
   - Generates unique `session_code` (e.g., "ABCD1234")
   - Creates Discord category with voice/text channels
   - Displays session code to user

2. **Bot stores session data:**
   ```sql
   sessions (
     guild_id,
     category_id,
     session_code,  -- Unique 8-char code for website linking
     announce_channel_id,
     grimoire_link,
     active_game_id
   )
   ```

### 2. Website Connection

#### A. Discord Authentication (Optional but Recommended)
1. **User clicks "Link Discord" on website**
   - Opens OAuth popup to Discord
   - User authorizes application
   - Website receives: `userId`, `username`, `avatar`

2. **API Flow:**
   ```
   Frontend → /api/discord/oauth?redirect_uri=...
   Discord  → Authorization page
   Callback → /api/discord/callback?code=...
   Backend  → Exchanges code for Discord user data
   Backend  → Creates web_session with discord_user_id
   Frontend ← Receives userId, username, stores in localStorage
   ```

3. **Session Token Created:**
   ```sql
   web_sessions (
     session_id UUID,
     token UUID,
     discord_user_id,
     expires_at -- 24 hours
   )
   ```

#### B. Session Code Entry
1. **User enters session code from Discord**
   - Website stores in localStorage: `selectedSessionCode`
   - Validates format (8 characters)
   - Waits for game start confirmation

### 3. Game Lifecycle

#### A. Starting a Game
1. **User clicks "Start Game" on website**
   - Checks requirements:
     - Discord linked (`discordUserId` set)
     - Session code entered
     - At least 0 players (temporarily disabled validation)

2. **API Call:** `POST /api/game/start`
   ```json
   {
     "script": "Trouble Brewing",
     "customName": "Custom Script Name",
     "players": ["Player1", "Player2", ...],
     "storytellerId": "discord_user_id",
     "sessionCode": "ABCD1234"
   }
   ```

3. **Backend Processing:**
   ```javascript
   // Validate session code
   SELECT guild_id, category_id FROM sessions WHERE session_code = $1
   
   // Create game
   INSERT INTO games (guild_id, category_id, script, custom_name, players, storyteller_id)
   VALUES (...) RETURNING game_id
   
   // Update session
   UPDATE sessions SET active_game_id = $1, grimoire_link = $2
   WHERE guild_id = $3 AND category_id = $4
   
   // Queue announcement
   INSERT INTO announcements (guild_id, category_id, announcement_type, game_id)
   VALUES ($1, $2, 'game_start', $3)
   ```

4. **Bot Processing (every 5 seconds):**
   ```python
   # Fetch pending announcements
   SELECT * FROM announcements WHERE processed = FALSE
   
   # For game_start:
   - Fetch game data from games table
   - Fetch storyteller from Discord guild
   - Create embed with script, players, storyteller
   - Send to announce_channel
   - Mark announcement as processed
   ```

5. **Result:**
   - Website stores `currentGameId` in localStorage
   - Discord receives announcement in session's text channel
   - Game is tracked in database

#### B. Role Assignment (During Game)
1. **Storyteller assigns roles on website**
   - Each role assignment triggers update

2. **API Call:** `POST /api/game/update-role`
   ```json
   {
     "game_id": 123,
     "player_name": "Player1",
     "role": "Washerwoman",
     "final_role": null
   }
   ```

3. **Backend Updates:**
   ```sql
   INSERT INTO game_players (game_id, player_name, role)
   VALUES ($1, $2, $3)
   ON CONFLICT UPDATE role = $3
   ```

#### C. Mute/Unmute During Game
1. **Storyteller clicks "Mute All" or "Unmute All"**

2. **API Call:** `POST /api/mute` or `/api/unmute`
   ```json
   {
     "sessionCode": "ABCD1234"
   }
   ```

3. **Backend Queues Announcement:**
   ```sql
   INSERT INTO announcements (guild_id, category_id, announcement_type)
   VALUES ($1, $2, 'mute')
   ```

4. **Bot Processing:**
   ```python
   # For mute:
   - Find all voice channels in category
   - Mute all non-bot, non-storyteller members
   - Send announcement: "🔇 Muted X players"
   
   # For unmute:
   - Find all voice channels in category
   - Unmute all non-bot members (includes storytellers)
   - Send announcement: "🔊 Unmuted X players"
   ```

#### D. Timer Announcements
1. **Storyteller starts timer on website**

2. **API Call:** `POST /api/timerAnnounce`
   ```json
   {
     "sessionCode": "ABCD1234",
     "duration": 180  // seconds
   }
   ```

3. **Backend Queues:**
   ```sql
   INSERT INTO announcements (guild_id, category_id, announcement_type, game_data)
   VALUES ($1, $2, 'timer_start', '{"duration": 180}')
   ```

4. **Bot Processing:**
   ```python
   # Parse duration from game_data
   # Create embed: "⏰ Timer Started - 3m 0s"
   # Send to announce_channel
   ```

#### E. Ending a Game
1. **Storyteller clicks "End Game" and selects winner**

2. **API Call:** `POST /api/game/end`
   ```json
   {
     "gameId": 123,
     "winningTeam": "Good"
   }
   ```

3. **Backend Processing:**
   ```javascript
   // Update game
   UPDATE games SET end_time = $1, winner = $2, is_active = false
   WHERE game_id = $3
   
   // Update players' winning status
   UPDATE game_players SET winning_team = (final_team = $1)
   WHERE game_id = $2
   
   // Update session
   UPDATE sessions SET active_game_id = NULL
   WHERE active_game_id = $1
   
   // Queue announcement
   INSERT INTO announcements (guild_id, category_id, announcement_type, game_id)
   VALUES ($1, $2, 'game_end', $3)
   ```

4. **Bot Processing:**
   ```python
   # Fetch game data
   # Create embed with:
   - Winner (Good/Evil) with themed colors
   - Script name
   - Duration
   - Player count
   - Start time
   # Send to announce_channel
   ```

5. **Result:**
   - Website clears `currentGameId`
   - Discord receives victory/defeat announcement
   - Game marked inactive in database

#### F. Canceling a Game
1. **Storyteller clicks "Cancel Game"**

2. **API Call:** `POST /api/game/cancel`
   ```json
   {
     "game_id": 123
   }
   ```

3. **Backend Processing:**
   ```javascript
   // Mark game inactive
   UPDATE games SET is_active = false WHERE game_id = $1
   
   // Clear session link
   UPDATE sessions SET active_game_id = NULL
   WHERE active_game_id = $1
   
   // Queue announcement
   INSERT INTO announcements (guild_id, category_id, announcement_type, game_id)
   VALUES ($1, $2, 'game_cancel', $3)
   ```

4. **Bot Processing:**
   ```python
   # Create embed: "📕 Game Canceled"
   # Include script, players, start time
   # Send to announce_channel
   ```

### 4. Background Maintenance

#### A. Stale Game Cleanup (Node.js)
- **Runs every hour**
- Marks games older than 24 hours as inactive:
  ```sql
  UPDATE games SET is_active = false
  WHERE is_active = true 
  AND start_time < (EXTRACT(epoch FROM NOW()) - 86400)
  ```

#### B. Shadow Follower Cleanup (Python Bot)
- **Runs every hour**
- Removes spectators older than 24 hours:
  ```sql
  DELETE FROM shadow_followers
  WHERE created_at < NOW() - INTERVAL '24 hours'
  ```

## Data Flow Diagram

```
Discord Bot                PostgreSQL              Website API            Frontend
    |                          |                        |                     |
    |--/game command-->        |                        |                     |
    |                          |                        |                     |
    |<--session_code---        |                        |                     |
    |                          |                        |                     |
    |                          |                        |<--Link Discord------|
    |                          |                        |                     |
    |                          |<--create session-------|                     |
    |                          |---token--------------->|                     |
    |                          |                        |---userId----------->|
    |                          |                        |                     |
    |                          |                        |<--Start Game--------|
    |                          |<--create game----------|                     |
    |                          |<--queue announcement---|                     |
    |                          |---game_id------------->|                     |
    |                          |                        |---game_id---------->|
    |                          |                        |                     |
    |<--fetch announcements----|                        |                     |
    |---mark processed-------->|                        |                     |
    |                          |                        |                     |
    |--send embed to Discord-->|                        |                     |
    |                          |                        |                     |
    |                          |                        |<--Mute/Unmute------|
    |                          |<--queue announcement---|                     |
    |<--fetch announcements----|                        |                     |
    |---mark processed-------->|                        |                     |
    |--mute voice channels---->|                        |                     |
    |                          |                        |                     |
    |                          |                        |<--End Game----------|
    |                          |<--update game----------|                     |
    |                          |<--queue announcement---|                     |
    |<--fetch announcements----|                        |                     |
    |---send embed------------>|                        |                     |
```

## Key Technical Details

### Authentication
- **Web Sessions:** UUID tokens, 24-hour expiry
- **Authorization:** Bearer token in `Authorization` header
- **Storage:** localStorage for persistence across page reloads

### Database Tables
- **sessions:** Discord bot sessions with session_code
- **web_sessions:** Website authentication tokens
- **games:** Game tracking with guild_id, category_id, storyteller_id
- **game_players:** Player roles and seats per game
- **announcements:** Queue for website→bot events
- **shadow_followers:** Temporary spectators (24h auto-cleanup)

### Announcement Types
- `game_start` - New game created
- `game_end` - Game finished with winner
- `game_cancel` - Game canceled
- `mute` - Mute all players
- `unmute` - Unmute all players
- `timer_start` - Timer countdown started

### Error Handling
- Invalid session codes return 404
- Missing Discord link prevents game operations
- Failed announcements logged but don't block API responses
- Bot continues processing even if individual announcements fail

## Issues Fixed

### 1. Missing game_data in Announcement Query
**Problem:** Timer announcements failed because `game_data` wasn't fetched
**Fix:** Added `game_data` to SELECT query in announcements processor

### 2. Missing update-role Endpoint Route
**Problem:** Role updates returned 404
**Fix:** Added route mapping in index.js

### 3. Undefined is_storyteller Method
**Problem:** Mute function called non-existent `bot.is_storyteller()`
**Fix:** Check for PREFIX_ST in display_name instead

### 4. Menu Overflow
**Problem:** Long menus extended beyond viewport
**Fix:** Added `max-height: calc(100vh - 100px)` and `overflow-y: auto`

## Deployment Checklist

### Backend (grimlive/server/)
- [ ] Environment variables set:
  - `DATABASE_URL`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
- [ ] Database migrations applied
- [ ] API server running on port 8001
- [ ] CORS enabled for frontend domain

### Bot (grimkeeper/)
- [ ] Database migrations applied (especially 017, 018)
- [ ] Bot has "Mute Members" permission in Discord
- [ ] AnnouncementProcessor and CleanupTask initialized
- [ ] Bot running and connected to Discord

### Frontend (grimlive/grimlive/)
- [ ] `VITE_API_URL` environment variable set
- [ ] Built and deployed to Cloudflare Pages
- [ ] Discord OAuth callback URL registered in Discord App settings

## Testing Flow

1. **Test Discord Bot Setup:**
   - Run `/game` in Discord server
   - Verify session code generated
   - Check channels created

2. **Test Website Connection:**
   - Click "Link Discord"
   - Complete OAuth flow
   - Enter session code from Discord
   - Verify code accepted

3. **Test Game Lifecycle:**
   - Add players to grimoire
   - Click "Start Game"
   - Verify announcement appears in Discord
   - Assign roles
   - Test mute/unmute
   - Start timer
   - End game with winner selection
   - Verify final announcement

4. **Test Error Cases:**
   - Invalid session code
   - No Discord link
   - Missing permissions
   - Network failures

## Monitoring

### Website Logs
- Check browser console for API errors
- Monitor localStorage for token expiry
- Watch for 401/404 responses

### Bot Logs
- Check `discord.log` for announcement processing
- Watch for "Unknown announcement type" warnings
- Monitor database connection errors

### Database Queries
```sql
-- Check pending announcements
SELECT * FROM announcements WHERE processed = FALSE;

-- Check active games
SELECT * FROM games WHERE is_active = TRUE;

-- Check recent sessions
SELECT * FROM sessions ORDER BY last_active DESC LIMIT 10;

-- Check stale games
SELECT COUNT(*) FROM games 
WHERE is_active = TRUE 
AND start_time < (EXTRACT(epoch FROM NOW()) - 86400);
```
