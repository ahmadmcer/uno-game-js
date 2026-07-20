# Changelog

Notable changes to the UNO multiplayer game. The format follows
[Keep a Changelog](https://keepachangelog.com/); the project has no version
tags yet, so entries are grouped by date.

## 2026-07-20

### Added
- **Sound effects** — synthesized entirely with the Web Audio API (no audio
  files, works offline): card flicks on draws (one tick per card during
  draw-to-match reveals), a slap on every discard, a shuffle riffle on each
  deal, a your-turn chime, UNO and catch alerts, win/lose stings, and a chat
  pop. Mute toggle in the lobby and game headers, persisted across reloads.
- **Bot API** — external programs can join rooms and play through the same
  Socket.IO protocol as the web client. Full event reference in
  `docs/API.md`, plus a standalone reference bot (`examples/bot.mjs`) that
  answers draw stacks, chooses wild colors, and calls UNO.
- `MEMORY.md` — accumulated environment quirks, design decisions, and
  verification techniques; this changelog.

### Fixed
- Round icon buttons (chat close, remove bot) had their X icon off-center
  due to default button padding; icons are now flex-centered.
- Rematches no longer replay the new hand as if it were a multi-card draw —
  deck card ids repeat between games, so the hand is remounted per deal.

## 2026-07-18

### Added
- **In-game chat** — collapsible floating panel with message history (last
  50), unread badge, and clickable toast previews for incoming messages;
  server-side length limits and throttling.
- **Card & UI animations** — cards fly into your hand when dealt or drawn
  (draw-to-match batches reveal one card at a time), discards land with a
  slap, and pile/seat card counts pop when they change.
- Font Awesome icons across the interface and card faces (skip, reverse,
  wild), replacing emoji and unicode glyphs.
- Google Fonts: Fredoka for the UI, Luckiest Guy for logos.
- `CLAUDE.md` with repository guidance for AI-assisted development (#1).

## 2026-07-17

### Added
- Initial release: online multiplayer UNO with a server-authoritative turn
  engine, 4-letter room codes, seat-filling bots, reconnection with bot
  takeover, and optional house rules (stacking, draw-to-match, jump-in).
  Node.js + Socket.IO server, React + Vite client, server unit tests.
- MIT license.
- Docker support (multi-stage build and compose file).
