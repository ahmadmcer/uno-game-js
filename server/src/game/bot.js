import { COLORS, canPlay, isWild, isDrawCard } from './rules.js';

export function botAction(game, botId) {
  const bot = game.playerById(botId);

  if (game.drawnPlayable && game.drawnPlayable.playerId === botId) {
    const card = bot.hand.find((c) => c.id === game.drawnPlayable.cardId);
    if (!card) return { type: 'pass' };
    return {
      type: 'play',
      cardId: card.id,
      color: isWild(card) ? bestColor(bot.hand, card) : null,
    };
  }

  const playable = bot.hand.filter((c) =>
    canPlay(c, game.topCard(), game.activeColor, game.pendingDraw));
  if (playable.length === 0) return { type: 'draw' };

  const card = pickCard(game, bot, playable);
  return {
    type: 'play',
    cardId: card.id,
    color: isWild(card) ? bestColor(bot.hand, card) : null,
  };
}

function pickCard(game, bot, playable) {
  const nextLow = game.peek(1).hand.length <= 2;
  const colorCounts = countColors(bot.hand);
  let best = null;
  let bestScore = -Infinity;
  for (const card of playable) {
    let score = 0;
    if (card.value === 'wild4') score -= 8; // save wilds for when stuck
    else if (card.value === 'wild') score -= 6;
    if (isDrawCard(card) || card.value === 'skip' || card.value === 'reverse') {
      score += nextLow ? 10 : 1;
    }
    if (card.color !== 'wild') score += colorCounts[card.color] ?? 0;
    score += Math.random();
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

function bestColor(hand, excludeCard) {
  const counts = countColors(hand.filter((c) => c !== excludeCard));
  let best = null;
  let bestCount = -1;
  for (const color of COLORS) {
    if ((counts[color] ?? 0) > bestCount) {
      bestCount = counts[color] ?? 0;
      best = color;
    }
  }
  return bestCount > 0 ? best : COLORS[Math.floor(Math.random() * COLORS.length)];
}

function countColors(cards) {
  const counts = {};
  for (const c of cards) {
    if (c.color !== 'wild') counts[c.color] = (counts[c.color] ?? 0) + 1;
  }
  return counts;
}
