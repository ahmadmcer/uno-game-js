# MEMORY.md — accumulated project knowledge

Working notes that are true but not derivable from the code. Complements CLAUDE.md
(which covers commands and architecture); read both at the start of a session.
Update this file when you learn something the hard way.

## Environment quirks (Windows + OneDrive)

- The repo lives inside OneDrive. `npm run dev` uses `node --watch`, which OneDrive
  randomly retriggers — the server restarts and **wipes all in-memory rooms/games**.
  For any stateful testing (multiplayer, reconnection, full games) build and run
  production instead: `npm run build && npm start` (port 3001, serves `client/dist`).
  `.claude/launch.json` has this as the `uno-prod` config.
- Git on OneDrive intermittently fails with reflog lock errors
  (`cannot update the ref 'HEAD'`). Fixed repo-locally with
  `git config windows.appendAtomically false` — already applied; reapply after a fresh clone.

## Non-obvious design decisions

- **Card ids repeat between games.** `deck.js` rebuilds the deck with the same ids
  (`c0`–`c107`) every deal, so a client can never treat "id I haven't seen" as "new
  card". This is why `App.jsx` counts deals (`dealKey`) and remounts `Hand` on
  rematch — id-diffing alone cannot distinguish a fresh deal from a draw.
- **`game:event` is display text only.** All client behavior (sounds, animations,
  badges) derives from `game:state` diffs, never from parsing event text. One known
  exception: `App.jsx` sniffs the word `caught` for the UNO-catch buzz. If more text
  sniffing is ever needed, add structured event types server-side instead.
- **Sounds are synthesized, not sampled.** `client/src/sfx.js` builds every effect
  from Web Audio oscillator/noise envelopes (no asset files, works offline). Plays
  are skipped unless `AudioContext.state === 'running'` so sounds never queue up
  behind the browser autoplay gate and burst out on the first click.
- **Per-tab identity.** The session token lives in `sessionStorage`, so each browser
  tab is a separate player and a reload rejoins the same seat — open extra tabs to
  test multiplayer locally.
- **The socket contract is public API.** External bots play through the same events
  as the web client (`docs/API.md`, `examples/bot.mjs`). Changing socket events or
  the `stateFor` shape means updating both, plus `client/src/rules.js` if play rules
  changed.

## Verification playbook

- Multi-client tests without a second human: the browser plus a Node script using
  `socket.io-client` (see `examples/bot.mjs`) joining by room code.
- React's controlled checkboxes ignore programmatic `.checked` writes — dispatch a
  real `MouseEvent('click', { bubbles: true })` on the input instead.
- Audio can be asserted without listening: patch
  `AudioContext.prototype.createOscillator` / `createBufferSource` to log calls.
  Each effect has a frequency signature — turn 660+880, uno 523/659/784, win ends
  at 1047, lose 392+262, chat/unmute pop 1150, card slap = noise + 150 Hz thump.
- To end a test game quickly, make one side only draw + "Keep it" — the opponent
  burns its hand down in well under a minute.

## History

Feature-by-feature history lives in `git log`; the July 2026 sessions added chat,
Font Awesome icons, the Fredoka/Luckiest Guy fonts, card animations (including the
one-by-one draw-to-match reveal), synthesized sound effects with a mute toggle, and
the external bot API.
