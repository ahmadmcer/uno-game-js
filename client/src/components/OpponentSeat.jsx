import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import Card from './Card';

export default function OpponentSeat({ player }) {
  return (
    <div className={`seat ${player.isCurrent ? 'current' : ''} ${!player.connected ? 'offline' : ''}`}>
      <div className="seat-name">
        {player.isBot && <><FontAwesomeIcon icon={faRobot} />{' '}</>}
        {player.name}
      </div>
      <div className="seat-cards">
        <Card faceDown small />
        <span key={player.cardCount} className="seat-count">×{player.cardCount}</span>
      </div>
      {player.cardCount === 1 && (
        <span className="uno-badge">{player.unoCalled ? 'UNO!' : '1 card!'}</span>
      )}
      {!player.connected && <span className="tag warn">offline</span>}
    </div>
  );
}
