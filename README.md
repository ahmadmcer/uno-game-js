# UNO — Multiplayer

Online multiplayer UNO with game rooms, bots that fill empty seats, and optional house rules (stacking, draw-to-match, jump-in). Node.js + Socket.IO server, React + Vite client. The server is authoritative — clients only ever see their own hand.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. The game server runs on port 3001 (the Vite dev server proxies Socket.IO to it).

To play from a phone on the same Wi-Fi, open `http://<your-pc-ip>:5173`.

## How to play

1. Enter a name and **Create a room** — share the 4-letter code.
2. Friends join with the code; the host can add bots and toggle house rules.
3. Start the game. Call **UNO!** when you're down to your last card — or get caught and draw 2.

## House rules

- **Stacking** — answer a +2/+4 with your own to pass the accumulated penalty along.
- **Draw to match** — can't play? Keep drawing until you find a playable card.
- **Jump-in** — holding a card identical to the top of the pile? Play it out of turn.

## Tests

```bash
npm test
```

Unit tests cover the deck, play validation, and the turn engine (stacking, reverse-as-skip in 2-player, reshuffles, UNO catches, jump-ins).

## Production

```bash
npm run build   # builds the client into client/dist
npm start       # the server also serves client/dist on port 3001
```
