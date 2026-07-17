import { buildDeck, shuffle } from './deck.js';
import { COLORS, canPlay, canJumpIn, isWild, describeCard } from './rules.js';

export class GameError extends Error {}

export class Game {
  constructor(players, rules = {}) {
    if (players.length < 2) throw new GameError('Need at least 2 players');
    this.rules = {
      stacking: !!rules.stacking,
      drawUntilPlayable: !!rules.drawUntilPlayable,
      jumpIn: !!rules.jumpIn,
    };
    this.players = players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      hand: [],
      unoCalled: false,
    }));
    this.drawPile = shuffle(buildDeck());
    this.discardPile = [];
    this.currentIndex = 0;
    this.direction = 1;
    this.pendingDraw = 0;
    this.drawnPlayable = null; // { playerId, cardId } after drawing a playable card
    this.unoVulnerable = null; // playerId that can be caught not saying UNO
    this.winnerId = null;
    this.phase = 'playing';
    this.events = [];

    for (const p of this.players) p.hand = this.drawPile.splice(-7);

    let first = this.drawPile.pop();
    while (isWild(first)) {
      this.drawPile.unshift(first);
      first = this.drawPile.pop();
    }
    this.discardPile.push(first);
    this.activeColor = first.color;
    this.event(`First card: ${describeCard(first)}`);
    if (first.value === 'skip') {
      this.event(`${this.current().name} is skipped`);
      this.advance(1);
    } else if (first.value === 'reverse') {
      this.direction = -1;
      this.currentIndex = this.players.length - 1;
      this.event('Play direction is reversed');
    } else if (first.value === 'draw2') {
      const victim = this.current();
      this.drawCards(victim, 2);
      this.event(`${victim.name} draws 2 and is skipped`);
      this.advance(1);
    }
  }

  current() { return this.players[this.currentIndex]; }
  playerById(id) { return this.players.find((p) => p.id === id); }
  topCard() { return this.discardPile[this.discardPile.length - 1]; }

  peek(steps = 1) {
    const n = this.players.length;
    return this.players[(((this.currentIndex + this.direction * steps) % n) + n) % n];
  }

  advance(steps = 1) {
    const n = this.players.length;
    this.currentIndex = (((this.currentIndex + this.direction * steps) % n) + n) % n;
  }

  event(text) { this.events.push({ text, ts: Date.now() }); }
  takeEvents() { const e = this.events; this.events = []; return e; }

  assertActive() {
    if (this.phase !== 'playing') throw new GameError('The round is over');
  }

  reshuffleDiscard() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle(this.discardPile);
    this.discardPile = [top];
    this.event('Draw pile reshuffled');
  }

  drawCards(player, n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) this.reshuffleDiscard();
      if (this.drawPile.length === 0) break;
      const card = this.drawPile.pop();
      drawn.push(card);
      player.hand.push(card);
    }
    if (player.hand.length > 1) {
      player.unoCalled = false;
      if (this.unoVulnerable === player.id) this.unoVulnerable = null;
    }
    return drawn;
  }

  play(playerId, cardId, chosenColor = null, { jumpIn = false } = {}) {
    this.assertActive();
    const player = this.playerById(playerId);
    if (!player) throw new GameError('Unknown player');

    if (jumpIn) {
      if (!this.rules.jumpIn) throw new GameError('Jump-in is not enabled in this room');
      if (this.pendingDraw > 0) throw new GameError("Can't jump in on a draw stack");
      if (player === this.current()) throw new GameError("It's your turn — just play the card");
    } else if (player !== this.current()) {
      throw new GameError('Not your turn');
    }

    const card = player.hand.find((c) => c.id === cardId);
    if (!card) throw new GameError('Card not in your hand');

    if (jumpIn) {
      if (!canJumpIn(card, this.topCard())) {
        throw new GameError('Only an identical card can jump in');
      }
      this.currentIndex = this.players.indexOf(player);
      this.event(`${player.name} jumped in!`);
    } else {
      if (this.drawnPlayable && this.drawnPlayable.playerId === playerId
          && this.drawnPlayable.cardId !== cardId) {
        throw new GameError('Play the card you just drew, or keep it');
      }
      if (!canPlay(card, this.topCard(), this.activeColor, this.pendingDraw)) {
        throw new GameError(this.pendingDraw > 0
          ? `Stack a draw card or take the +${this.pendingDraw}`
          : "That card doesn't match");
      }
    }

    if (isWild(card)) {
      if (!COLORS.includes(chosenColor)) throw new GameError('Pick a color for the wild');
    }

    this.drawnPlayable = null;
    player.hand.splice(player.hand.indexOf(card), 1);
    this.discardPile.push(card);
    this.activeColor = isWild(card) ? chosenColor : card.color;
    this.event(`${player.name} played ${describeCard(card)}${isWild(card) ? ` — ${chosenColor}` : ''}`);

    if (this.unoVulnerable && this.unoVulnerable !== playerId) this.unoVulnerable = null;
    if (player.hand.length === 1) {
      if (player.unoCalled) this.event(`${player.name} has UNO!`);
      else this.unoVulnerable = playerId;
    }

    const won = player.hand.length === 0;
    let steps = 1;

    if (card.value === 'skip') {
      this.event(`${this.peek(1).name} is skipped`);
      steps = 2;
    } else if (card.value === 'reverse') {
      if (this.players.length === 2) {
        this.event(`${this.peek(1).name} is skipped`);
        steps = 2;
      } else {
        this.direction *= -1;
        this.event('Direction reversed');
      }
    } else if (card.value === 'draw2' || card.value === 'wild4') {
      const amount = card.value === 'draw2' ? 2 : 4;
      if (this.rules.stacking && !won) {
        this.pendingDraw += amount;
        this.event(`Draw stack is now +${this.pendingDraw}`);
      } else {
        const victim = this.peek(1);
        const total = this.pendingDraw + amount;
        this.drawCards(victim, total);
        this.pendingDraw = 0;
        this.event(`${victim.name} draws ${total} and is skipped`);
        steps = 2;
      }
    }

    if (won) {
      this.winnerId = playerId;
      this.phase = 'finished';
      this.event(`🏆 ${player.name} wins!`);
      return;
    }
    this.advance(steps);
  }

  draw(playerId) {
    this.assertActive();
    const player = this.playerById(playerId);
    if (!player || player !== this.current()) throw new GameError('Not your turn');
    if (this.drawnPlayable && this.drawnPlayable.playerId === playerId) {
      throw new GameError('Play the card you just drew, or keep it');
    }
    if (this.unoVulnerable && this.unoVulnerable !== playerId) this.unoVulnerable = null;

    if (this.pendingDraw > 0) {
      const total = this.pendingDraw;
      this.drawCards(player, total);
      this.pendingDraw = 0;
      this.event(`${player.name} takes the +${total}`);
      this.advance(1);
      return;
    }

    if (this.rules.drawUntilPlayable) {
      // Cap at the total cards available so a hand with no possible match
      // can't loop forever.
      const limit = this.drawPile.length + this.discardPile.length - 1;
      let count = 0;
      while (count < limit) {
        const [card] = this.drawCards(player, 1);
        if (!card) break;
        count++;
        if (canPlay(card, this.topCard(), this.activeColor, 0)) {
          this.drawnPlayable = { playerId, cardId: card.id };
          this.event(`${player.name} drew ${count} card${count > 1 ? 's' : ''}`);
          return;
        }
      }
      this.event(`${player.name} drew ${count} cards — nothing playable`);
      this.advance(1);
      return;
    }

    const [card] = this.drawCards(player, 1);
    this.event(`${player.name} drew a card`);
    if (card && canPlay(card, this.topCard(), this.activeColor, 0)) {
      this.drawnPlayable = { playerId, cardId: card.id };
    } else {
      this.advance(1);
    }
  }

  pass(playerId) {
    this.assertActive();
    if (!this.drawnPlayable || this.drawnPlayable.playerId !== playerId
        || this.current().id !== playerId) {
      throw new GameError("You can't pass right now");
    }
    this.drawnPlayable = null;
    this.event(`${this.current().name} keeps the card`);
    this.advance(1);
  }

  callUno(playerId) {
    this.assertActive();
    const player = this.playerById(playerId);
    if (!player) throw new GameError('Unknown player');
    if (player.hand.length > 2) throw new GameError('You can only call UNO with 2 or fewer cards');
    if (player.unoCalled) return;
    player.unoCalled = true;
    if (this.unoVulnerable === playerId) this.unoVulnerable = null;
    this.event(`${player.name} called UNO!`);
  }

  catchUno(callerId, targetId) {
    this.assertActive();
    if (callerId === targetId) throw new GameError("You can't catch yourself");
    if (this.unoVulnerable !== targetId) throw new GameError('Too late — nothing to catch');
    const caller = this.playerById(callerId);
    const target = this.playerById(targetId);
    if (!caller || !target) throw new GameError('Unknown player');
    this.unoVulnerable = null;
    this.drawCards(target, 2);
    this.event(`${caller.name} caught ${target.name} not saying UNO — draw 2!`);
  }

  stateFor(viewerId) {
    return {
      phase: this.phase,
      players: this.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        cardCount: p.hand.length,
        unoCalled: p.unoCalled,
        isCurrent: i === this.currentIndex && this.phase === 'playing',
      })),
      hand: this.playerById(viewerId)?.hand ?? [],
      topCard: this.topCard(),
      activeColor: this.activeColor,
      direction: this.direction,
      pendingDraw: this.pendingDraw,
      drawPileCount: this.drawPile.length,
      currentPlayerId: this.current().id,
      drawnPlayableCardId: this.drawnPlayable?.playerId === viewerId ? this.drawnPlayable.cardId : null,
      unoVulnerable: this.unoVulnerable,
      winnerId: this.winnerId,
      rules: this.rules,
    };
  }
}
