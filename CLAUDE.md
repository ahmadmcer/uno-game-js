# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

npm-workspaces monorepo with two workspaces: `server` and `client`. Run everything from the repo root.

```bash
npm install          # installs both workspaces
npm run dev          # server (node --watch, port 3001) + client (Vite, port 5173) concurrently
npm test             # server unit tests (vitest run)
npm run build        # builds client into client/dist
npm start            # production: server serves client/dist on port 3001
```

Run a single test file: `npm test -w server -- test/game.test.js` (or `npx vitest` inside `server/` for watch mode). All tests live in `server/test/`; the client has no tests and there is no linter.

Docker: `docker compose up -d --build`, or `docker build -t ahmadmcer/uno-game-js .` — multi-stage build that compiles the client and runs the server on 3001.

## Architecture

Online multiplayer UNO. The **server is authoritative**: clients never see other players' hands, and all moves are validated server-side. The client and server communicate only over Socket.IO events (`room:*` and `game:*`); in dev, Vite proxies `/socket.io` to port 3001.

### Server (`server/src/`) — ESM, Express + Socket.IO

Strictly layered; keep game logic free of I/O:

- `game/` — **pure game logic, no socket/timer knowledge**:
  - `deck.js` — 108-card deck builder and shuffle.
  - `rules.js` — card-match predicates (`canPlay`, `canJumpIn`) shared by the engine and the bot.
  - `game.js` — the `Game` class turn engine: play/draw/pass/UNO calls, stacking, reverse-as-skip in 2-player, reshuffles, win detection. Invalid moves throw `GameError`; state events accumulate via `event()` and are drained with `takeEvents()`. `stateFor(viewerId)` produces the per-player view (only the viewer's own hand).
  - `bot.js` — `botAction(game, botId)` returns a `{type, cardId, color}` decision from public + own-hand state; it never mutates the game.
- `rooms.js` — `RoomManager`: 4-letter room codes, player/bot seats, token→room lookup. No socket knowledge.
- `socket.js` — all Socket.IO glue: event handlers, bot turn scheduling (timers on the room), UNO-catch timers, disconnect grace periods, and broadcasting. Handlers wrapped by `on()` convert thrown `GameError`s into `game:error` emissions; any other exception is logged and sent as a generic message — so game-logic code signals user-facing failures by throwing `GameError`.
- `index.js` — HTTP server; also statically serves `client/dist` when it exists (production mode).

The Socket.IO contract doubles as a public bot API: `docs/API.md` documents every event and the `stateFor` shape for external bot authors, and `examples/bot.mjs` is a standalone reference client. When changing socket events or the state shape, update both.

### Identity and reconnection

Clients generate a per-tab session token (`sessionStorage`) and send it in `socket.handshake.auth.token`. The server keys everything off this token, not the socket id: reconnecting with the same token rejoins your seat, and private game state is emitted to the `player:${token}` socket room. Disconnects start grace timers — in a live game a bot takes over the seat (`takeover` flag) rather than removing the player; leaving mid-game detaches the token but keeps the seat bot-controlled so the game isn't disrupted.

### Client (`client/src/`) — React 18 + Vite

`App.jsx` owns all state, fed entirely by socket events (`me`, `room:update`, `game:state`, `game:event`, `game:error`), and picks the screen: `Home` → `Lobby` → `GameTable`. It also emits `game:sync` every 4s as a resync safety net. `client/src/rules.js` deliberately mirrors the server's validation **for UI highlighting only** — keep it in sync with `server/src/game/rules.js` when play rules change, but never rely on it for enforcement.

### Cross-cutting: adding a house rule

House rules (`stacking`, `drawUntilPlayable`, `jumpIn`) touch four places: the defaults in `rooms.js` `create()`, the allowed-keys list in the `room:setRules` handler in `socket.js`, the `Game` constructor in `game.js` (plus the rule's actual logic), and the toggle UI in `client/src/components/Lobby.jsx`.
