# Grimlive Integration Progress

## Phase 1: Modernization (Completed Dec 2025)

Migrated grimlive from legacy stack to modern build system:
- Vue 2.7 (from Vue 2.6)
- Vite 7.3.0 (from vue-cli/webpack)
- Bun runtime (from Node.js)
- PostgreSQL (from SQLite)

Deploy targets:
- Frontend: Cloudflare Pages (grim.hystericca.dev)
- Backend: AWS EC2 Node.js server (api.hystericca.dev)

## Phase 2: Bot Integration (Completed Nov 2025)

Connected grimlive website to grimkeeper Discord bot:
- Shared PostgreSQL database (grimkeeper_db)
- Session code system: storytellers enter bot-generated codes (s1, s2, etc) on website
- Discord OAuth: players link accounts to track stats
- Announcement queue: website game events trigger Discord notifications

Database schema:
- `games` table shared between bot and website (guild_id/category_id nullable for web-only games)
- `web_sessions` for website auth tokens (24hr expiry)
- `announcements` queue for website→bot communication
- `game_players`, `player_roles`, `player_deaths` for detailed website tracking

## Phase 3: Bug Fixes & Improvements (In Progress Dec 2025)

Frontend stability improvements:
- Fixed reminder icons not displaying (getRoleIcon not exposed in component methods)
- Improved end game UX: replaced prompt() with proper modal for winner selection
- Added visual team selection buttons (Good/Evil) with icons
- Proper script detection: distinguishes official editions from custom/homebrew scripts
- UI/UX polish:
  - Replaced Papyrus/PiratesBay with Cinzel and IM Fell English for gothic elegance
  - Normalized icon sizes across menu and controls
  - Improved font weights and spacing for better readability
  - Added text shadows for better contrast
  - Maintained victorian/gothic aesthetic while modernizing typography
- Complete game tracking flow:
  - Players added to grimoire, ST assigns roles
  - Start: sends script, customName, player list, session code
  - Start: captures STARTING roles for all players via /api/player/add
  - End: updates FINAL roles (tracks role changes like drunk sobering)
  - End: sends winning team, survival status via modal UI
  - Roles stored in game_players with both starting and final states
  - Bot announcements triggered via announcements queue
- Database schema updated to track starting_role vs final_role

## Phase 4: Planned Features

Bot extensions:
- `/playerstats` - Show player game history
- `/rolestats` - Role win rates
- `/gamestats` - Game replay data

Website features:
- Longer night to night notes
- Advanced analytics (possible partner with clocktracker?)
- Grim revealer

## Current Status

Production deployed at:
- https://grim.hystericca.dev (frontend)
- https://api.hystericca.dev (backend)

Both services running on AWS EC2 (3.138.191.201) with SSL.
