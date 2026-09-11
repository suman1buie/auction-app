# Live Auction Floor

Realtime virtual auction room. Create a session, share role-based invite links, list players, assign team presenters, then run live bidding with a bid clock and in-room voice.

Server storage uses SQLite so auction rooms persist across server restarts.

## Features

- Virtual auction room with a shareable code
- Role-based links: auctioneer, spectator, and team-specific presenter links
- Every invite join requires one shared room password
- Different room views for auctioneer, presenter, and spectator
- Player dashboard (name, position, base price, notes)
- Random animated avatar for each player profile
- Teams with purse / remaining budget
- Presenters are auto-bound to a team from their invite link
- Auctioneer controls: start/pause, call a random player, hammer sold/unsold
- Optional manual close mode: auctioneer can use Sold/Unsold instead of auto timeout close
- After auction start, only spectators can newly join the room
- Bid timer auto-completes a lot when it hits zero
- Highest valid bid wins the player
- Live details board: sold and unsold players with team mapping
- Browser voice chat (WebRTC mesh, Socket.IO signaling)
- SQLite-backed room persistence on the server
- Optional app-level HTTP Basic Authentication (recommended for hosting)

## Run locally

```bash
npm install
npm run dev
```

That starts:

- API / Socket.IO server on `http://localhost:3001`
- Vite UI on `http://localhost:5173`

Open the UI, create a room as the auctioneer, copy the presenter and spectator links, and join from other browser tabs.
Share the room password shown in the auctioneer invite panel; all invite joins require it.

```bash
npm test
npm run build
```

## How a session works

1. Auctioneer creates the room and (optionally) loads demo data.
2. Add players and teams before going live.
3. Share the team-specific presenter link with one person per team.
4. Start the auction, then **Call random player**.
5. Presenters bid. The clock resets on each valid bid.
6. Use **Auto complete lot on timeout** ON for automatic close at 0, or OFF to close manually with **Sold now** / **Unsold now**.
7. Once started, new joins are spectator-only.
8. Join **Room voice** to speak. Allow microphone access.

Auctions persist in SQLite, so restarting the backend keeps existing rooms and auction state.

## Docker Hosting

Build image:

```bash
docker build -t live-auction-floor .
```

Run container:

```bash
docker run -d --name live-auction-floor -p 3001:3001 -v auction_data:/app/server/data live-auction-floor
```

Or run with compose:

```bash
docker compose up -d --build
```

Set authentication credentials (recommended):

```bash
export BASIC_AUTH_USER="your-admin-user"
export BASIC_AUTH_PASS="your-strong-password"
docker compose up -d --build
```

Open:

- http://localhost:3001

Notes:

- The container serves both frontend and Socket.IO backend from the same port.
- SQLite data is persisted in /app/server/data using a Docker volume.
- Every invite join requires the shared room password shown to the auctioneer.
- In production, HTTP Basic Authentication is enabled by default.
- Configure credentials with BASIC_AUTH_USER and BASIC_AUTH_PASS.
- For local development, Basic Auth is disabled by default unless BASIC_AUTH_ENABLED=true.
