import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sfx } from '../sfx';
import Card from './Card';

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
const VALUE_ORDER = { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 };
const valueOrder = (v) => VALUE_ORDER[v] ?? Number(v);

// How long a card counts as "just dealt". The enter class must survive the
// re-renders that follow a draw (toasts, state updates) or the animation gets
// cancelled mid-flight; by the time this expires the animation has finished.
const ENTER_FRESH_MS = 1000;
// Multi-card draws (draw-to-match, penalties) reveal one card at a time so it
// reads as drawing continuously; the server still sends the batch atomically.
const REVEAL_INTERVAL_MS = 160;

export default function Hand({ cards, playableIds, jumpIds, myTurn, onClickCard }) {
  const dealt = useRef(new Map()); // id -> { delay, at }: drives the deal animation
  const prevIds = useRef(null); // ids after the previous cards-change (null = first render)
  const hidden = useRef(new Set()); // queued batch cards not yet revealed
  const revealTimer = useRef(null);
  const [, setTick] = useState(0);
  const tick = () => setTick((t) => t + 1);

  useLayoutEffect(() => {
    const idSet = new Set(cards.map((c) => c.id));
    for (const id of [...dealt.current.keys()]) {
      if (!idSet.has(id)) dealt.current.delete(id); // forget played cards so a redraw animates again
    }
    let changed = false;
    for (const id of [...hidden.current]) {
      if (!idSet.has(id)) { hidden.current.delete(id); changed = true; }
    }

    if (prevIds.current === null) {
      prevIds.current = idSet; // initial hand: render at once with the CSS stagger
    } else {
      const added = cards.filter((c) => !prevIds.current.has(c.id));
      prevIds.current = idSet;
      if (added.length >= 1) sfx.play('draw'); // the first (or only) card; reveals tick the rest
      if (added.length > 1) {
        for (const c of added.slice(1)) hidden.current.add(c.id);
        changed = true;
      }
    }
    if (changed) tick(); // layout effect: extras are hidden again before paint

    if (hidden.current.size && !revealTimer.current) {
      const revealNext = () => {
        revealTimer.current = null;
        const [next] = hidden.current;
        if (next === undefined) return;
        hidden.current.delete(next);
        dealt.current.set(next, { delay: 0, at: Date.now() }); // animate on reveal, not batch time
        sfx.play('draw');
        tick();
        if (hidden.current.size) revealTimer.current = setTimeout(revealNext, REVEAL_INTERVAL_MS);
      };
      revealTimer.current = setTimeout(revealNext, REVEAL_INTERVAL_MS);
    }
  }, [cards]);

  useEffect(() => () => clearTimeout(revealTimer.current), []);

  const now = Date.now();
  const visible = [...cards]
    .sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || valueOrder(a.value) - valueOrder(b.value))
    .filter((c) => !hidden.current.has(c.id));

  let batchIndex = 0;
  return (
    <div className="hand">
      {visible.map((c) => {
        if (!dealt.current.has(c.id)) {
          dealt.current.set(c.id, { delay: Math.min(batchIndex++ * 60, 480), at: now });
        }
        const info = dealt.current.get(c.id);
        const entering = now - info.at < ENTER_FRESH_MS;
        return (
          <Card
            key={c.id}
            card={c}
            entering={entering}
            enterDelay={info.delay}
            playable={playableIds.has(c.id)}
            jumpable={jumpIds.has(c.id)}
            dimmed={myTurn && !playableIds.has(c.id)}
            onClick={() => onClickCard(c)}
          />
        );
      })}
    </div>
  );
}
