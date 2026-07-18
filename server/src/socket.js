import { RoomManager, MAX_PLAYERS } from './rooms.js';
import { Game, GameError } from './game/game.js';
import { botAction } from './game/bot.js';

const TAKEOVER_GRACE_MS = 30_000;
const LOBBY_GRACE_MS = 15_000;
const EMPTY_ROOM_TTL_MS = 5 * 60_000;
const CHAT_MAX_LENGTH = 200;
const CHAT_HISTORY = 50;
const CHAT_MIN_INTERVAL_MS = 400;

const cleanName = (name) => {
  const n = String(name ?? '').trim().slice(0, 20);
  return n || 'Player';
};

export function attachSockets(io) {
  const rooms = new RoomManager();

  const publicRoom = (room) => ({
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    rules: room.rules,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot || p.takeover,
      connected: p.isBot ? true : p.connected,
    })),
  });

  const broadcastRoom = (room) => io.to(room.code).emit('room:update', publicRoom(room));

  const sendGameState = (room, player) => {
    const state = room.game.stateFor(player.id);
    state.players = state.players.map((sp) => {
      const rp = room.players.find((x) => x.id === sp.id);
      return {
        ...sp,
        isBot: rp ? rp.isBot || rp.takeover : sp.isBot,
        connected: rp ? rp.isBot || rp.connected : true,
      };
    });
    io.to(`player:${player.token}`).emit('game:state', state);
  };

  const broadcastGame = (room) => {
    if (!room.game) return;
    const events = room.game.takeEvents();
    if (events.length) io.to(room.code).emit('game:event', events);
    for (const p of room.players) {
      if (p.token) sendGameState(room, p);
    }
  };

  const seatIsBot = (room, playerId) => {
    const rp = room.players.find((p) => p.id === playerId);
    return !!rp && (rp.isBot || rp.takeover);
  };

  const scheduleBots = (room) => {
    clearTimeout(room.botTimer);
    room.botTimer = null;
    const game = room.game;
    if (!game || game.phase !== 'playing') return;
    if (!seatIsBot(room, game.current().id)) return;

    room.botTimer = setTimeout(() => {
      if (room.game !== game || game.phase !== 'playing') return;
      const bot = game.current();
      if (!seatIsBot(room, bot.id)) return;
      try {
        const action = botAction(game, bot.id);
        if (action.type === 'play') {
          if (bot.hand.length === 2) {
            try { game.callUno(bot.id); } catch { /* not fatal */ }
          }
          game.play(bot.id, action.cardId, action.color);
        } else if (action.type === 'pass') {
          game.pass(bot.id);
        } else {
          game.draw(bot.id);
        }
      } catch (err) {
        // Never let a bot stall the game: fall back to draw, then pass.
        console.error('bot action failed:', err);
        try { game.draw(bot.id); } catch { try { game.pass(bot.id); } catch { /* give up */ } }
      }
      afterAction(room);
    }, 900 + Math.random() * 700);
  };

  const scheduleUnoCatch = (room) => {
    clearTimeout(room.unoTimer);
    room.unoTimer = null;
    const game = room.game;
    if (!game || game.phase !== 'playing' || !game.unoVulnerable) return;
    const targetId = game.unoVulnerable;
    if (seatIsBot(room, targetId)) return;
    const bots = room.players.filter((p) => p.isBot || p.takeover);
    if (!bots.length) return;

    room.unoTimer = setTimeout(() => {
      if (room.game !== game || game.phase !== 'playing') return;
      if (game.unoVulnerable !== targetId) return;
      const bot = bots[Math.floor(Math.random() * bots.length)];
      try {
        game.catchUno(bot.id, targetId);
        afterAction(room);
      } catch { /* window closed in the meantime */ }
    }, 2500 + Math.random() * 1500);
  };

  const afterAction = (room) => {
    broadcastGame(room);
    scheduleBots(room);
    scheduleUnoCatch(room);
  };

  const startGame = (room) => {
    room.status = 'playing';
    room.game = new Game(
      room.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot || p.takeover })),
      room.rules,
    );
    broadcastRoom(room);
    afterAction(room);
  };

  const handleLeave = (room, token) => {
    const player = room.players.find((p) => p.token === token);
    if (!player) return;
    clearTimeout(player.graceTimer);

    const inLiveGame = room.status === 'playing' && room.game?.phase === 'playing';
    if (inLiveGame) {
      // Keep the seat so the game isn't disrupted — a bot plays on.
      rooms.detachToken(player);
      player.takeover = true;
      player.connected = true;
      room.game.event(`🤖 ${player.name} left — a bot plays on`);
    } else {
      rooms.removePlayer(room, player);
    }

    const humans = room.players.filter((p) => p.token);
    if (humans.length === 0) {
      rooms.destroy(room);
      return;
    }
    if (room.hostId === player.id) {
      room.hostId = (humans.find((h) => h.connected) || humans[0]).id;
    }
    broadcastRoom(room);
    if (inLiveGame) afterAction(room);
  };

  const scheduleRoomCleanup = (room) => {
    clearTimeout(room.deleteTimer);
    const humans = room.players.filter((p) => p.token);
    if (humans.some((h) => h.connected)) return;
    room.deleteTimer = setTimeout(() => {
      const stillHumans = room.players.filter((p) => p.token);
      if (!stillHumans.some((h) => h.connected)) rooms.destroy(room);
    }, EMPTY_ROOM_TTL_MS);
  };

  io.on('connection', (socket) => {
    const token = typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token : null;
    if (!token) {
      socket.disconnect(true);
      return;
    }
    socket.join(`player:${token}`);

    const existing = rooms.findByToken(token);
    if (existing) {
      const player = existing.players.find((p) => p.token === token);
      player.connected = true;
      player.takeover = false;
      player.socketId = socket.id;
      clearTimeout(player.graceTimer);
      clearTimeout(existing.deleteTimer);
      socket.join(existing.code);
      socket.emit('me', { playerId: player.id });
      socket.emit('chat:history', existing.chat);
      broadcastRoom(existing);
      if (existing.game) broadcastGame(existing);
      scheduleBots(existing);
    } else {
      socket.emit('room:none');
    }

    const on = (event, handler) => {
      socket.on(event, (payload) => {
        try {
          handler(payload ?? {});
        } catch (err) {
          if (err instanceof GameError) {
            socket.emit('game:error', { message: err.message });
          } else {
            console.error(`${event} failed:`, err);
            socket.emit('game:error', { message: 'Something went wrong' });
          }
        }
      });
    };

    const requireRoom = () => {
      const room = rooms.findByToken(token);
      if (!room) throw new GameError("You're not in a room");
      return room;
    };
    const myPlayer = (room) => room.players.find((p) => p.token === token);
    const requireHost = (room) => {
      if (room.hostId !== myPlayer(room)?.id) throw new GameError('Only the host can do that');
    };
    const requireGame = (room) => {
      if (!room.game) throw new GameError('No game in progress');
      return room.game;
    };

    on('room:create', ({ name }) => {
      const current = rooms.findByToken(token);
      if (current) {
        socket.leave(current.code);
        handleLeave(current, token);
      }
      const room = rooms.create(token, cleanName(name));
      room.players[0].socketId = socket.id;
      socket.join(room.code);
      socket.emit('me', { playerId: room.players[0].id });
      socket.emit('chat:history', room.chat);
      broadcastRoom(room);
    });

    on('room:join', ({ code, name }) => {
      const normalized = String(code ?? '').trim().toUpperCase();
      const room = rooms.get(normalized);
      if (!room) throw new GameError('Room not found — check the code');
      if (rooms.findByToken(token) === room) return;
      if (room.status !== 'lobby') throw new GameError('That game is already in progress');
      if (room.players.length >= MAX_PLAYERS) throw new GameError('Room is full');
      const current = rooms.findByToken(token);
      if (current) {
        socket.leave(current.code);
        handleLeave(current, token);
      }
      const player = rooms.addPlayer(room, token, cleanName(name));
      player.socketId = socket.id;
      socket.join(room.code);
      socket.emit('me', { playerId: player.id });
      socket.emit('chat:history', room.chat);
      broadcastRoom(room);
    });

    on('room:leave', () => {
      const room = rooms.findByToken(token);
      if (!room) return;
      socket.leave(room.code);
      handleLeave(room, token);
      socket.emit('room:none');
    });

    on('room:setRules', (payload) => {
      const room = requireRoom();
      requireHost(room);
      if (room.status !== 'lobby') throw new GameError('Rules are locked during a game');
      for (const key of ['stacking', 'drawUntilPlayable', 'jumpIn']) {
        if (key in payload) room.rules[key] = !!payload[key];
      }
      broadcastRoom(room);
    });

    on('chat:send', ({ text }) => {
      const room = requireRoom();
      const player = myPlayer(room);
      const clean = String(text ?? '').trim().slice(0, CHAT_MAX_LENGTH);
      if (!clean) throw new GameError("Can't send an empty message");
      const now = Date.now();
      if (player.lastChatAt && now - player.lastChatAt < CHAT_MIN_INTERVAL_MS) return;
      player.lastChatAt = now;

      const msg = {
        id: `m${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        playerId: player.id,
        name: player.name,
        text: clean,
        ts: now,
      };
      room.chat.push(msg);
      if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
      io.to(room.code).emit('chat:message', msg);
    });

    on('room:addBot', () => {
      const room = requireRoom();
      requireHost(room);
      if (room.status !== 'lobby') throw new GameError('The game already started');
      if (room.players.length >= MAX_PLAYERS) throw new GameError('Room is full');
      rooms.addBot(room);
      broadcastRoom(room);
    });

    on('room:removeBot', ({ botId }) => {
      const room = requireRoom();
      requireHost(room);
      if (room.status !== 'lobby') throw new GameError('The game already started');
      rooms.removeBot(room, botId);
      broadcastRoom(room);
    });

    on('room:start', () => {
      const room = requireRoom();
      requireHost(room);
      if (room.status !== 'lobby') throw new GameError('The game already started');
      if (room.players.length < 2) throw new GameError('Need at least 2 players — add a bot?');
      startGame(room);
    });

    on('game:play', ({ cardId, color }) => {
      const room = requireRoom();
      requireGame(room).play(myPlayer(room).id, cardId, color ?? null);
      afterAction(room);
    });

    on('game:jumpIn', ({ cardId }) => {
      const room = requireRoom();
      requireGame(room).play(myPlayer(room).id, cardId, null, { jumpIn: true });
      afterAction(room);
    });

    on('game:draw', () => {
      const room = requireRoom();
      requireGame(room).draw(myPlayer(room).id);
      afterAction(room);
    });

    on('game:pass', () => {
      const room = requireRoom();
      requireGame(room).pass(myPlayer(room).id);
      afterAction(room);
    });

    on('game:uno', () => {
      const room = requireRoom();
      requireGame(room).callUno(myPlayer(room).id);
      afterAction(room);
    });

    on('game:catchUno', ({ targetId }) => {
      const room = requireRoom();
      requireGame(room).catchUno(myPlayer(room).id, targetId);
      afterAction(room);
    });

    on('game:sync', () => {
      const room = rooms.findByToken(token);
      if (!room) {
        socket.emit('room:none');
        return;
      }
      socket.emit('room:update', publicRoom(room));
      const player = myPlayer(room);
      if (room.game && player) sendGameState(room, player);
    });

    on('game:rematch', () => {
      const room = requireRoom();
      requireHost(room);
      if (!room.game || room.game.phase !== 'finished') {
        throw new GameError('The round is still going');
      }
      startGame(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.findByToken(token);
      if (!room) return;
      const player = room.players.find((p) => p.token === token);
      if (!player) return;
      // A reconnect may have superseded this socket already; a late
      // disconnect from the old socket must not mark the player offline.
      if (player.socketId !== socket.id) return;
      player.connected = false;
      broadcastRoom(room);

      clearTimeout(player.graceTimer);
      if (room.status === 'playing' && room.game?.phase === 'playing') {
        broadcastGame(room);
        player.graceTimer = setTimeout(() => {
          if (player.connected || !player.token) return;
          player.takeover = true;
          room.game.event(`🤖 Bot takes over for ${player.name}`);
          broadcastRoom(room);
          afterAction(room);
        }, TAKEOVER_GRACE_MS);
      } else {
        player.graceTimer = setTimeout(() => {
          if (player.connected || !player.token) return;
          handleLeave(room, token);
        }, LOBBY_GRACE_MS);
      }
      scheduleRoomCleanup(room);
    });
  });
}
