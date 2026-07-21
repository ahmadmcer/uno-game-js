// Synthesized sound effects via the Web Audio API — no audio assets.
// Everything is fire-and-forget and cosmetic: failures must never break the game.
// The AudioContext + autoplay unlocking live in audioCore.js, shared with bgm.js.

import { ensureContext as coreEnsure } from './audioCore.js';

const MASTER_VOLUME = 0.25;
// Per-sound floor between plays so rapid repeats (e.g. several opponents
// drawing in one state update) don't stack into a clipped burst.
const MIN_INTERVAL_MS = 60;
const MUTE_KEY = 'uno-muted';

let ctx = null;
let master = null;
let noiseBuf = null;
const lastPlayed = new Map();

let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }

// Get the shared context and lazily build our own sub-master gain under it, so
// SFX sit at MASTER_VOLUME independently of the music engine's gain.
function ensureContext() {
  const c = coreEnsure();
  if (!c) return null;
  if (c !== ctx) {
    ctx = c;
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
    noiseBuf = null; // (re)build the noise buffer against this context
  }
  return ctx;
}

function tone({ freq, at = 0, duration = 0.15, peak = 0.5, type = 'sine', slideTo }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise({ at = 0, duration = 0.08, peak = 0.8, filterFreq = 3000, filterType = 'bandpass' }) {
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.3);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter).connect(gain).connect(master);
  // Random start offset so back-to-back flicks don't sound like a stutter.
  src.start(t0, Math.random() * 0.15);
  src.stop(t0 + duration + 0.05);
}

const RECIPES = {
  // card leaves the deck — short swish
  draw: () => noise({ duration: 0.07, peak: 0.9, filterFreq: 3500 }),
  // card hits the discard pile — slap + low thump
  play: () => {
    noise({ duration: 0.09, peak: 1, filterFreq: 1100, filterType: 'lowpass' });
    tone({ freq: 150, duration: 0.12, peak: 0.7, slideTo: 55 });
  },
  // game-start deal — quick riffle
  shuffle: () => {
    for (let i = 0; i < 5; i++) {
      noise({ at: i * 0.06, duration: 0.05, peak: 0.6, filterFreq: 2800 + i * 500 });
    }
  },
  // it's your turn — gentle two-note chime
  turn: () => {
    tone({ freq: 660, duration: 0.12, peak: 0.45 });
    tone({ freq: 880, at: 0.1, duration: 0.2, peak: 0.45 });
  },
  // someone called UNO — rising alert
  uno: () => {
    tone({ freq: 523, duration: 0.1, peak: 0.55, type: 'triangle' });
    tone({ freq: 659, at: 0.09, duration: 0.1, peak: 0.55, type: 'triangle' });
    tone({ freq: 784, at: 0.18, duration: 0.22, peak: 0.55, type: 'triangle' });
  },
  // invalid move / caught without UNO — dry buzz
  buzz: () => tone({ freq: 110, duration: 0.2, peak: 0.3, type: 'square', slideTo: 85 }),
  // you won — ascending fanfare
  win: () => {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone({ freq, at: i * 0.13, duration: i === 3 ? 0.55 : 0.16, peak: 0.5, type: 'triangle' });
    });
  },
  // someone else won — soft descending sting
  lose: () => {
    tone({ freq: 392, duration: 0.25, peak: 0.4, type: 'triangle' });
    tone({ freq: 262, at: 0.22, duration: 0.4, peak: 0.4, type: 'triangle' });
  },
  // incoming chat — small pop
  chat: () => tone({ freq: 1150, duration: 0.09, peak: 0.3, slideTo: 1550 }),
};

export const sfx = {
  play(name) {
    if (muted) return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    const now = Date.now();
    if (now - (lastPlayed.get(name) ?? 0) < MIN_INTERVAL_MS) return;
    lastPlayed.set(name, now);
    try {
      const c = ensureContext();
      // Skip while suspended: scheduling anyway would queue sounds that all
      // fire at once when a later gesture finally unlocks the context.
      if (!c || c.state !== 'running') return;
      recipe();
    } catch { /* cosmetic only */ }
  },
  isMuted() {
    return muted;
  },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
    return muted;
  },
};
