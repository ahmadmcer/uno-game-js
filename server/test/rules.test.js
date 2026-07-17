import { describe, it, expect } from 'vitest';
import { canPlay, canJumpIn } from '../src/game/rules.js';

const card = (color, value) => ({ id: `${color}-${value}`, color, value });
const top = card('red', '5');

describe('canPlay', () => {
  it('allows color matches', () => {
    expect(canPlay(card('red', '9'), top, 'red')).toBe(true);
    expect(canPlay(card('red', 'skip'), top, 'red')).toBe(true);
  });

  it('allows value matches', () => {
    expect(canPlay(card('blue', '5'), top, 'red')).toBe(true);
  });

  it('rejects non-matches', () => {
    expect(canPlay(card('blue', '9'), top, 'red')).toBe(false);
  });

  it('always allows wilds', () => {
    expect(canPlay(card('wild', 'wild'), top, 'red')).toBe(true);
    expect(canPlay(card('wild', 'wild4'), top, 'red')).toBe(true);
  });

  it('matches against the active color after a wild, not the card color', () => {
    const wildTop = card('wild', 'wild');
    expect(canPlay(card('green', '2'), wildTop, 'green')).toBe(true);
    expect(canPlay(card('blue', '2'), wildTop, 'green')).toBe(false);
  });

  it('only allows matching draw cards onto a pending draw stack', () => {
    const drawTop = card('red', 'draw2');
    expect(canPlay(card('blue', 'draw2'), drawTop, 'red', 2)).toBe(true); // value match
    expect(canPlay(card('red', 'draw2'), drawTop, 'red', 2)).toBe(true); // color match
    expect(canPlay(card('wild', 'wild4'), drawTop, 'red', 2)).toBe(true);
    expect(canPlay(card('red', '9'), drawTop, 'red', 2)).toBe(false); // not a draw card
    expect(canPlay(card('wild', 'wild'), drawTop, 'red', 2)).toBe(false);
  });
});

describe('canJumpIn', () => {
  it('requires an identical card', () => {
    expect(canJumpIn(card('red', '5'), top)).toBe(true);
    expect(canJumpIn(card('blue', '5'), top)).toBe(false);
    expect(canJumpIn(card('red', '7'), top)).toBe(false);
  });

  it('never allows wilds', () => {
    expect(canJumpIn(card('wild', 'wild'), card('wild', 'wild'))).toBe(false);
  });
});
