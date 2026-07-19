# Bot API — playing UNO from your own program

The game speaks plain [Socket.IO](https://socket.io/) — the same protocol the web client uses. Anything that can run a Socket.IO client (JavaScript, Python, C#, Java, Go, …) can join a room and play as a seated player. There is no separate bot registration: you connect, join a room by its 4-letter code, and play. The server validates every move, so a buggy bot can never corrupt a game — illegal moves just come back as errors.

A complete working bot lives at [`examples/bot.mjs`](../examples/bot.mjs):

```bash
npm install socket.io-client        # only dependency
node examples/bot.mjs ABCD          # join room ABCD on http://localhost:3001
node examples/bot.mjs ABCD MyBot http://host:3001
```

## Connecting

Connect with a **session token** in the handshake auth. The token is any non-empty string you invent; it *is* your identity — the server keys your seat to it, not to the socket.

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001', {
  auth: { token: 'my-bot-' + Math.random().toString(36).slice(2) },
});
```

- Reconnecting with the **same token** reclaims your seat automatically (state is re-sent on connect).
- If you disconnect mid-game for more than 30 s, a built-in bot takes over your seat — but you can still reconnect and take it back any time the game is running.
- Connecting **without a token** gets you disconnected immediately.
- Keep one token per bot instance. Don't reuse a token across two live connections.

On connect the server sends either your restored session (`me`, `chat:history`, `room:update`, and `game:state` if a game is running) or `room:none` if the token isn't seated anywhere.

## Rooms

| Emit | Payload | Notes |
|---|---|---|
| `room:create` | `{ name }` | Creates a room, you become host. Reply: `me` + `room:update`. |
| `room:join` | `{ code, name }` | Join by 4-letter code (case-insensitive). Fails if the game already started or the room is full (10 seats). |
| `room:leave` | — | Mid-game this permanently hands your seat to a built-in bot. |
| `room:setRules` | `{ stacking?, drawUntilPlayable?, jumpIn? }` | Host only, lobby only. Booleans. |
| `room:addBot` / `room:removeBot` | — / `{ botId }` | Host only, lobby only. Adds/removes a built-in bot. |
| `room:start` | — | Host only. Needs ≥ 2 players. |
| `game:rematch` | — | Host only, after a round finished. Starts a fresh deal in the same room. |
| `chat:send` | `{ text }` | ≤ 200 chars, throttled to one message per 400 ms. |

You learn **your own player id** from the `me` event: `{ playerId }`. Room membership and host changes arrive as `room:update`:

```js
{
  code: 'ABCD', hostId: 'p1', status: 'lobby' | 'playing',
  rules: { stacking, drawUntilPlayable, jumpIn },
  maxPlayers: 10,
  players: [{ id, name, isBot, connected }],
}
```

## Game state

You never poll for your turn — after every successful action (by anyone) the server pushes a fresh, personalized `game:state` to every player. `game:sync` (no payload) re-requests it on demand as a safety net.

```js
{
  phase: 'playing' | 'finished',
  players: [{ id, name, isBot, cardCount, unoCalled, isCurrent, connected }],
  hand: [ { id, color, value }, ... ],   // YOUR cards only — others are cardCount
  topCard: { id, color, value },
  activeColor: 'red' | 'yellow' | 'green' | 'blue',  // differs from topCard.color after a wild
  direction: 1 | -1,
  pendingDraw: 0,          // stacked +2/+4 penalty waiting for the current player
  drawPileCount: 42,
  currentPlayerId: 'p2',
  drawnPlayableCardId: null | 'c17',  // you drew this playable card; play it or pass
  unoVulnerable: null | 'p3',         // this player can be caught not saying UNO
  winnerId: null | 'p1',
  rules: { stacking, drawUntilPlayable, jumpIn },
}
```

Cards: `color` is `red | yellow | green | blue | wild`; `value` is `'0'`–`'9'`, `skip`, `reverse`, `draw2`, or (only with color `wild`) `wild` / `wild4`. Card ids (`c0`–`c107`) are unique within a deal but **reused between games** — don't key long-lived bot memory on them across rounds.

`game:event` delivers human-readable commentary as `[{ text, ts }]` — display-only; drive your bot from `game:state`.

## Making moves

Act when `phase === 'playing'` and `currentPlayerId` is your id (exception: jump-ins).

| Emit | Payload | Notes |
|---|---|---|
| `game:play` | `{ cardId, color? }` | `color` is **required** when playing a wild — one of `red/yellow/green/blue`. |
| `game:draw` | — | Draws a card; if `pendingDraw > 0`, takes the whole stack instead and ends your turn. |
| `game:pass` | — | Only valid while `drawnPlayableCardId` is set: keep the drawn card, end your turn. |
| `game:jumpIn` | `{ cardId }` | Out of turn, `jumpIn` rule only: a card **identical** in color and value to `topCard` (never wilds, never onto a pending draw stack). Play then continues from your seat. |
| `game:uno` | — | Call UNO. Allowed with ≤ 2 cards; call it **before** playing your second-to-last card. |
| `game:catchUno` | `{ targetId }` | While `unoVulnerable === targetId`: the target draws 2. |

A card is playable when (same logic as `server/src/game/rules.js`):

```js
function canPlay(card, topCard, activeColor, pendingDraw) {
  const isWild = card.color === 'wild';
  const isDraw = card.value === 'draw2' || card.value === 'wild4';
  const matches = isWild || card.color === activeColor || card.value === topCard.value;
  if (pendingDraw > 0) return isDraw && matches;  // stacking: only draw cards answer a stack
  return matches;
}
```

Turn checklist for a bot:

1. `pendingDraw > 0` → stack a matching `draw2`/`wild4`, or `game:draw` to take the penalty.
2. `drawnPlayableCardId` set → `game:play` **that exact card** (other cards are rejected) or `game:pass`.
3. Otherwise → `game:play` any playable card, or `game:draw`. With the `drawUntilPlayable` rule, one `game:draw` may add several cards to your hand and usually ends with `drawnPlayableCardId` set; without it, drawing a playable card also sets `drawnPlayableCardId`, otherwise your turn ends.
4. Down to 2 cards and about to play? `game:uno` first — if you reach 1 card without it, `unoVulnerable` becomes your id and anyone (including the built-in bots, after ~2.5–4 s) can make you draw 2.

## Errors

Invalid moves raise `game:error` with `{ message }` (e.g. `Not your turn`, `That card doesn't match`, `Pick a color for the wild`). **The game state does not change and no new `game:state` follows** — if your bot waits for state after an error it will stall. Recover by re-deciding from the last state; a safe fallback chain is play → draw → pass (that's what the built-in bot does).

## Special turn mechanics worth handling

- **2-player games**: `reverse` acts as a skip — the direction never flips, you just play again.
- **skip / draw penalties**: after your `skip`, `draw2`, or `wild4` (unstacked), the victim is skipped automatically; you'll simply see `currentPlayerId` move past them.
- **Reshuffles**: when the draw pile empties, the discard pile (minus the top card) is shuffled back in automatically.
- **Rematch**: after `phase === 'finished'`, stay connected; the host's `game:rematch` starts a new deal and state pushes resume.
