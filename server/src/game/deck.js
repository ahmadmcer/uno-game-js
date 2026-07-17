export const COLORS = ['red', 'yellow', 'green', 'blue'];

// Standard 108-card UNO deck: per color one 0, two of 1-9, two of each
// action card; plus four Wilds and four Wild Draw Fours.
export function buildDeck() {
  const cards = [];
  let id = 0;
  const add = (color, value) => cards.push({ id: `c${id++}`, color, value });
  for (const color of COLORS) {
    add(color, '0');
    for (let n = 1; n <= 9; n++) {
      add(color, String(n));
      add(color, String(n));
    }
    for (const action of ['skip', 'reverse', 'draw2']) {
      add(color, action);
      add(color, action);
    }
  }
  for (let i = 0; i < 4; i++) {
    add('wild', 'wild');
    add('wild', 'wild4');
  }
  return cards;
}

export function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
