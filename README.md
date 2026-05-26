# 🔤 Word Hunt — Rated Competitive

A Chess.com-style competitive word game built on GamePigeon's Word Hunt rules.  
Real-time multiplayer · ELO rating system · Solo + Matchmaking + Private rooms

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + Socket.io |
| Database | Supabase (Postgres + Auth) |
| State | Zustand (persisted) |
| Styling | Pure CSS variables (dark theme) |

---

## Project Structure

```
wordhunt/
├── client/                  # React frontend
│   └── src/
│       ├── components/
│       │   └── GameBoard.tsx      # Touch/mouse drag grid
│       ├── pages/
│       │   ├── AuthPage.tsx       # Sign up / sign in / guest
│       │   ├── HomePage.tsx       # Profile + ELO card + nav
│       │   ├── LobbyPage.tsx      # Matchmaking + private rooms
│       │   ├── GamePage.tsx       # Live game
│       │   ├── ResultsPage.tsx    # ELO change + missed words
│       │   └── LeaderboardPage.tsx
│       └── lib/
│           ├── gameLogic.ts       # Trie, scoring, adjacency
│           ├── socket.ts          # Socket.io singleton
│           ├── store.ts           # Zustand global state
│           └── api.ts             # REST API helpers
├── server/
│   └── src/
│       ├── index.ts               # Express + Socket.io server
│       ├── routes.ts              # REST endpoints
│       ├── socket.ts              # Game rooms + matchmaking
│       ├── gameLogic.ts           # Server-side word validation
│       └── db.ts                  # Supabase helpers
└── supabase/
    └── migrations/001_initial.sql # DB schema
```

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd wordhunt
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial.sql` in the **SQL Editor**
3. Copy your project URL and keys

### 3. Configure environment

**Server** (`server/.env`):
```env
PORT=3001
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service_role key (Settings → API)
CLIENT_URL=http://localhost:5173
```

**Client** (`client/.env`):
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # anon key (Settings → API)
VITE_SERVER_URL=http://localhost:3001
```

### 4. Run development

```bash
npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001

---

## Game Rules (GamePigeon-accurate)

### Board
- 4×4 grid of letters, 16 tiles
- Letter frequencies match GamePigeon (heavy vowel weighting, realistic consonant distribution)

### Word finding
- Trace connected paths through adjacent tiles (including diagonal)
- Each tile can only be used once per word
- Minimum word length: **3 letters**
- Must be a valid English word

### Scoring (exact GamePigeon values)

| Word Length | Points |
|---|---|
| 3 letters | 100 |
| 4 letters | 400 |
| 5 letters | 800 |
| 6 letters | 1,400 |
| 7 letters | 1,800 |
| 8+ letters | 2,200 |

### Timer
- **80 seconds** per game

---

## ELO System

### Solo Mode
ELO adjusts based on percentage of max possible board score achieved:

```
expected_pct = min(0.85, 0.15 + elo / 4000)
delta = round(K × (actual_pct - expected_pct) × 2.5)
delta = clamp(delta, -30, +50)
```

A 1200-rated player is expected to find ~45% of the board.  
Finding more gains ELO; less loses ELO.

### Multiplayer (Matchmaking / Private)
Standard ELO formula:

```
expected = 1 / (1 + 10^((opponent_elo - your_elo) / 400))
delta = round(K × (result - expected))   # result: 1=win, 0=loss
K = 32
```

### Why board-relative scoring?
Some boards have many short words (low ceiling), others have long rare words (high ceiling). By comparing your score to the **maximum possible score for that specific board**, every game is fair regardless of difficulty.

---

## Ranks

| Rank | ELO Range | Icon |
|---|---|---|
| Novice | 0 – 999 | 🔰 |
| Scholar | 1,000 – 1,199 | 📚 |
| Wordsmith | 1,200 – 1,499 | ✍️ |
| Lexicon | 1,500 – 1,799 | 📖 |
| Grandmaster | 1,800+ | 👑 |

---

## Matchmaking

- Rated players are matched within **±200 ELO**
- Queue window widens every 15 seconds if no match is found
- If no match after 30s, client can fall back to a bot game

---

## Deployment

### Server (Railway / Render / Fly.io)
```bash
cd server
npm run build
npm start
```
Set environment variables in your hosting dashboard.

### Client (Vercel / Netlify)
```bash
cd client
npm run build
# Deploy the dist/ folder
```
Set `VITE_SERVER_URL` to your production server URL.

### Supabase
- Enable **Email auth** in Authentication → Providers
- Enable **Anonymous sign-ins** for guest play
- Set your production domain in Authentication → URL Configuration

---

## Socket Events Reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `user:join` | `{userId, username}` | Authenticate socket |
| `solo:start` | `{userId, username}` | Start solo rated game |
| `match:queue` | `{userId, username}` | Enter matchmaking queue |
| `match:dequeue` | `{userId}` | Leave queue |
| `private:create` | `{userId, username}` | Create private room |
| `private:join` | `{userId, username, code}` | Join private room |
| `word:submit` | `{userId, word, roomId}` | Submit a found word |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `game:start` | `{board, allWords, maxPossible, duration, players}` | Game begins |
| `game:tick` | `{timeLeft}` | Timer update (every second) |
| `word:result` | `{word, status, score, total}` | Word validation result |
| `opponent:score` | `{score, wordCount}` | Opponent score update |
| `game:end` | `{results, allWords, maxPossible}` | Game finished |
| `match:found` | `{roomId}` | Match made |
| `private:created` | `{code, roomId}` | Room created |

---

## Extending

### Add more words
Edit `WORD_LIST` in `server/src/gameLogic.ts` and `client/src/lib/gameLogic.ts`.  
Both files must stay in sync (or extract to a shared package).

### Add a bot mode
In `server/src/socket.ts`, add a `bot:start` event handler that simulates an opponent by scheduling `word:submit` events from the bot at realistic intervals, using words from `allWords` filtered by bot skill level.

### Add tournaments
Add a `tournaments` table in Supabase and create bracket logic in the server. ELO applies normally at the game level.

### Push notifications (score updates)
Use Supabase Realtime to subscribe to the `games` table for live score feeds on the leaderboard.

---

## License

MIT
