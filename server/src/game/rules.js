export const COLORS = ['red', 'yellow', 'green', 'blue'];

export const isWild = (card) => card.color === 'wild';
export const isDrawCard = (card) => card.value === 'draw2' || card.value === 'wild4';

function matches(card, topCard, activeColor) {
  if (isWild(card)) return true;
  return card.color === activeColor || card.value === topCard.value;
}

// When a draw stack is pending (stacking rule), only draw cards that would
// normally match may be played on top of it.
export function canPlay(card, topCard, activeColor, pendingDraw = 0) {
  if (pendingDraw > 0) return isDrawCard(card) && matches(card, topCard, activeColor);
  return matches(card, topCard, activeColor);
}

export function canJumpIn(card, topCard) {
  return !isWild(card) && card.color === topCard.color && card.value === topCard.value;
}

const NAMES = {
  skip: 'Skip',
  reverse: 'Reverse',
  draw2: 'Draw Two',
  wild: 'Wild',
  wild4: 'Wild Draw Four',
};

export function describeCard(card) {
  if (isWild(card)) return NAMES[card.value];
  return `${card.color} ${NAMES[card.value] ?? card.value}`;
}
