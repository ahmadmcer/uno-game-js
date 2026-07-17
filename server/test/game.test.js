import { describe, it, expect } from 'vitest';
import { Game, GameError } from '../src/game/game.js';

const card = (color, value, id) => ({ id: id ?? `${color}-${value}-${Math.random().toString(36).slice(2, 6)}`, color, value });
const names = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

// Force a deterministic mid-game state onto a freshly constructed game.
function rig(game, { hands, top, activeColor, drawPile } = {}) {
  if (hands) game.players.forEach((p, i) => { if (hands[i]) p.hand = hands[i]; });
  if (top) {
    game.discardPile = [top];
    game.activeColor = activeColor ?? top.color;
  }
  if (drawPile) game.drawPile = drawPile;
  game.currentIndex = 0;
  game.direction = 1;
  game.pendingDraw = 0;
  game.drawnPlayable = null;
  game.unoVulnerable = null;
  game.takeEvents();
  return game;
}

describe('setup', () => {
  it('deals 7 cards each and flips a non-wild first card', () => {
    const g = new Game(names(4));
    for (const p of g.players) expect(p.hand.length).toBeGreaterThanOrEqual(7);
    expect(g.topCard().color).not.toBe('wild');
    expect(g.phase).toBe('playing');
  });

  it('rejects a single-player game', () => {
    expect(() => new Game(names(1))).toThrow(GameError);
  });
});

describe('basic turns', () => {
  it('advances after a matching play', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', '7', 'r7'), card('blue', '3')]],
    });
    g.play('p0', 'r7');
    expect(g.topCard().id).toBe('r7');
    expect(g.current().id).toBe('p1');
  });

  it('rejects playing out of turn', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[], [card('red', '7', 'r7')]],
    });
    expect(() => g.play('p1', 'r7')).toThrow('Not your turn');
  });

  it('rejects a non-matching card', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('blue', '7', 'b7'), card('green', '1')]],
    });
    expect(() => g.play('p0', 'b7')).toThrow(GameError);
  });

  it('skip jumps over the next player', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', 'skip', 'rs'), card('blue', '3')]],
    });
    g.play('p0', 'rs');
    expect(g.current().id).toBe('p2');
  });

  it('reverse flips direction with 3+ players', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', 'reverse', 'rr'), card('blue', '3')]],
    });
    g.play('p0', 'rr');
    expect(g.direction).toBe(-1);
    expect(g.current().id).toBe('p2');
  });

  it('reverse acts as skip with 2 players', () => {
    const g = rig(new Game(names(2)), {
      top: card('red', '5'),
      hands: [[card('red', 'reverse', 'rr'), card('blue', '3')]],
    });
    g.play('p0', 'rr');
    expect(g.current().id).toBe('p0');
  });

  it('wilds require a color choice and set the active color', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('wild', 'wild', 'w1'), card('blue', '3')]],
    });
    expect(() => g.play('p0', 'w1')).toThrow('Pick a color');
    g.play('p0', 'w1', 'blue');
    expect(g.activeColor).toBe('blue');
    expect(g.current().id).toBe('p1');
  });
});

describe('draw penalties', () => {
  it('draw2 without stacking: victim draws 2 and is skipped', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', 'draw2', 'rd'), card('blue', '3')]],
    });
    const before = g.players[1].hand.length;
    g.play('p0', 'rd');
    expect(g.players[1].hand.length).toBe(before + 2);
    expect(g.current().id).toBe('p2');
    expect(g.pendingDraw).toBe(0);
  });

  it('wild4 without stacking: victim draws 4 and is skipped', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('wild', 'wild4', 'w4'), card('blue', '3')]],
    });
    const before = g.players[1].hand.length;
    g.play('p0', 'w4', 'green');
    expect(g.players[1].hand.length).toBe(before + 4);
    expect(g.activeColor).toBe('green');
    expect(g.current().id).toBe('p2');
  });

  it('stacking accumulates and the loser draws the total', () => {
    const g = rig(new Game(names(3), { stacking: true }), {
      top: card('red', '5'),
      hands: [
        [card('red', 'draw2', 'rd'), card('blue', '3')],
        [card('blue', 'draw2', 'bd'), card('green', '1')],
      ],
    });
    g.play('p0', 'rd');
    expect(g.pendingDraw).toBe(2);
    expect(g.current().id).toBe('p1');
    g.play('p1', 'bd'); // stacks by value match
    expect(g.pendingDraw).toBe(4);
    expect(g.current().id).toBe('p2');
    const before = g.players[2].hand.length;
    g.draw('p2');
    expect(g.players[2].hand.length).toBe(before + 4);
    expect(g.pendingDraw).toBe(0);
    expect(g.current().id).toBe('p0');
  });

  it('cannot play a normal card onto a draw stack', () => {
    const g = rig(new Game(names(3), { stacking: true }), {
      top: card('red', '5'),
      hands: [
        [card('red', 'draw2', 'rd'), card('blue', '3')],
        [card('red', '9', 'r9'), card('green', '1')],
      ],
    });
    g.play('p0', 'rd');
    expect(() => g.play('p1', 'r9')).toThrow(GameError);
  });
});

describe('drawing', () => {
  it('standard draw of a non-playable card passes the turn', () => {
    const g = rig(new Game(names(2)), {
      top: card('red', '5'),
      hands: [[card('blue', '9')], [card('green', '1')]],
      drawPile: [card('blue', '7', 'b7')],
    });
    g.draw('p0');
    expect(g.players[0].hand.length).toBe(2);
    expect(g.current().id).toBe('p1');
  });

  it('standard draw of a playable card allows play-or-pass of only that card', () => {
    const g = rig(new Game(names(2)), {
      top: card('red', '5'),
      hands: [[card('red', '7', 'r7')], [card('green', '1')]],
      drawPile: [card('red', '9', 'r9')],
    });
    g.draw('p0');
    expect(g.drawnPlayable).toEqual({ playerId: 'p0', cardId: 'r9' });
    expect(g.current().id).toBe('p0');
    expect(() => g.play('p0', 'r7')).toThrow('you just drew');
    g.pass('p0');
    expect(g.current().id).toBe('p1');
  });

  it('draw-until-playable keeps drawing until a match appears', () => {
    const g = rig(new Game(names(2), { drawUntilPlayable: true }), {
      top: card('red', '5'),
      hands: [[card('blue', '9')], [card('green', '1')]],
      drawPile: [card('red', '3', 'r3'), card('yellow', '2'), card('green', '9')],
    });
    g.draw('p0');
    expect(g.players[0].hand.length).toBe(4); // drew green-9, yellow-2, red-3
    expect(g.drawnPlayable).toEqual({ playerId: 'p0', cardId: 'r3' });
    g.play('p0', 'r3');
    expect(g.topCard().id).toBe('r3');
    expect(g.current().id).toBe('p1');
  });

  it('reshuffles the discard pile when the draw pile runs out', () => {
    const g = rig(new Game(names(2)), {
      top: card('red', '5'),
      hands: [[card('blue', '9')], [card('green', '1')]],
      drawPile: [],
    });
    g.discardPile = [card('blue', '2'), card('green', '7'), card('red', '5', 'top')];
    g.draw('p0');
    expect(g.players[0].hand.length).toBe(2);
    expect(g.discardPile).toHaveLength(1);
    expect(g.discardPile[0].id).toBe('top');
  });

  it('pass is rejected without a drawn playable card', () => {
    const g = rig(new Game(names(2)), { top: card('red', '5') });
    expect(() => g.pass('p0')).toThrow(GameError);
  });
});

describe('UNO calls', () => {
  it('playing to one card without calling UNO is catchable', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', '7', 'r7'), card('blue', '3')]],
    });
    g.play('p0', 'r7');
    expect(g.unoVulnerable).toBe('p0');
    g.catchUno('p1', 'p0');
    expect(g.players[0].hand.length).toBe(3);
    expect(g.unoVulnerable).toBe(null);
  });

  it('calling UNO first prevents the catch', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[card('red', '7', 'r7'), card('blue', '3')]],
    });
    g.callUno('p0');
    g.play('p0', 'r7');
    expect(g.unoVulnerable).toBe(null);
    expect(() => g.catchUno('p1', 'p0')).toThrow('Too late');
  });

  it('the catch window closes when the next player acts', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [
        [card('red', '7', 'r7'), card('blue', '3')],
        [card('red', '9', 'r9'), card('green', '1')],
      ],
    });
    g.play('p0', 'r7');
    g.play('p1', 'r9');
    expect(() => g.catchUno('p2', 'p0')).toThrow('Too late');
  });
});

describe('winning', () => {
  it('playing the last card wins and freezes the game', () => {
    const g = rig(new Game(names(2)), {
      top: card('red', '5'),
      hands: [[card('red', '7', 'r7')], [card('green', '1', 'g1')]],
    });
    g.play('p0', 'r7');
    expect(g.winnerId).toBe('p0');
    expect(g.phase).toBe('finished');
    expect(() => g.play('p1', 'g1')).toThrow('round is over');
  });

  it('winning with a draw card still applies the penalty', () => {
    const g = rig(new Game(names(2), { stacking: true }), {
      top: card('red', '5'),
      hands: [[card('red', 'draw2', 'rd')], [card('green', '1')]],
    });
    const before = g.players[1].hand.length;
    g.play('p0', 'rd');
    expect(g.winnerId).toBe('p0');
    expect(g.players[1].hand.length).toBe(before + 2);
  });
});

describe('jump-in', () => {
  it('an identical card can jump in and play continues from there', () => {
    const g = rig(new Game(names(3), { jumpIn: true }), {
      top: card('red', '5', 'top'),
      hands: [[], [], [card('red', '5', 'dup'), card('blue', '3')]],
    });
    g.play('p2', 'dup', null, { jumpIn: true });
    expect(g.topCard().id).toBe('dup');
    expect(g.current().id).toBe('p0'); // next after p2
  });

  it('rejects non-identical jump-ins', () => {
    const g = rig(new Game(names(3), { jumpIn: true }), {
      top: card('red', '5'),
      hands: [[], [], [card('green', '5', 'g5')]],
    });
    expect(() => g.play('p2', 'g5', null, { jumpIn: true })).toThrow('identical');
  });

  it('rejects jump-ins when the rule is off', () => {
    const g = rig(new Game(names(3)), {
      top: card('red', '5'),
      hands: [[], [], [card('red', '5', 'dup')]],
    });
    expect(() => g.play('p2', 'dup', null, { jumpIn: true })).toThrow('not enabled');
  });
});
