export const MAX_PLAYERS = 10;

const BOT_NAMES = ['Ruby', 'Ziggy', 'Pixel', 'Nova', 'Turbo', 'Mango', 'Echo', 'Biscuit', 'Waffles', 'Comet'];
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

const randomId = () => Math.random().toString(36).slice(2, 10);

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> room
    this.tokenRoom = new Map(); // session token -> code
  }

  create(token, name) {
    let code;
    do {
      code = Array.from({ length: 4 }, () =>
        CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
    } while (this.rooms.has(code));

    const player = this.makePlayer(token, name);
    const room = {
      code,
      hostId: player.id,
      players: [player],
      rules: { stacking: false, drawUntilPlayable: false, jumpIn: false },
      status: 'lobby',
      game: null,
      botTimer: null,
      unoTimer: null,
      deleteTimer: null,
    };
    this.rooms.set(code, room);
    this.tokenRoom.set(token, code);
    return room;
  }

  makePlayer(token, name) {
    return {
      id: randomId(),
      token,
      name,
      isBot: false,
      takeover: false, // a bot is playing this seat while its human is away
      connected: true,
      socketId: null,
      graceTimer: null,
    };
  }

  addPlayer(room, token, name) {
    const player = this.makePlayer(token, name);
    room.players.push(player);
    this.tokenRoom.set(token, room.code);
    return player;
  }

  addBot(room) {
    const used = new Set(room.players.map((p) => p.name));
    const name = BOT_NAMES.map((n) => `Bot ${n}`).find((n) => !used.has(n))
      || `Bot ${randomId().slice(0, 4).toUpperCase()}`;
    room.players.push({
      id: randomId(),
      token: null,
      name,
      isBot: true,
      takeover: false,
      connected: true,
      graceTimer: null,
    });
  }

  removeBot(room, botId) {
    const i = room.players.findIndex((p) => p.id === botId && p.isBot);
    if (i >= 0) room.players.splice(i, 1);
  }

  removePlayer(room, player) {
    clearTimeout(player.graceTimer);
    room.players = room.players.filter((p) => p !== player);
    if (player.token) this.tokenRoom.delete(player.token);
  }

  detachToken(player) {
    if (player.token) this.tokenRoom.delete(player.token);
    player.token = null;
  }

  get(code) { return this.rooms.get(code); }

  findByToken(token) {
    const code = this.tokenRoom.get(token);
    return code ? this.rooms.get(code) : null;
  }

  destroy(room) {
    clearTimeout(room.botTimer);
    clearTimeout(room.unoTimer);
    clearTimeout(room.deleteTimer);
    for (const p of room.players) {
      clearTimeout(p.graceTimer);
      if (p.token) this.tokenRoom.delete(p.token);
    }
    this.rooms.delete(room.code);
  }
}
