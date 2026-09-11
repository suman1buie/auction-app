# Live Auction Floor

Realtime virtual auction application.

- Stack: Vite + React (frontend), Express + Socket.IO (backend), WebRTC voice
- Roles: auctioneer, team presenter, spectator via invite tokens
- Auctioneer lists players/teams, starts the room, calls a random player, and hammers sold/unsold
- Presenters claim a team and bid from that team's purse
- Bid clock auto-completes a lot when time hits zero
- Speaking uses mesh WebRTC audio relayed through Socket.IO signaling
