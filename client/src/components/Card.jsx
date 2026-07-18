import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faRightLeft, faStar } from '@fortawesome/free-solid-svg-icons';

const ICONS = { skip: faBan, reverse: faRightLeft, wild: faStar };
const TEXT = { draw2: '+2', wild4: '+4' };

export default function Card({ card, faceDown, small, playable, jumpable, dimmed, entering, enterDelay, onClick }) {
  const cls = ['card'];
  if (small) cls.push('card-small');

  if (faceDown || !card) {
    cls.push('card-back');
    return (
      <div className={cls.join(' ')} onClick={onClick}>
        <div className="card-oval" />
        <span className="card-logo">UNO</span>
      </div>
    );
  }

  cls.push(`card-${card.color}`);
  if (playable) cls.push('playable');
  if (jumpable) cls.push('jumpable');
  if (dimmed && !playable && !jumpable) cls.push('dimmed');
  if (entering) cls.push('card-enter');

  const label = ICONS[card.value]
    ? <FontAwesomeIcon icon={ICONS[card.value]} />
    : (TEXT[card.value] ?? card.value);
  const wild = card.color === 'wild';

  return (
    <div
      className={cls.join(' ')}
      style={entering ? { animationDelay: `${enterDelay || 0}ms` } : undefined}
      onClick={onClick}
    >
      <span className="corner top">{label}</span>
      <div className="card-oval" />
      {wild ? (
        <div className="wild-circle">
          {card.value === 'wild4' && <span className="wild-plus">+4</span>}
        </div>
      ) : (
        <span className="card-value">{label}</span>
      )}
      <span className="corner bottom">{label}</span>
    </div>
  );
}
