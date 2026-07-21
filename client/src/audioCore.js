// Shared Web Audio singleton for the synthesized SFX (sfx.js) and the adaptive
// music engine (bgm.js). One AudioContext means one autoplay unlock and one
// output graph — browsers throttle/limit multiple contexts.

let ctx = null;
const unlockCbs = new Set();

export function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Fire onUnlock callbacks once the context is actually running (after a gesture
// resumes it). Lets the music engine start itself the first time audio unlocks.
function notifyIfRunning() {
  if (ctx && ctx.state === 'running' && unlockCbs.size) {
    for (const cb of [...unlockCbs]) {
      unlockCbs.delete(cb);
      try { cb(); } catch { /* cosmetic only */ }
    }
  }
}

// Runs once the context is running; if already running, runs on the next tick.
export function onUnlock(cb) {
  unlockCbs.add(cb);
  notifyIfRunning();
}

// Autoplay policy: a context created before any user gesture starts suspended,
// so grab (or resume) it on the first interaction, then flush unlock callbacks.
function unlock() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume().then(notifyIfRunning).catch(() => {});
  else notifyIfRunning();
}
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });
