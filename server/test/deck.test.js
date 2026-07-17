import { describe, it, expect } from 'vitest';
import { buildDeck, COLORS } from '../src/game/deck.js';

describe('buildDeck', () => {
  const deck = buildDeck();

  it('has exactly 108 cards', () => {
    expect(deck).toHaveLength(108);
  });

  it('has unique ids', () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });

  it('has the standard distribution per color', () => {
    for (const color of COLORS) {
      const ofColor = deck.filter((c) => c.color === color);
      expect(ofColor).toHaveLength(25);
      expect(ofColor.filter((c) => c.value === '0')).toHaveLength(1);
      for (let n = 1; n <= 9; n++) {
        expect(ofColor.filter((c) => c.value === String(n))).toHaveLength(2);
      }
      for (const action of ['skip', 'reverse', 'draw2']) {
        expect(ofColor.filter((c) => c.value === action)).toHaveLength(2);
      }
    }
  });

  it('has 4 wilds and 4 wild draw fours', () => {
    expect(deck.filter((c) => c.value === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.value === 'wild4')).toHaveLength(4);
    expect(deck.filter((c) => c.color === 'wild')).toHaveLength(8);
  });
});
