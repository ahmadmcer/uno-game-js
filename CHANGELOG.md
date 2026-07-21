# Changelog

Notable changes to the UNO multiplayer game. The format follows
[Keep a Changelog](https://keepachangelog.com/); the project has no version
tags yet, so entries are grouped by date.

## 2026-07-21

### Added
- **Adaptive background music** — synthesized in the browser (no audio files),
  it layers up and speeds up as tension rises (players nearing their last card,
  a +2/+4 stack pending, someone on UNO) and eases off during calm play. A
  separate music toggle in the lobby and game headers, independent of the sound
  effects mute; preference persists across reloads.
- **Hide your cards** — a privacy screen for playing side by side in the same
  room. The eye toggle in the game header covers your hand; tap to peek, and it
  re-covers automatically when your turn ends so no one can glance over and read
  your cards. Local per-device preference, off by default.

### Changed
- The **UNO** button now appears only when you're down to your last card (was
  two or fewer), so you race to call it before an opponent catches you.
- Chat and toast notifications moved to the bottom-left corner.

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
