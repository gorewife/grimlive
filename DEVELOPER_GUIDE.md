# Grimlive Developer Guide

> **Comprehensive technical documentation for the Grimlive virtual grimoire platform**  
> Last Updated: December 27, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Systems](#core-systems)
4. [Feature Documentation](#feature-documentation)
5. [API Reference](#api-reference)
6. [Data Models](#data-models)
7. [Development Workflow](#development-workflow)
8. [Deployment](#deployment)

---

## Overview

### What is Grimlive?

Grimlive is a real-time web application for playing Blood on the Clocktower online. It provides a virtual grimoire that synchronizes game state between a storyteller (host) and multiple players through WebSocket connections.

### Tech Stack

**Frontend:**
- Vue.js 3 (Composition API with Options API components)
- Vuex 4 (State management)
- Vite (Build tool & dev server)
- SCSS (Styling)
- Font Awesome (Icons)

**Backend:**
- Node.js (HTTP/HTTPS server)
- WebSocket (ws library for real-time sync)
- PostgreSQL (Stats & session persistence)
- Express-style routing (custom implementation)

**Integration:**
- Discord OAuth (Player authentication)
- Grimkeeper Discord Bot (Stats tracking, game announcements)

### Key Features

- **Real-time synchronization** between host and players
- **Role assignment** with token visualization
- **Voting system** with multiple modes (secret, public, double-voting)
- **Night order tracking** for storytellers
- **Reminder tokens** for ability tracking
- **Stats integration** with Discord bot
- **Timer system** with pause/resume
- **Voice control** (mute/unmute via Discord bot)

---

## User Flows

### Overview: Two Modes of Operation

Grimlive can be used in **two distinct modes**:

1. **Standalone Mode** - No Discord bot required, basic virtual grimoire
2. **Integrated Mode** - With Grimkeeper bot, full stats tracking and Discord features

---

### Standalone Mode (Without Grimkeeper)

**What works:**
✅ Real-time grimoire synchronization  
✅ Player management (add, remove, reorder)  
✅ Role assignment from official editions  
✅ Voting system with secret/public modes  
✅ Night order display  
✅ Reminder tokens  
✅ Timer system (website only)  
✅ Custom scripts via JSON import  
✅ Pronouns and self-naming  

**What doesn't work:**
❌ Stats tracking  
❌ Discord OAuth login  
❌ Game history/leaderboards  
❌ Discord announcements  
❌ Player linking to Discord accounts  
❌ Mute/unmute Discord voice channels  
❌ Bot-triggered timers  

#### Typical Standalone User Flow

**Pre-Game Setup (Storyteller):**

1. **Open grimlive** → Navigate to https://grim.hystericca.dev
2. **Select edition** → Menu → Grimoire → Choose script (TB, S&V, BMR, or custom)
3. **Host session** → Click "Host (Storyteller)" button
4. **Get session ID** → Automatically generated (e.g., "abc123-def456")
5. **Share link** → Copy player link and send to players via Discord/chat
   - Link format: `https://grim.hystericca.dev/?session=abc123-def456`

**Player Join Flow:**

1. **Click shared link** → Opens grimlive with session pre-filled
2. **Set name** → Click own token → "Set Name" → Enter name
3. **Set pronouns** (optional) → Click own token → "Change Pronouns"
4. **Wait for game start** → Storyteller will assign roles

**During Game (Storyteller):**

1. **Add players** → Menu → Players → Add (or press `A`)
   - Manually set names or let players self-name
2. **Assign roles** → Click player → "Change Role" → Select from list
   - Roles filtered by selected edition
   - Can change alignment independently for Drunk/Marionette
3. **Add reminders** → Click player → Scroll to reminders section → Click reminder
   - Poisoned, Protected, Mad, Drunk, etc.
4. **Manage game state:**
   - Toggle night order display (Menu → Night Order)
   - Mark players (click once = red skull indicator)
   - Track deaths (click player → shroud shows when dead)
5. **Run nominations:**
   - Click nominee → Click nominator (or same player for self-nom)
   - Players vote by clicking their own token
   - Vote count shown in real-time
   - Cancel with X button
6. **Use timer:**
   - Click timer icon → Select duration
   - Timer appears for all players
   - Can pause/resume/stop
7. **End game** → No formal end (just close tabs or start new session)

**During Game (Players):**

1. **View role** → Click own token to see role privately
   - Only works if storyteller assigned a role
2. **Vote during nominations:**
   - Click own token when prompted
   - Hand up = vote, click again = hand down
3. **Watch grimoire updates** → See role changes, deaths, etc. in real-time
4. **Spectate** → Can toggle spectator mode to watch without participating

---

### Integrated Mode (With Grimkeeper Bot)

**What's added:**
✅ **Discord OAuth** - Login with Discord account  
✅ **Stats tracking** - Game history, win rates, player stats  
✅ **Session linking** - Connect website to Discord game sessions  
✅ **Announcements** - Bot posts game start/end to Discord  
✅ **Player linking** - Discord logo shows next to linked players  
✅ **Voice control** - Mute/unmute all players from website  
✅ **Bot-synced timers** - Bot can auto-call players when timer ends  
✅ **Persistent stats** - View `/stats` and `/ststats` in Discord  

**Prerequisites:**
- Grimkeeper bot installed in Discord server
- Bot has permissions (Manage Nicknames, Mute Members, Manage Channels)
- BOTC category configured (`/setbotc`)
- Town Square voice channel set (`/settownsquare`)

#### Typical Integrated User Flow

**Pre-Game Setup (Storyteller):**

1. **Configure Discord server** (one-time setup):
   ```
   /autosetup - Creates BOTC category with channels
   ```
   - Or manually: `/setbotc <category>` + `/settownsquare <channel>`

2. **Start game in Discord:**
   ```
   /startgame Trouble Brewing
   ```
   - Bot prompts for player confirmation
   - Shows current players in voice channels
   - Storyteller clicks ✅ to confirm roster
   - Bot assigns session code (e.g., "s1", "s2", "s3")

3. **Login to grimlive with Discord:**
   - Open https://grim.hystericca.dev
   - Menu → Session tab → "Log in with Discord"
   - Authorize app → Redirected back to grimlive
   - Green checkmark shows "✓ Discord: YourUsername"

4. **Link session code:**
   - Menu → Session tab → Enter session code (e.g., "s1")
   - Press Enter to confirm
   - Input border turns green
   - "Start Game" button appears

5. **Host session & share link:**
   - Click "Host (Storyteller)"
   - Copy player link and share in Discord

**Player Join Flow (Enhanced):**

1. **Join voice channel** in Discord (in BOTC category)
2. **Toggle player status:**
   - Storytellers: Prefix `[ST]` in nickname
   - Players: No prefix (or run `*!` to toggle spectator)
3. **Click grimlive link** shared by storyteller
4. **(Optional) Login with Discord:**
   - Menu → Session tab → "Log in with Discord"
   - Enables stat tracking for this player
   - Discord logo appears next to name in grimoire
5. **Set name/pronouns** as in standalone mode

**During Game (Storyteller - Enhanced Features):**

1. **Assign roles** in grimlive (same as standalone)

2. **Start stat tracking:**
   - Click "Start Game" button (appears after Discord login + session code)
   - Modal confirms: "Start game with session code 's1'?"
   - All players with assigned roles are recorded
   - Bot posts announcement in Discord:
     ```
     🩸 The Grimoire Opens
     Script: Trouble Brewing
     Players: 7
     Storyteller: YourName
     Session: s1
     ```

3. **Use Discord-integrated features:**
   - **Mute All** → Mutes all players in voice (excludes storytellers)
   - **Unmute All** → Unmutes everyone
   - **Timer** → Syncs with bot's `*timer` command
   - Discord shows: "🔇 Muted 6 players (from website)"

4. **Bot commands available during game:**
   ```
   *call          - Move all players to Town Square
   *mute          - Mute all players (from Discord)
   *unmute        - Unmute all players (from Discord)
   *timer 5m      - Start timer (syncs to website)
   *timer cancel  - Cancel timer
   *night         - Post "🌙 NIGHTTIME" announcement
   *day           - Post "☀️ MORNING" announcement
   *players       - Show current player roster
   ```

5. **End game:**
   - Click "End Game" button in grimlive
   - Modal: "Who won? Good / Evil"
   - Select winner → Game recorded in database
   - Bot posts announcement in Discord:
     ```
     📜 The Grimoire Closes
     Victor: Good
     Script: Trouble Brewing
     Duration: 1h 23m
     Players: 7
     Session: s1
     ```
   - Stats viewable with `/stats` and `/ststats` commands

**During Game (Players - Enhanced Features):**

1. **See linked players:**
   - Discord logo appears next to players logged into Discord
   - Indicates who will have stats tracked

2. **Vote and play normally** (same as standalone)

3. **Stats are automatically tracked:**
   - Starting role recorded
   - Final role recorded (if changed by Drunk, etc.)
   - Win/loss tied to Discord account
   - Viewable across all servers player is in

**Post-Game:**

1. **View personal stats:**
   ```
   /ststats @yourself
   ```
   - Shows win rate, games played, favorite scripts
   - Generates stats card image

2. **View server stats:**
   ```
   /stats
   ```
   - Server-wide win rates
   - Most played scripts
   - Top storytellers

3. **View game history:**
   - Bot stores all games in database
   - Can query historical data
   - Leaderboards per server

---

### Feature Comparison Matrix

| Feature | Standalone | With Grimkeeper |
|---------|-----------|-----------------|
| Real-time sync | ✅ | ✅ |
| Role assignment | ✅ | ✅ |
| Voting system | ✅ | ✅ |
| Night order | ✅ | ✅ |
| Reminders | ✅ | ✅ |
| Timer (website) | ✅ | ✅ Synced |
| Player self-naming | ✅ | ✅ |
| Custom scripts | ✅ | ✅ |
| **Discord login** | ❌ | ✅ |
| **Stats tracking** | ❌ | ✅ |
| **Game history** | ❌ | ✅ |
| **Win rate tracking** | ❌ | ✅ |
| **Discord announcements** | ❌ | ✅ |
| **Voice control (mute/unmute)** | ❌ | ✅ |
| **Bot commands** | ❌ | ✅ |
| **Session codes** | ❌ | ✅ |
| **Player linking** | ❌ | ✅ |
| **Auto-call with timer** | ❌ | ✅ |

---

### Common User Scenarios

#### Scenario 1: Casual Online Game (Standalone)

**Context:** Friends playing casually, no Discord server setup

**Flow:**
1. Storyteller opens grimlive, hosts session
2. Shares link in Discord/chat
3. Players join via link
4. Storyteller assigns roles manually
5. Game proceeds normally with voting, night actions
6. No formal game end, just close tabs when done

**Time to setup:** 30 seconds

---

#### Scenario 2: Tournament/Serious Play (Integrated)

**Context:** Organized server with stats tracking, regular games

**Setup (one-time):**
1. Admin runs `/autosetup` in Discord
2. Bot creates category, channels, roles
3. Storytellers get [ST] role

**Each Game:**
1. Storyteller runs `/startgame <script>`
2. Bot confirms player roster
3. Storyteller logs into grimlive, enters session code
4. Hosts session, shares link
5. Players join voice, toggle prefixes if needed
6. Players optionally login to grimlive for stats
7. Storyteller assigns roles
8. Click "Start Game" to begin tracking
9. Use mute/unmute, timer, bot commands as needed
10. Click "End Game", select winner
11. Bot posts stats, players can view with `/ststats`

**Time to setup:** 2-3 minutes (first game), 30 seconds (subsequent)

---

#### Scenario 3: Hybrid Approach

**Context:** Discord server exists but not all players want stats

**Flow:**
1. Storyteller uses integrated mode (logs in, session code)
2. Some players login to grimlive (get tracked)
3. Some players don't login (can still play, just no stats)
4. Storyteller can still use voice control features
5. Game ends, only logged-in players get stats recorded

**This is valid!** Stats tracking is opt-in per player.

---

### Decision Tree: Which Mode Should I Use?

```
Do you have a Discord server?
├─ No → Use Standalone Mode
│         Just share the grimlive link, no setup needed
│
└─ Yes → Do you want to track stats?
          ├─ No → Use Standalone Mode
          │         Simpler, no bot setup required
          │
          └─ Yes → Use Integrated Mode
                    Benefits:
                    • Game history
                    • Player stats & win rates
                    • Voice control from website
                    • Bot commands (*call, *mute, etc.)
                    • Discord announcements
                    
                    Setup required:
                    • Invite Grimkeeper bot
                    • Run /autosetup or manual config
                    • Storytellers login with Discord
```

---

### Troubleshooting Common User Issues

**"I can't see the Start Game button"**
- Must be logged into Discord
- Must have entered valid session code
- Must have stat tracking enabled
- Must be host (not spectator)

**"My votes aren't showing up"**
- Check if "Secret Vote" is enabled (only host sees votes)
- Make sure you're not spectating
- Verify WebSocket connection (refresh page)

**"Discord logo not showing next to my name"**
- Must be logged into Discord on grimlive
- Must have stat tracking enabled
- Player needs to have discord_id field set (auto-syncs)

**"Mute/Unmute buttons not visible"**
- Must be host
- Must be logged into Discord
- Must have confirmed session code
- Must have active game (currentGameId exists)

**"Bot says 'No active game'"**
- Must run `/startgame` in Discord first
- Session must be in the BOTC category
- Make sure bot has permissions in the category

**"Stats not saving"**
- Verify session code matches Discord bot's code
- Check that game was started with "Start Game" button
- Ensure game was ended with "End Game" button (not just closed)
- Database connection must be working (check bot logs)

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GRIMLIVE SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   Browser    │◄────►│  WebSocket   │                    │
│  │   (Vue.js)   │      │    Server    │                    │
│  └──────────────┘      └──────┬───────┘                    │
│         ▲                     │                             │
│         │                     ▼                             │
│         │              ┌──────────────┐                    │
│         │              │  PostgreSQL  │                    │
│         │              │   Database   │                    │
│         │              └──────┬───────┘                    │
│         │                     │                             │
│         │                     ▼                             │
│         │              ┌──────────────┐                    │
│         └─────────────►│ Grimkeeper   │                    │
│           (OAuth)       │  Discord Bot │                    │
│                         └──────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
grimlive/
├── public/
│   ├── index.html              # Production entry point
│   ├── auth/
│   │   └── callback.html       # Discord OAuth callback
│   └── static/
│       ├── manifest.json       # PWA manifest
│       └── browserconfig.xml   # Windows tile config
├── server/
│   ├── index.js                # WebSocket + HTTP server
│   ├── api.js                  # API endpoint handlers
│   └── ecosystem.config.js     # PM2 configuration
├── src/
│   ├── main.js                 # Vue app entry point
│   ├── App.vue                 # Root component
│   ├── assets/                 # Images, fonts, sounds
│   ├── components/             # Vue components
│   │   ├── TownSquare.vue      # Player circle & voting
│   │   ├── Player.vue          # Individual player token
│   │   ├── Token.vue           # Role token display
│   │   ├── Menu.vue            # Sidebar controls
│   │   ├── Timer.vue           # Floating timer display
│   │   └── modals/             # Modal dialogs
│   ├── services/
│   │   └── stats.js            # Stats API client
│   ├── store/
│   │   ├── index.js            # Vuex root store
│   │   ├── persistence.js      # localStorage sync
│   │   ├── socket.js           # WebSocket manager
│   │   └── modules/
│   │       ├── session.js      # Session state
│   │       ├── players.js      # Player roster
│   │       ├── grimoire.js     # UI preferences
│   │       └── editionJSON.js  # Role data
│   └── utils/
│       └── images.js           # Asset loading helpers
├── package.json
├── vite.config.js              # Vite configuration
└── vue.config.js               # Legacy Vue CLI config
```

---

## Core Systems

### 1. WebSocket Communication

**Location:** `server/index.js` (server), `src/store/socket.js` (client)

#### Connection Flow

1. **Client connects** to `wss://api.hystericca.dev/` or `ws://localhost:8001`
2. **Server assigns channel** based on session ID from query params
3. **Client sends `"direct"` message** with player metadata
4. **Server broadcasts state** to all clients in the same channel
5. **Heartbeat** (ping/pong) every 30 seconds to detect disconnects

#### Message Types

**Client → Server:**
```javascript
{
  type: "direct",
  sessionId: "abc123",
  playerId: "host" | "player-uuid",
  name: "Player Name",
  pronouns: "they/them"
}
```

**Server → Client:**
```javascript
{
  // Session data
  sessionId: "abc123",
  isSpectator: false,
  nomination: [nominatorIndex, nomineeIndex],
  votes: { 0: 1, 2: 2 },  // playerIndex: voteCount
  lockedVote: 5,
  
  // Timer data
  timers: [{
    isActive: true,
    duration: 300,
    endTime: 1735123456789,
    isPaused: false
  }],
  
  // Player list
  players: [...],
  
  // Edition info
  edition: { id: "tb", name: "Trouble Brewing" }
}
```

#### WebSocket State Management

**Server-side** (`server/index.js`):
- `channels` object maps session IDs to arrays of WebSocket connections
- Each connection has `channel`, `playerId`, `isAlive`, and `isHost` properties
- Periodic cleanup (every 30s) removes dead connections
- Immediate cleanup on `ws.on('close')` event

**Client-side** (`src/store/socket.js`):
- Automatic reconnection on disconnect (with backoff)
- Queues messages during reconnect attempts
- Syncs local state changes to server via `sendGrimoire()` and `sendPlayers()`

### 2. Vuex Store Architecture

**Location:** `src/store/`

#### Store Modules

**`session` module** (`modules/session.js`)
- Session ID, player ID, connection state
- Voting state (nominations, votes, locked vote)
- Timer state (active, paused, duration)
- Settings (spectator mode, permissions)

**`players` module** (`modules/players.js`)
- Player roster (name, role, status, reminders)
- NPC fabled characters
- Bluff roles for demons
- Night order calculations

**`grimoire` module** (`modules/grimoire.js`)
- UI preferences (zoom, night order, public mode)
- Audio settings (muted state)
- Menu visibility

**`editionJSON` module** (`modules/editionJSON.js`)
- Role data from JSON imports
- Edition metadata (TB, S&V, BMR, experimental)

#### State Persistence

**Location:** `src/store/persistence.js`

Automatically saves state to `localStorage` on mutations:
- Player roster → `players`
- Player roles → `roles`
- Bluffs → `bluffs`
- Fabled → `fabled`
- Edition → `edition`
- Grimoire settings → `grimoire.{zoom,isPublic,isImageOptIn,...}`

**Restored on page load** in `main.js` before Vue app mounts.

### 3. Component Hierarchy

```
App.vue
├── TownSquare.vue (main game area)
│   ├── Player.vue (x20, arranged in circle)
│   │   ├── Token.vue (role icon)
│   │   └── Reminder tokens
│   └── Vote.vue (nominee display during voting)
├── Menu.vue (sidebar controls)
│   └── EditionModal (role selection)
│   └── RoleModal (assign role to player)
│   └── ...other modals
├── Timer.vue (floating timer overlay)
├── Gradients.vue (SVG definitions)
└── Intro.vue (welcome overlay)
```

#### Key Component Relationships

- **TownSquare** renders the player circle, handles drag-and-drop for seating
- **Player** manages individual player state, click handlers for voting/marking
- **Token** displays role icons with alignment (good/evil) styling
- **Menu** contains ALL game controls and settings
- **Timer** is a floating overlay, independent of other components

---

## Feature Documentation

### Session Management

#### Creating/Joining Sessions

**Host Flow:**
1. Click "Host (Storyteller)" in Menu
2. Client generates unique session ID (crypto.randomUUID())
3. Vuex commits `session/setSessionId` with `playerId: "host"`
4. WebSocket connects with session ID, sends player data
5. Server creates channel, broadcasts state to all clients

**Player Flow:**
1. Click "Join (Player)" in Menu (or open shared link)
2. Prompt for session ID
3. Vuex commits `session/setSessionId` with `playerId: uuid()`
4. WebSocket connects, sends player data
5. Server adds to existing channel, syncs state

**Spectator Mode:**
- Players can join as spectators (read-only)
- Cannot modify game state
- Can see votes if "Secret Vote" is disabled
- Can self-name and set pronouns

#### Session URL Sharing

**Format:** `https://grim.hystericca.dev/?session=abc123`

Query param automatically triggers join flow when page loads.

### Player Management

#### Adding/Removing Players

**Adding:**
- Click "Add" in Menu → Players tab
- Or press `[A]` key
- Creates empty player slot with default name "Player {N}"
- Maximum 20 players

**Removing:**
- Click player → menu → "Remove"
- Only available to host
- Player is removed from roster, other players shift to fill gap

**Randomize Seating:**
- Shuffles player order randomly
- Preserves roles and reminders
- Useful for game setup

#### Self-Naming

**Enabled by default for players:**
- Players can click their own token → "Set Name"
- Storyteller can toggle "Allow Self-Naming" to disable

**Pronouns:**
- Any player can set pronouns for themselves
- Displayed next to name in player token

### Role Assignment

#### Edition Selection

**Location:** Menu → Grimoire tab → Edition selector

**Available editions:**
- Trouble Brewing (TB)
- Sects & Violets (S&V)
- Bad Moon Rising (BMR)
- Custom/experimental scripts (loaded from JSON)

**Role data location:** `src/editions.json`, `src/characters.json`

#### Assigning Roles

1. Click player token
2. Select "Change Role" from menu
3. Role modal opens with edition's roles
4. Click role to assign
5. Role image and alignment automatically set

**Bulk assignment:**
- No built-in auto-assign feature
- Storyteller manually assigns each role
- Recommended: use external script tool, then manually input

#### Alignment

Each player has an alignment (Good, Evil, or custom):
- **alignmentIndex** determines background color
- Can be toggled via "Change Alignment" in player menu
- Independent of role team (for drunk, poisoned, etc.)

### Voting System

#### Starting a Nomination

**Host only:**
1. Click nominee player → shows hand cursor
2. Click nominator player (or same player for self-nomination)
3. Nomination banner appears showing "X nominates Y"
4. All players can now vote

#### Voting Mechanics

**Vote states per player:**
- **No vote** (default)
- **Hand up** (one vote)
- **Two hands up** (if player has "Two Votes" ability)
- **Hand down** (retracts vote)

**Vote locking:**
- As votes are cast, they "lock" in order around the circle
- Locked votes cannot be changed
- Only unlocked players can vote
- Lock advances as votes are confirmed

**Vote tallying:**
- Real-time count displayed
- Majority visible to all (or only host if "Secret Vote" enabled)

#### Vote Modes

**Secret Vote** (off by default):
- Players can only see their own vote
- Host sees all votes
- Vote count hidden until end

**Voting Twice** (off by default):
- Allows multiple players to have two votes
- Host can toggle per-player via "Two Votes" button
- Used for Mayor, Bureau, etc.

### Night Order System

**Location:** Players get `.night-order` overlay when enabled

**Enable:** Menu → Grimoire → Night Order (toggle)

**Calculated automatically:**
- First night order from role's `firstNight` property
- Other nights from role's `otherNight` property
- Numbers shown in orange overlays on player tokens
- Reminder text shown in overlay

**Implementation:**
- Computed property in `modules/players.js` → `nightOrder` getter
- Builds Map of player → {first: N, other: N}
- Filters out roles with no night action

### Reminder Tokens

**Purpose:** Track ongoing effects (poisoned, drunk, protected, etc.)

**Adding reminders:**
1. Click player token
2. Player menu appears
3. Bottom section shows available reminders for that player's role
4. Click reminder to add
5. Reminder appears as small token above player

**Viewing reminders:**
- Hover over player to see reminders in detail
- Each reminder shows icon and name
- Only visible to storyteller (hidden in public mode)

**Custom reminders:**
- Can add generic reminders (Info, Dead, Custom)
- Useful for homebrews or special game states

### Stats Integration

**Location:** `src/services/stats.js`

#### Discord OAuth Flow

1. Click "Log in with Discord" in Menu
2. Redirects to `/auth/discord?redirect_uri=...`
3. Discord OAuth consent screen
4. Callback to `/auth/callback` with code
5. Exchange code for access token
6. Fetch Discord user ID and username
7. Store in localStorage: `discordUserId`, `discordUsername`
8. Create web session via `/api/session/create`
9. Store session token in localStorage: `statsToken`

#### Session Code Linking

**Purpose:** Link website session to Discord bot's game tracking

**Flow:**
1. Storyteller runs `*game` command in Discord
2. Bot replies with session code (e.g., "s1", "s2")
3. Storyteller enters code in Menu → Session tab
4. Code stored in stats service: `selectedSessionCode`
5. Used for all subsequent API calls

#### Game Lifecycle

**Start Game:**
1. Click "Start Game" in Menu (requires Discord login + session code)
2. POST to `/api/game/start` with:
   - `script`: Edition name
   - `customName`: Script name (if custom)
   - `players`: Array of player names
   - `sessionCode`: Discord session code
3. Returns `gameId`
4. For each player with assigned role:
   - POST to `/api/player/add` with starting role
5. Bot receives announcement via database queue
6. Bot posts game start embed in Discord

**End Game:**
1. Click "End Game" in Menu
2. Modal appears: "Who won?"
3. Select Good or Evil
4. For each player:
   - POST to `/api/player/add` with final role (isFinal=true)
5. POST to `/api/game/end` with winner
6. Bot receives announcement via database queue
7. Bot posts game end embed with stats

**Stats tracked:**
- Player names and Discord IDs (if linked)
- Starting and final roles
- Script played
- Duration
- Winner
- Player count

#### Discord Player Linking

**Automatic:**
- When player joins website and is logged into Discord
- `discord_id` field populated in player data
- Synced via WebSocket

**Indicator:**
- Small Discord logo appears next to player name
- Only shown if stats tracking enabled + player has discord_id
- Computed property: `isStatsLinked` in Player.vue

### Timer System

**Location:** `src/components/Timer.vue`, `src/store/modules/session.js`

#### Starting a Timer

**From website:**
1. Click timer button in Menu → floating timer selector appears
2. Choose preset (1, 3, 5, 7 min) or custom duration
3. Sends WebSocket message: `sendTimer('start', duration, endTime)`
4. All clients receive timer state
5. Timer overlay appears for all players

**From Discord bot:**
- `*timer 5m` → syncs to website via API
- POST to `/api/timer/start`
- Bot tracks timer separately for auto-call feature

#### Timer Display

- **Countdown:** Shows MM:SS remaining
- **End time:** Displays target time (e.g., "Ends at 2:30 PM")
- **Progress bar:** Circular progress indicator
- **Sound:** Plays bell sound when timer completes

#### Pause/Resume

**Buttons:** Pause (⏸️) and Resume (▶️) buttons in Timer.vue

**State:**
- `isPaused`: Boolean flag
- `pausedTime`: Timestamp when paused
- `pausedRemaining`: Seconds remaining when paused

**Sync:** Pause/resume actions broadcast via WebSocket to all clients

**Discord integration:**
- Website pause/resume calls POST `/api/timer/pause` or `/resume`
- Grimkeeper bot mirrors the pause state

#### Auto-Stop

Timer stops when:
- Countdown reaches 0:00
- Stop button clicked
- New timer started (replaces old one)

### Mute/Unmute System

**NEW FEATURE** (implemented December 2025)

#### Purpose
Allows storyteller to mute/unmute all players in Discord voice channels directly from the website.

#### Button Visibility

Buttons appear when:
- User is host (`!session.isSpectator`)
- Logged into Discord (`isDiscordLinked`)
- Session code confirmed (`sessionCodeConfirmed`)
- Game is active (`currentGameId` exists)

#### Flow

1. Click "Mute All" or "Unmute All" in Menu
2. POST to `/api/mute` or `/api/unmute` with `sessionCode`
3. API validates session, queues announcement in database
4. Grimkeeper bot's announcement processor picks up the event
5. Bot calls `mute_from_website()` or `unmute_from_website()`
6. Bot mutes/unmutes all players in voice channels (excluding storytellers)
7. Bot posts announcement in Discord category (e.g., "🔇 Muted 7 players (from website)")

**Discord command equivalents:** `*mute` and `*unmute`

---

## API Reference

**Base URL:** `https://api.hystericca.dev/api` (prod) or `http://localhost:8001/api` (dev)

### Authentication

Most endpoints require a session token obtained via Discord OAuth.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Endpoints

#### Session Management

**`POST /session/create`**
- Creates a new stats tracking session
- Body: `{ discord_user_id: number }` (optional)
- Returns: `{ token: string, sessionId: string }`

**`POST /session/update-discord`**
- Links Discord user to existing session
- Auth required
- Body: `{ discord_user_id: number }`
- Returns: `{ success: boolean }`

#### Game Management

**`POST /game/start`**
- Starts a new game
- Auth required
- Body:
  ```json
  {
    "script": "Trouble Brewing",
    "customName": "",
    "players": ["Alice", "Bob"],
    "sessionCode": "s1"
  }
  ```
- Returns: `{ gameId: number }`
- Side effect: Queues game_start announcement for Discord bot

**`POST /game/end`**
- Ends current game
- Auth required
- Body: `{ winner: "Good" | "Evil" }`
- Returns: `{ success: boolean }`
- Side effect: Queues game_end announcement for Discord bot

**`POST /player/add`**
- Adds or updates a player in the current game
- Auth required
- Body:
  ```json
  {
    "gameId": 123,
    "playerName": "Alice",
    "seatNumber": 1,
    "roleId": "washerwoman",
    "roleName": "Washerwoman",
    "team": "townsfolk",
    "isFinal": false,
    "discordId": 123456789
  }
  ```
- Returns: `{ playerId: number }`
- Note: `isFinal=true` for final roles at game end

**`POST /player/death`**
- Records player death time
- Auth required
- Body: `{ playerId: number }`
- Returns: `{ success: boolean }`

**`GET /stats/game/:gameId`**
- Fetches game statistics
- No auth required
- Returns: `{ players: [...] }`

#### Timer Control

**`POST /timer/start`**
- Starts a timer
- Body: `{ sessionCode: string, duration: number, endTime: number }`
- Returns: `{ success: boolean }`

**`POST /timer/stop`**
- Stops the timer
- Body: `{ sessionCode: string }`
- Returns: `{ success: boolean }`

**`POST /timer/pause`**
- Pauses the timer
- Body: `{ sessionCode: string }`
- Returns: `{ success: boolean }`

**`POST /timer/resume`**
- Resumes the timer
- Body: `{ sessionCode: string }`
- Returns: `{ success: boolean }`

#### Voice Control

**`POST /mute`**
- Mutes all players in Discord voice channels
- Body: `{ sessionCode: string }`
- Returns: `{ success: boolean, message: string }`
- Side effect: Queues mute announcement for Discord bot

**`POST /unmute`**
- Unmutes all players in Discord voice channels
- Body: `{ sessionCode: string }`
- Returns: `{ success: boolean, message: string }`
- Side effect: Queues unmute announcement for Discord bot

#### OAuth

**`GET /auth/discord?redirect_uri=...`**
- Initiates Discord OAuth flow
- Redirects to Discord authorization page

**`GET /auth/callback?code=...`**
- OAuth callback endpoint
- Exchanges code for access token
- Fetches user info
- Redirects back to app with user data in hash

---

## Data Models

### Player Object

```typescript
interface Player {
  name: string;              // Display name
  id: string;                // Unique ID (host or UUID)
  discord_id?: number;       // Discord user ID if linked
  connected: boolean;        // WebSocket connection status
  role: Role;                // Assigned role
  alignmentIndex: number;    // 0=good, 1=evil, 2+=custom
  reminders: Reminder[];     // Active reminder tokens
  isVoteless: boolean;       // Cannot vote (Butler, drunk, etc.)
  hasTwoVotes: boolean;      // Has 2 votes (Mayor, etc.)
  isDead: boolean;           // Ghost status
  pronouns: string;          // Preferred pronouns
  hasResponded: {            // Tracking for nominations
    [key: string]: boolean;
  };
}
```

### Role Object

```typescript
interface Role {
  id: string;                // e.g., "washerwoman"
  name: string;              // "Washerwoman"
  team: string;              // "townsfolk", "outsider", "minion", "demon", "traveller", "fabled"
  ability: string;           // Role ability text
  image: string;             // Icon filename
  edition: string;           // "tb", "snv", "bmr"
  firstNight: number;        // Night order (0 = no action)
  otherNight: number;        // Night order (0 = no action)
  firstNightReminder: string;
  otherNightReminder: string;
  reminders: string[];       // Available reminder tokens
  setup: boolean;            // Setup role (Drunk, Marionette, etc.)
  isCustom?: boolean;        // From custom script
}
```

### Session State

```typescript
interface SessionState {
  sessionId: string;         // Unique session ID
  playerId: string;          // "host" or player UUID
  isSpectator: boolean;      // Read-only mode
  playerCount: number;       // Total players in session
  ping: number;              // Latency to server (ms)
  
  // Voting
  nomination: [number, number] | false;  // [nominator, nominee] indices
  votes: { [playerIndex: number]: number };  // vote count per player
  lockedVote: number;        // Index of last locked vote
  votingSpeed: number;       // Vote lock delay (ms)
  isVoteInProgress: boolean;
  
  // Permissions
  allowSelfNaming: boolean;
  isVoteWatchingAllowed: boolean;  // Can spectators see votes?
  isTwoVotesEnabled: boolean;
  
  // Marking (storyteller tool)
  markedPlayer: number;      // Index of marked player (or -1)
  
  // Timer
  timers: [{
    isActive: boolean;
    duration: number;        // Total duration (seconds)
    endTime: number;         // Unix timestamp
    isPaused: boolean;
    pausedTime: number;      // When paused
    pausedRemaining: number; // Seconds left when paused
  }];
}
```

### Grimoire State

```typescript
interface GrimoireState {
  zoom: number;              // -10 to 10
  isNightOrder: boolean;     // Show night order overlays
  isPublic: boolean;         // Public mode (hides roles)
  isImageOptIn: boolean;     // Load custom role images
  isMuted: boolean;          // Audio disabled
  isMenuOpen: boolean;       // Sidebar visible
  isScreenshot: boolean;     // Screenshot mode (hide UI)
  isScreenshotSuccess: boolean;
  background: string;        // Background style
}
```

---

## Development Workflow

### Local Setup

1. **Clone repository:**
   ```bash
   git clone https://github.com/gorewife/grimlive.git
   cd grimlive
   ```

2. **Install dependencies:**
   ```bash
   bun install  # or npm install
   ```

3. **Environment variables:**
   Create `.env` file:
   ```bash
   DATABASE_URL=postgresql://localhost/grimlive_dev
   DISCORD_CLIENT_ID=your_discord_app_id
   DISCORD_CLIENT_SECRET=your_discord_app_secret
   DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
   ```

4. **Start dev server:**
   ```bash
   bun run dev
   ```
   - Frontend: http://localhost:5173
   - WebSocket: ws://localhost:8001

### Development Commands

```bash
# Frontend dev server (Vite)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run WebSocket server only
node server/index.js

# Format code
bun run format  # or npm run format
```

### Database Setup

**PostgreSQL required for stats features.**

1. Create database:
   ```sql
   CREATE DATABASE grimlive_dev;
   ```

2. Run migrations (from grimkeeper repo):
   ```bash
   psql -d grimlive_dev -f migrations/001_initial_schema.sql
   ```

3. Tables needed:
   - `web_sessions` - OAuth sessions
   - `games` - Game records
   - `game_players` - Player stats per game
   - `sessions` - Discord session codes
   - `announcements` - Queue for bot notifications

### Testing Locally

**WebSocket connection:**
- Open multiple browser windows
- One as host, others as players
- Changes in one window should reflect in others instantly

**Stats integration:**
- Requires Discord app credentials
- Test OAuth flow with localhost redirect
- Verify session code linking with mock data

**Timer sync:**
- Start timer in one client
- Should appear in all connected clients
- Test pause/resume across clients

### Common Development Issues

**WebSocket won't connect:**
- Check port 8001 is not in use
- Verify `NODE_ENV` not set to production locally
- Check firewall/antivirus blocking WebSocket

**Stats not saving:**
- Database connection failed → check `DATABASE_URL`
- Session token expired → re-login with Discord
- Missing migrations → run SQL scripts

**Players not syncing:**
- WebSocket disconnect → check console for errors
- State not persisted → check localStorage
- Vuex module not registered → check `store/index.js`

---

## Deployment

### Production Setup

**Current production:** grim.hystericca.dev (Cloudflare Pages + EC2 backend)

**Frontend (Cloudflare Pages):**
1. Build: `bun run build`
2. Deploy `dist/` folder to Cloudflare Pages
3. Environment variables set in Cloudflare dashboard
4. Custom domain: grim.hystericca.dev

**Backend (AWS EC2):**
1. SSH into server
2. Pull latest code
3. Install dependencies: `npm install`
4. Build if needed
5. Restart PM2: `pm2 restart ecosystem.config.js`
6. WebSocket endpoint: wss://api.hystericca.dev/

**Database (PostgreSQL on EC2):**
- Shared with grimkeeper bot
- Automatic backups via cron
- Connection pooling enabled

### PM2 Configuration

**`server/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'grimlive-api',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8001
    }
  }]
};
```

**Commands:**
```bash
pm2 start ecosystem.config.js
pm2 logs grimlive-api
pm2 restart grimlive-api
pm2 stop grimlive-api
```

### Environment Variables (Production)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/grimlive

# Discord OAuth
DISCORD_CLIENT_ID=your_production_app_id
DISCORD_CLIENT_SECRET=your_production_secret
DISCORD_REDIRECT_URI=https://grim.hystericca.dev/auth/callback

# Server
NODE_ENV=production
PORT=8001

# SSL (if using HTTPS)
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### Monitoring

**Logs:**
- PM2 logs: `pm2 logs grimlive-api`
- Server logs: `tail -f ~/grimlive/logs/server.log`

**Metrics:**
- WebSocket connections: Check `channels` object size
- Database connections: Monitor PostgreSQL connections
- API response times: Add timing middleware

**Health check:**
```bash
curl https://api.hystericca.dev/health
```

### Backup & Recovery

**Database backups:**
```bash
# Automated daily backup
pg_dump grimlive > backup_$(date +%Y%m%d).sql

# Restore
psql grimlive < backup_20231227.sql
```

**Code backups:**
- Git repository (primary backup)
- EC2 snapshots (infrastructure backup)

---

## Appendix

### WebSocket Protocol Details

**Connection URL:**
```
wss://api.hystericca.dev/?session=abc123
```

**Ping/Pong:**
- Server sends ping every 30 seconds
- Client must respond with pong
- Connection terminated after 3 missed pongs

**Reconnection:**
- Client attempts reconnect on disconnect
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
- Session state preserved in localStorage

### Performance Optimization

**Bundle size:**
- Code splitting per route
- Lazy-load edition data
- Compress images (WebP)

**Runtime performance:**
- Virtualize player list for 20+ players
- Debounce WebSocket sends
- Use CSS transforms for animations

**Network:**
- WebSocket compression enabled
- HTTP/2 for API requests
- CDN for static assets (Cloudflare)

### Security Considerations

**Authentication:**
- Discord OAuth tokens stored in httpOnly cookies (future)
- Currently uses localStorage (not ideal for XSS)
- CORS enabled for api.hystericca.dev

**Input validation:**
- Session IDs: UUID v4 format only
- Player names: Max 50 chars, sanitized
- Role IDs: Validated against edition data

**WebSocket:**
- Rate limiting per connection (future)
- Message size limit: 100KB
- Heartbeat to detect zombie connections

### Browser Compatibility

**Supported browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari/Chrome (iOS 14+, Android 10+)

**Required features:**
- WebSocket API
- ES6 (let, const, arrow functions)
- CSS Grid
- LocalStorage

**PWA support:**
- Service worker for offline mode
- App manifest for "Add to Home Screen"

### Roadmap

**Planned features:**
- [ ] Undo/redo system for role changes
- [ ] Script builder/editor
- [ ] Character reference cards
- [ ] Voice chat integration (WebRTC)
- [ ] Mobile app (React Native)
- [ ] Internationalization (i18n)

**Technical debt:**
- Migrate to TypeScript
- Add unit tests (Vitest)
- Add E2E tests (Playwright)
- Improve error handling
- Add logging/monitoring

---

## Optimization Opportunities

### High-Impact Improvements

#### 1. **Migrate from Vue 2 to Vue 3 Composition API**

**Current state:** Mixed usage - Vue 3 installed but components still use Options API

**Issues:**
- Harder to reuse logic across components
- Less type-safe (if migrating to TypeScript)
- More boilerplate code

**Benefit:** 
- Better code organization and reusability
- Improved TypeScript support
- Smaller bundle size (~20-30% reduction)
- Better performance with reactive system

**Example refactor:**
```javascript
// Current (Options API) in Menu.vue
export default {
  computed: {
    isDiscordLinked() {
      this.updateKey;
      return !!localStorage.getItem('discordUserId');
    }
  },
  data() {
    return { updateKey: 0 }
  }
}

// After (Composition API)
import { ref, computed } from 'vue'
export default {
  setup() {
    const discordUserId = ref(localStorage.getItem('discordUserId'))
    const isDiscordLinked = computed(() => !!discordUserId.value)
    return { isDiscordLinked }
  }
}
```

**Effort:** High (requires refactoring 20+ components)  
**Priority:** Medium

---

#### 2. **Replace Force-Update Pattern with Proper Reactivity**

**Current issue:** Components use `updateKey` hack to force computed properties to re-evaluate:

```javascript
// Bad pattern (currently in Menu.vue)
data() {
  return { updateKey: 0 }
},
computed: {
  isDiscordLinked() {
    this.updateKey; // Force reactivity
    return !!localStorage.getItem('discordUserId');
  }
}
```

**Problems:**
- Not actually reactive - only updates when `updateKey` manually incremented
- Requires manual tracking of when to update
- Breaks Vue's reactivity system

**Solution:** Use Vuex store or proper reactive refs

```javascript
// Better: Store in Vuex
// store/modules/session.js
state: {
  discordUserId: localStorage.getItem('discordUserId') || null
},
mutations: {
  setDiscordUser(state, userId) {
    state.discordUserId = userId;
    localStorage.setItem('discordUserId', userId);
  }
}

// Component
computed: {
  ...mapState('session', ['discordUserId']),
  isDiscordLinked() {
    return !!this.discordUserId;
  }
}
```

**Effort:** Low (few hours)  
**Priority:** **HIGH** - Fixes bugs and improves maintainability

---

#### 3. **Centralize Stats Service with Vuex**

**Current issue:** Stats service (`stats.js`) manages state outside Vuex:

```javascript
// stats.js stores state in class properties
class Stats {
  constructor() {
    this.currentGameId = null;
    this.sessionCode = null;
  }
}
```

**Problem:**
- Vue can't track changes to these properties
- Components can't reactively update when stats change
- Requires the `updateKey` hack mentioned above

**Solution:** Migrate stats to Vuex module

```javascript
// store/modules/stats.js
export default {
  namespaced: true,
  state: {
    currentGameId: null,
    sessionCode: null,
    discordUserId: null,
    trackingEnabled: localStorage.getItem('statTrackingEnabled') === 'true'
  },
  mutations: {
    setGameId(state, id) { state.currentGameId = id },
    setSessionCode(state, code) { 
      state.sessionCode = code;
      localStorage.setItem('selectedSessionCode', code);
    }
  },
  actions: {
    async startGame({ commit, state }, payload) {
      const response = await fetch('/api/start', { ... });
      const data = await response.json();
      commit('setGameId', data.game_id);
    }
  }
}
```

**Effort:** Medium (1-2 days)  
**Priority:** **HIGH** - Enables proper reactivity

---

#### 4. **Implement WebSocket Message Queue & Reconnection**

**Current issue:** No guaranteed message delivery if connection drops

**Problems:**
- Messages sent during disconnection are lost
- No automatic retry for failed sends
- Players might desync if reconnecting

**Solution:** Add message queue with retry logic

```javascript
// server/index.js enhancement
class ConnectionManager {
  constructor(ws, sessionId) {
    this.ws = ws;
    this.messageQueue = [];
    this.isConnected = true;
  }
  
  send(message) {
    if (this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        this.messageQueue.push(message);
        this.isConnected = false;
      }
    } else {
      this.messageQueue.push(message);
    }
  }
  
  reconnect(newWs) {
    this.ws = newWs;
    this.isConnected = true;
    // Replay queued messages
    while (this.messageQueue.length) {
      this.send(this.messageQueue.shift());
    }
  }
}
```

**Effort:** Medium (1-2 days)  
**Priority:** Medium - Improves reliability

---

#### 5. **Add Request/Response Pattern to WebSocket**

**Current issue:** All WebSocket messages are fire-and-forget

**Problem:**
- Can't confirm if state changes succeeded
- No way to handle errors from failed updates
- Hard to implement optimistic UI updates

**Solution:** Add message IDs and acknowledgments

```javascript
// Client side
class WebSocketClient {
  send(type, data) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => reject('timeout'), 5000);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify({ id, type, data }));
    });
  }
  
  handleMessage(msg) {
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const { resolve, timeout } = this.pendingRequests.get(msg.id);
      clearTimeout(timeout);
      resolve(msg.data);
      this.pendingRequests.delete(msg.id);
    }
  }
}

// Usage in component
async updatePlayer(player) {
  try {
    await this.$socket.send('player/update', player);
    // Success!
  } catch (err) {
    alert('Failed to update player: ' + err);
  }
}
```

**Effort:** High (affects all WebSocket message handling)  
**Priority:** Low - Nice to have, not critical

---

### Medium-Impact Improvements

#### 6. **Migrate localStorage to IndexedDB**

**Current issue:** localStorage used for large data (game state, etc.)

**Problems:**
- 5-10MB limit (can hit with large games)
- Synchronous API blocks main thread
- No structured query capabilities

**Solution:** Use IndexedDB for persistent state

```javascript
// utils/db.js
const db = await openDB('grimlive', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    db.createObjectStore('preferences');
  }
});

// Store/retrieve session
await db.put('sessions', sessionData);
const session = await db.get('sessions', sessionId);
```

**Effort:** Medium  
**Priority:** Low (only needed for power users with many sessions)

---

#### 7. **Add TypeScript (Incremental Migration)**

**Current state:** Pure JavaScript with no type checking

**Benefits:**
- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

**Approach:** Start with new files, gradually convert

```typescript
// types/player.ts
export interface Player {
  id: string;
  name: string;
  role?: Role;
  isDead: boolean;
  isVoteless: boolean;
  pronouns?: string;
  discord_id?: string;
}

// components/Player.vue
<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { Player } from '@/types/player';

export default defineComponent({
  props: {
    player: {
      type: Object as PropType<Player>,
      required: true
    }
  }
});
</script>
```

**Effort:** High (ongoing)  
**Priority:** Medium - Long-term maintainability

---

#### 8. **Optimize Bundle Size with Code Splitting**

**Current issue:** Entire app loaded upfront (~500KB+ JS)

**Solution:** Lazy-load routes and modals

```javascript
// router.js - lazy load routes
const routes = [
  {
    path: '/game',
    component: () => import('./views/Game.vue') // Lazy loaded
  }
];

// Lazy load modals
const EditionModal = defineAsyncComponent(() =>
  import('./components/modals/EditionModal.vue')
);
```

**Benefit:** 
- Initial load: 200KB → ~100KB
- Faster first paint
- Better mobile performance

**Effort:** Low (1 day)  
**Priority:** **HIGH** - Easy win for performance

---

#### 9. **Add Error Boundaries**

**Current issue:** Component errors crash entire app

**Solution:** Vue 3 error handling

```javascript
// App.vue
app.config.errorHandler = (err, instance, info) => {
  console.error('Error:', err);
  console.error('Component:', instance);
  console.error('Info:', info);
  
  // Show user-friendly error
  store.commit('showError', {
    message: 'Something went wrong. Please refresh.',
    details: err.message
  });
};
```

**Effort:** Low  
**Priority:** Medium

---

#### 10. **Add Database Connection Pooling (Server)**

**Current issue:** New connection per API request

```javascript
// Current: api.js
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect(); // New connection each time
```

**Problem:**
- Slow (connection overhead ~50-100ms)
- Can exhaust connection limit under load
- Not necessary for simple queries

**Solution:** Already using pool correctly! But could optimize:

```javascript
// Use transactions for multi-step operations
async startGame(sessionCode, players) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query('INSERT INTO games ...');
    await client.query('INSERT INTO game_players ...');
    await client.query('COMMIT');
    return game;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**Effort:** Low  
**Priority:** Low (current code is already decent)

---

### Summary: Prioritized Action Plan

#### **Phase 1: Quick Wins (1-2 weeks)**
1. ✅ Replace `updateKey` hack with Vuex reactivity
2. ✅ Implement code splitting for modals/routes
3. ✅ Add error boundaries/global error handler
4. ✅ Centralize stats service in Vuex

**Impact:** Fixes bugs, improves performance, better UX

#### **Phase 2: Quality Improvements (1 month)**
5. Add TypeScript to new code (incremental)
6. Implement WebSocket message queue
7. Add unit tests for critical functions (stats API, role assignment)

**Impact:** Better reliability, easier debugging

#### **Phase 3: Long-Term (Ongoing)**
8. Migrate to Composition API (component by component)
9. Add E2E tests for user flows
10. Implement IndexedDB if needed

**Impact:** Maintainability, scalability

---

### Is It Worth It?

**Honest assessment:**

**Must-fix issues:**
- ✅ `updateKey` reactivity hack - causes subtle bugs
- ✅ Code splitting - easy performance win
- ✅ Stats in Vuex - makes code more maintainable

**Nice-to-have:**
- TypeScript - helps for large refactors but adds overhead
- Composition API - better patterns but requires rewriting components
- WebSocket improvements - current solution works for small sessions

**Probably overkill:**
- IndexedDB - localStorage is fine for current usage
- Request/response WebSocket - adds complexity, fire-and-forget works

**Recommendation:** Focus on Phase 1 (quick wins) first. The codebase is actually pretty well-structured for a real-time web app - the main issues are reactivity patterns and bundle size, both easily fixable.

---

## Contributing

**Repository:** https://github.com/gorewife/grimlive

**Issues:** GitHub Issues for bug reports and feature requests

**Pull requests:** Welcome! Please follow existing code style.

**Code style:**
- 2 spaces for indentation
- Semicolons optional (Prettier default)
- Vue components: Options API preferred (legacy codebase)
- Comments: Explain *why*, not *what*

---

## License

MIT License - See LICENSE file

---

## Credits

**Original author:** gorewife  
**Contributors:** Check GitHub contributors page  
**Blood on the Clocktower:** The Pandemonium Institute  

---

*This guide is a living document. Last updated December 27, 2025.*
