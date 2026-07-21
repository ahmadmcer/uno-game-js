// Adaptive background music, synthesized with the Web Audio API — no assets.
// A small generative engine: a chord-progression bed whose layers, tempo and
// brightness are driven by a single `intensity` (0..1) derived from game state
// in App.jsx. Everything is cosmetic and fire-and-forget.

import { ensureContext, onUnlock } from './audioCore.js';

const MUSIC_VOLUME = 0.12; // music sits under the 0.25 SFX bus
const MUSIC_OFF_KEY = 'uno-music-off';
const TICK_MS = 25; // scheduler poll
const LOOKAHEAD = 0.12; // schedule notes this far ahead (s)

// Layer fade-in points (intensity): pad + bass are always present.
const HATS_IN = 0.3;
const KICK_IN = 0.4;
const ARP_IN = 0.55;

// Am–F–C–G, one bar each: warm and loops cleanly. Semitones are relative to
// A2 (110 Hz); pad plays the triad +1 octave, bass the root −1, arp +2.
const A2 = 110;
const ntf = (semi) => A2 * Math.pow(2, semi / 12);
const PROG = [
  { bass: 0, triad: [0, 3, 7] },     // Am
  { bass: -4, triad: [-4, 0, 3] },   // F
  { bass: 3, triad: [3, 7, 10] },    // C
  { bass: -2, triad: [-2, 2, 5] },   // G
];
const STEPS_PER_BAR = 8; // eighth notes
const clamp01 = (x) => Math.max(0, Math.min(1, x));

let ctx = null;
let musicGain = null;
let padFilter = null;
let padGain, bassGain, hatGain, kickGain, arpGain;
let noiseBuf = null;

let enabled = true;
try { enabled = localStorage.getItem(MUSIC_OFF_KEY) !== '1'; } catch { /* storage unavailable */ }

let phase = 'off';
let intensity = 0;
let currentBpm = 90;
let targetBpm = 90;
let running = false;
let timer = null;
let step = 0;
let nextNoteTime = 0;
let pendingUnlock = false;

function gainNode(v, dest) {
  const g = ctx.createGain();
  g.gain.value = v;
  g.connect(dest);
  return g;
}

function ensureNodes() {
  const c = ensureContext();
  if (!c) return null;
  if (c !== ctx) {
    ctx = c;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0; // faded up on start
    musicGain.connect(ctx.destination);
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.connect(musicGain);
    padGain = gainNode(0, padFilter);
    bassGain = gainNode(0, musicGain);
    hatGain = gainNode(0, musicGain);
    kickGain = gainNode(0, musicGain);
    arpGain = gainNode(0, musicGain);
    const len = Math.floor(ctx.sampleRate * 0.3);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

function ramp(param, value, time = 1.0) {
  if (!ctx) return;
  const now = ctx.currentTime;
  try {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + time);
  } catch { /* cosmetic only */ }
}

// Map intensity onto layer gains, pad brightness and tempo (all ramped smooth).
function applyIntensity() {
  if (!ctx) return;
  const layer = (from) => clamp01((intensity - from) / 0.25);
  ramp(padGain.gain, 0.5);
  ramp(bassGain.gain, 0.5);
  ramp(hatGain.gain, layer(HATS_IN) * 0.5);
  ramp(kickGain.gain, layer(KICK_IN) * 0.7);
  ramp(arpGain.gain, layer(ARP_IN) * 0.45);
  ramp(padFilter.frequency, 600 + intensity * 2200);
  targetBpm = 82 + intensity * 46;
}

function oscVoice({ freq, time, dur, dest, type = 'triangle', peak = 0.4, attack = 0.01, slideTo }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + attack);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function noiseVoice({ time, dur, dest, peak = 0.5, filterFreq = 9000, filterType = 'highpass' }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  src.connect(filter).connect(g).connect(dest);
  src.start(time, Math.random() * 0.15);
  src.stop(time + dur + 0.05);
}

function scheduleStep(s, time) {
  const chord = PROG[Math.floor(s / STEPS_PER_BAR) % PROG.length];
  const pos = s % STEPS_PER_BAR;
  const secPerBeat = 60 / currentBpm;

  if (pos === 0) {
    const barDur = secPerBeat * 4;
    for (const semi of chord.triad) {
      oscVoice({ freq: ntf(semi + 12), time, dur: barDur * 0.98, dest: padGain, type: 'sawtooth', peak: 0.14, attack: 0.08 });
    }
  }
  if (pos === 0 || pos === 4) {
    oscVoice({ freq: ntf(chord.bass - 12), time, dur: secPerBeat * 0.9, dest: bassGain, type: 'triangle', peak: 0.5, attack: 0.005 });
  }
  if (intensity >= KICK_IN && pos % 2 === 0) {
    oscVoice({ freq: 130, slideTo: 48, time, dur: 0.16, dest: kickGain, type: 'sine', peak: 0.9, attack: 0.002 });
  }
  if (intensity >= HATS_IN && pos % 2 === 1) {
    noiseVoice({ time, dur: 0.045, dest: hatGain, peak: 0.5 });
  }
  if (intensity >= ARP_IN) {
    const semi = chord.triad[pos % chord.triad.length] + 24;
    oscVoice({ freq: ntf(semi), time, dur: 0.14, dest: arpGain, type: 'triangle', peak: 0.4, attack: 0.004 });
  }
}

function scheduler() {
  if (!ctx || !running) return;
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    if (step % STEPS_PER_BAR === 0) currentBpm = targetBpm; // tempo change on the bar
    scheduleStep(step, nextNoteTime);
    nextNoteTime += (60 / currentBpm) / 2; // eighth notes
    step = (step + 1) % (STEPS_PER_BAR * PROG.length);
  }
}

function startScheduler() {
  if (running) return;
  const c = ensureNodes();
  if (!c || c.state !== 'running') return;
  running = true;
  step = 0;
  currentBpm = targetBpm;
  applyIntensity();
  nextNoteTime = c.currentTime + 0.06;
  ramp(musicGain.gain, MUSIC_VOLUME, 0.8);
  timer = setInterval(scheduler, TICK_MS);
}

function stopScheduler(fade = 0.4) {
  running = false;
  if (timer) { clearInterval(timer); timer = null; }
  if (musicGain) ramp(musicGain.gain, 0, fade); // let already-queued notes fade out
}

// Start once audio unlocks, if we still want to be playing.
function startWhenUnlocked() {
  if (pendingUnlock) return;
  pendingUnlock = true;
  onUnlock(() => {
    pendingUnlock = false;
    if (enabled && phase !== 'off' && phase !== 'over') startScheduler();
  });
}

export const bgm = {
  // Called from App.jsx whenever room/game state changes.
  setScene({ phase: nextPhase, intensity: nextIntensity = 0 }) {
    phase = nextPhase;
    intensity = clamp01(nextIntensity);
    if (!enabled || phase === 'off') { stopScheduler(); return; }
    if (phase === 'over') { stopScheduler(1.5); return; } // let win/lose SFX shine
    if (!ensureNodes()) return;
    if (ctx.state !== 'running') { startWhenUnlocked(); return; }
    if (!running) startScheduler();
    else applyIntensity();
  },
  isEnabled() {
    return enabled;
  },
  toggleEnabled() {
    enabled = !enabled;
    try { localStorage.setItem(MUSIC_OFF_KEY, enabled ? '0' : '1'); } catch { /* storage unavailable */ }
    if (!enabled) stopScheduler(0.3);
    else this.setScene({ phase, intensity }); // resume the current scene
    return enabled;
  },
  // Read-only snapshot for verification / debugging.
  debug() {
    return {
      enabled,
      phase,
      intensity: Math.round(intensity * 100) / 100,
      bpm: Math.round(currentBpm),
      running,
      layers: musicGain ? {
        music: +musicGain.gain.value.toFixed(3),
        pad: +padGain.gain.value.toFixed(2),
        bass: +bassGain.gain.value.toFixed(2),
        hat: +hatGain.gain.value.toFixed(2),
        kick: +kickGain.gain.value.toFixed(2),
        arp: +arpGain.gain.value.toFixed(2),
      } : null,
    };
  },
};

// Expose for browser-based verification (harmless in production).
if (typeof window !== 'undefined') window.__bgm = bgm;
