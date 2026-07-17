import Card from './Card';

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
const VALUE_ORDER = { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 };
const valueOrder = (v) => VALUE_ORDER[v] ?? Number(v);

export default function Hand({ cards, playableIds, jumpIds, myTurn, onClickCard }) {
  const sorted = [...cards].sort(
    (a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || valueOrder(a.value) - valueOrder(b.value),
  );
  return (
    <div className="hand">
      {sorted.map((c) => (
        <Card
          key={c.id}
          card={c}
          playable={playableIds.has(c.id)}
          jumpable={jumpIds.has(c.id)}
          dimmed={myTurn && !playableIds.has(c.id)}
          onClick={() => onClickCard(c)}
        />
      ))}
    </div>
  );
}
