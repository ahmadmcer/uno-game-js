// Client-side mirror of the server's play validation, used only to highlight
// which cards are clickable — the server remains the authority.
export function canPlay(card, topCard, activeColor, pendingDraw = 0) {
  const wild = card.color === 'wild';
  const drawCard = card.value === 'draw2' || card.value === 'wild4';
  const match = wild || card.color === activeColor || card.value === topCard.value;
  if (pendingDraw > 0) return drawCard && match;
  return match;
}

export function canJumpIn(card, topCard) {
  return card.color !== 'wild' && card.color === topCard.color && card.value === topCard.value;
}
