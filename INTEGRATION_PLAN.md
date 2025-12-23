# Grimlive ↔ Grimkeeper Integration Plan

## Current State
- **grimkeeper**: Discord bot tracking storyteller stats + game history
- **grimlive**: Web-based grimoire tracking game state in real-time
- **Shared database**: Both use PostgreSQL on AWS (grimkeeper's instance)

## Integration Architecture

### Database Schema (Unified)

```
grimkeeper's existing tables:
├── guilds (Discord servers)
├── games (game history - shared by both!)
│   ├── guild_id (NULL for web-only games)
│   ├── category_id (NULL for web-only games)
│   ├── script, custom_name
│   ├── start_time, end_time (Unix timestamps)
│   ├── players (JSONB array)
│   ├── storyteller_id (Discord user)
│   ├── winner ('Good', 'Evil', NULL)
│   └── is_active
├── storyteller_stats (ST performance)
├── sessions (category-scoped config)
└── timers, shadow_followers, etc.

grimlive's new tables (extend grimkeeper):
├── web_sessions (website auth tokens)
│   ├── discord_user_id (links to Discord)
│   └── token (Bearer auth)
├── game_players (individual participation)
│   ├── game_id → games(game_id) [FK to shared table]
│   ├── discord_id (links player to Discord)
│   ├── player_name, seat_number
│   └── survived, winning_team
├── player_roles (role assignments)
│   ├── game_player_id → game_players(id)
│   ├── role_id, role_name, team
│   └── assigned_at
└── player_deaths (death tracking)
    ├── game_player_id → game_players(id)
    ├── death_type, day_number
    └── killer_player_id
```

### Data Flow

**Website Game:**
1. User enables "Stat Tracking" toggle
2. POST /api/session/create → gets bearer token
3. POST /api/game/start → inserts into `games` table (guild_id=NULL, category_id=NULL)
4. Players join → POST /api/player/add → inserts into `game_players`
5. Role assignments → stored in `player_roles`
6. Deaths → tracked in `player_deaths`
7. POST /api/game/end → updates `games.winner`, `games.end_time`

**Discord Bot Game:**
1. User runs `/startgame Trouble Brewing`
2. grimkeeper inserts into `games` table (guild_id=123, category_id=456)
3. Players tracked in `games.players` JSONB array
4. `/endgame Good` → updates `games.winner`

**Integration Points:**
- Same `games` table = unified game history
- `game_players.discord_id` = links web players to Discord accounts
- grimkeeper can query player stats: `SELECT * FROM game_players WHERE discord_id = ?`
- Website can show Discord stats if user links account

## Implementation Phases

### Phase 1: API Foundation ✅ (DONE)
- [x] REST API with SQLite (local dev)
- [x] Schema aligned with grimkeeper's `games` table
- [x] 7 endpoints: session/create, game/start, game/end, player/add, player/death, stats
- [x] Session-based auth with bearer tokens

### Phase 2: Frontend Integration (NEXT)
- [ ] Add "Enable Stat Tracking" toggle in Menu.vue
- [ ] Create `src/services/stats.js` API client
- [ ] Wire game start/end events to API
- [ ] Wire player role assignments to API
- [ ] Wire player deaths to API
- [ ] Test with SQLite locally

### Phase 3: Discord OAuth
- [ ] Add "Link Discord Account" button in Menu
- [ ] OAuth2 flow: `https://discord.com/api/oauth2/authorize?client_id=...`
- [ ] Store `discord_user_id` in localStorage
- [ ] Send `discord_user_id` with session creation
- [ ] Update web_sessions.discord_user_id on link

### Phase 4: PostgreSQL Production
- [ ] Add `DATABASE_URL` env var support in api.js
- [ ] Use `pg` package instead of bun:sqlite when DATABASE_URL exists
- [ ] Deploy grimlive server to same AWS instance as grimkeeper
- [ ] Run `001_player_tracking.sql` migration on production DB
- [ ] Test with shared database

### Phase 5: Grimkeeper Bot Extensions
**New commands for player stats:**

```python
# In grimkeeper's botc/handlers.py

async def player_stats_handler(interaction, user):
    """Show individual player statistics across all games."""
    stats = await db.get_player_stats(user.id)
    
    embed = discord.Embed(
        title=f"Player Stats: {user.display_name}",
        color=0x00ff00
    )
    embed.add_field(name="Games Played", value=stats['games_played'])
    embed.add_field(name="Games Won", value=stats['games_won'])
    embed.add_field(name="Win Rate", value=f"{stats['win_rate']:.1f}%")
    embed.add_field(name="Favorite Role", value=stats['favorite_role'])
    embed.add_field(name="Times Executed", value=stats['times_executed'])
    embed.add_field(name="Times Survived", value=stats['times_survived'])
    
    await interaction.response.send_message(embed=embed)

# In grimkeeper's botc/database.py

async def get_player_stats(self, discord_id):
    """Aggregate player statistics from game_players table."""
    async with self.pool.acquire() as conn:
        # Total games
        games_played = await conn.fetchval("""
            SELECT COUNT(*) FROM game_players 
            WHERE discord_id = $1
        """, discord_id)
        
        # Games won
        games_won = await conn.fetchval("""
            SELECT COUNT(*) FROM game_players 
            WHERE discord_id = $1 AND winning_team = TRUE
        """, discord_id)
        
        # Favorite role
        favorite_role = await conn.fetchrow("""
            SELECT pr.role_name, COUNT(*) as times_played
            FROM player_roles pr
            JOIN game_players gp ON pr.game_player_id = gp.id
            WHERE gp.discord_id = $1
            GROUP BY pr.role_name
            ORDER BY times_played DESC
            LIMIT 1
        """, discord_id)
        
        # Death stats
        death_stats = await conn.fetchrow("""
            SELECT 
                COUNT(CASE WHEN death_type = 'execution' THEN 1 END) as times_executed,
                COUNT(CASE WHEN death_type = 'night_kill' THEN 1 END) as times_night_killed
            FROM player_deaths pd
            JOIN game_players gp ON pd.game_player_id = gp.id
            WHERE gp.discord_id = $1
        """, discord_id)
        
        # Survival stats
        times_survived = await conn.fetchval("""
            SELECT COUNT(*) FROM game_players 
            WHERE discord_id = $1 AND survived = TRUE
        """, discord_id)
        
        return {
            'games_played': games_played,
            'games_won': games_won,
            'win_rate': (games_won / games_played * 100) if games_played > 0 else 0,
            'favorite_role': favorite_role['role_name'] if favorite_role else 'None',
            'times_executed': death_stats['times_executed'],
            'times_night_killed': death_stats['times_night_killed'],
            'times_survived': times_survived
        }

# Register new slash command
@bot.tree.command(name="playerstats", description="Show player statistics")
@app_commands.describe(user="Player to show stats for (defaults to yourself)")
async def playerstats(interaction: discord.Interaction, user: discord.User = None):
    user = user or interaction.user
    await player_stats_handler(interaction, user)
```

**New Discord commands:**
- `/playerstats [@user]` - Show player's game history and stats
- `/rolestats <role>` - Show how often a role wins, gets executed, etc.
- `/gamestats <game_id>` - Show detailed breakdown of a specific game

### Phase 6: Advanced Features
- [ ] Leaderboards (website + Discord)
- [ ] Role win rate analytics
- [ ] Player card generation (like ST cards)
- [ ] Game replay viewer (website)
- [ ] Discord notifications for website games
- [ ] Export game history to JSON/CSV

## Environment Setup

**Development (local):**
```bash
# grimlive server
NODE_ENV=development bun run server/index.js
# Uses SQLite (grimlive.db) for testing
```

**Production (AWS):**
```bash
# Environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/grimkeeper
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# grimlive server
bun run server/index.js
# Uses PostgreSQL (shared with grimkeeper)
```

## Benefits of Integration

1. **Unified Stats**: Players see their performance across Discord bot games AND website games
2. **Discord Linking**: Website users can link Discord accounts to track stats
3. **Cross-Platform**: Play on website, view stats on Discord (or vice versa)
4. **Storyteller Tools**: Bot can show "who plays Imp most?" from website data
5. **Analytics**: Combined dataset for role balance analysis, win rates, etc.

## Migration Strategy

**For existing grimkeeper users:**
- No changes required - existing `games` table stays the same
- New tables (`game_players`, `player_roles`, `player_deaths`) are additive
- Bot continues working as-is
- Optional: Add `/playerstats` command when ready

**For grimlive users:**
- Optional stat tracking (toggle in UI)
- Optional Discord linking (OAuth button)
- Works independently without Discord if preferred
