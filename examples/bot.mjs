#!/usr/bin/env node
// Reference external bot for the UNO Socket.IO API (see docs/API.md).
//
//   npm install socket.io-client
//   node examples/bot.mjs <ROOM_CODE> [name] [server-url]
//
// Joins the room and plays a simple strategy until the process is killed:
// answer draw stacks, prefer non-wild playable cards, save wilds for last,
// pick the wild color it holds most of, and call UNO before its
// second-to-last card. Everything it knows comes from `game:state`; every
// move is validated server-side.

import { io } from 'socket.io-client';

const [code, name = 'RefBot', server = 'http://localhost:3001'] = process.argv.slice(2);
if (!code) {
  console.error('Usage: node examples/bot.mjs <ROOM_CODE> [name] [server-url]');
  process.exit(1);
}

const THINK_MS = 500; // small delay so moves are visible to humans watching

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

const canPlay = (card, topCard, activeColor, pendingDraw) => {
  const isWild = card.color === 'wild';
  const isDraw = card.value === 'draw2' || card.value === 'wild4';
  const matches = isWild || card.color === activeColor || card.value === topCard.value;
  return pendingDraw > 0 ? isDraw && matches : matches;
};

// Most common color in hand — a decent default for wilds.
const pickColor = (hand) => {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.color in counts) counts[c.color]++;
  return Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a));
};

const decide = (state, myId) => {
  const { hand, topCard, activeColor, pendingDraw, drawnPlayableCardId } = state;

  if (drawnPlayableCardId) {
    // We just drew a playable card: only that card or a pass is legal.
    const card = hand.find((c) => c.id === drawnPlayableCardId);
    return { type: 'play', card };
  }

  const playable = hand.filter((c) => canPlay(c, topCard, activeColor, pendingDraw));
  if (!playable.length) return { type: 'draw' };
  const card = playable.find((c) => c.color !== 'wild') ?? playable[0];
  return { type: 'play', card };
};

const token = `refbot-${Math.random().toString(36).slice(2)}`;
const socket = io(server, { auth: { token } });

let myId = null;
let lastState = null;
let thinkTimer = null;
let errorStrikes = 0; // fallback ladder after rejected moves: play -> draw -> pass

const act = () => {
  thinkTimer = null;
  const state = lastState;
  if (!state || state.phase !== 'playing' || state.currentPlayerId !== myId) return;

  // A rejected move produces no new game:state, so retry with safer moves
  // instead of waiting forever (mirrors the built-in bot's fallback).
  if (errorStrikes === 1) { log('falling back to draw'); return socket.emit('game:draw'); }
  if (errorStrikes >= 2) { log('falling back to pass'); return socket.emit('game:pass'); }

  const action = decide(state, myId);
  if (action.type === 'play' && action.card) {
    if (state.hand.length === 2) socket.emit('game:uno');
    const color = action.card.color === 'wild' ? pickColor(state.hand) : undefined;
    log(`play ${action.card.color} ${action.card.value}${color ? ` -> ${color}` : ''}`);
    socket.emit('game:play', { cardId: action.card.id, color });
  } else {
    log(`draw${state.pendingDraw > 0 ? ` (take the +${state.pendingDraw})` : ''}`);
    socket.emit('game:draw');
  }
};

const scheduleTurn = () => {
  clearTimeout(thinkTimer);
  thinkTimer = setTimeout(act, THINK_MS);
};

socket.on('connect', () => {
  log(`connected to ${server}, joining ${code.toUpperCase()}`);
  socket.emit('room:join', { code, name });
});

socket.on('me', ({ playerId }) => {
  myId = playerId;
  log(`seated as ${name} (${playerId})`);
});

socket.on('room:update', (room) => {
  if (room.status === 'lobby') {
    log(`in lobby ${room.code}: ${room.players.map((p) => p.name).join(', ')} — waiting for the host to start`);
  }
});

socket.on('game:state', (state) => {
  lastState = state;
  errorStrikes = 0; // state advanced, so the last move (or someone's) worked
  if (state.winnerId) {
    const winner = state.players.find((p) => p.id === state.winnerId);
    log(state.winnerId === myId ? 'I win! 🏆' : `${winner?.name ?? '?'} wins — waiting for a rematch`);
    return;
  }
  if (state.currentPlayerId === myId) scheduleTurn();
});

socket.on('game:event', (events) => {
  for (const e of events) log(`| ${e.text}`);
});

socket.on('game:error', ({ message }) => {
  log(`server rejected the move: ${message}`);
  errorStrikes++;
  if (lastState?.currentPlayerId === myId) scheduleTurn();
});

socket.on('room:none', () => {
  // Emitted on first connect (not seated yet) and after room:leave.
  if (myId) { log('room closed'); process.exit(0); }
});

socket.on('disconnect', (reason) => log(`disconnected (${reason}) — retrying`));
