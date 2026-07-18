import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { socket } from '../socket';
import { canPlay, canJumpIn } from '../rules';
import Card from './Card';
import Hand from './Hand';
import OpponentSeat from './OpponentSeat';
import ColorPicker from './ColorPicker';
import GameOver from './GameOver';

export default function GameTable({ room, game, me, onLeave }) {
  const [wildCard, setWildCard] = useState(null);

  const players = game.players;
  const myIndex = Math.max(0, players.findIndex((p) => p.id === me));
  const meState = players.find((p) => p.id === me);
  const myTurn = game.currentPlayerId === me && !game.winnerId;
  const top = game.topCard;
  const drawnId = game.drawnPlayableCardId;

  const opponents = [];
  for (let i = 1; i < players.length; i++) {
    opponents.push(players[(myIndex + i) % players.length]);
  }

  const playableIds = new Set();
  const jumpIds = new Set();
  if (!game.winnerId) {
    if (myTurn) {
      if (drawnId) {
        playableIds.add(drawnId);
      } else {
        for (const c of game.hand) {
          if (canPlay(c, top, game.activeColor, game.pendingDraw)) playableIds.add(c.id);
        }
      }
    } else if (game.rules.jumpIn && game.pendingDraw === 0) {
      for (const c of game.hand) {
        if (canJumpIn(c, top)) jumpIds.add(c.id);
      }
    }
  }

  const clickCard = (card) => {
    if (playableIds.has(card.id)) {
      if (card.color === 'wild') setWildCard(card);
      else socket.emit('game:play', { cardId: card.id });
    } else if (jumpIds.has(card.id)) {
      socket.emit('game:jumpIn', { cardId: card.id });
    }
  };

  const currentPlayer = players.find((p) => p.id === game.currentPlayerId);
  const vulnerable =
    game.unoVulnerable && game.unoVulnerable !== me
      ? players.find((p) => p.id === game.unoVulnerable)
      : null;

  let status = '';
  if (!game.winnerId) {
    if (myTurn) {
      if (game.pendingDraw > 0) status = `Stack a draw card or take the +${game.pendingDraw}!`;
      else if (drawnId) status = 'Play the drawn card — or keep it';
      else status = 'Your turn!';
    } else {
      status = `Waiting for ${currentPlayer?.name ?? '…'}`;
    }
  }

  const leave = () => {
    socket.emit('room:leave');
    onLeave();
  };

  return (
    <div className="table">
      <div className="table-header">
        <span className="room-tag">Room {room.code}</span>
        <span className="rules-tags">
          {game.rules.stacking && <em>stacking</em>}
          {game.rules.drawUntilPlayable && <em>draw-to-match</em>}
          {game.rules.jumpIn && <em>jump-in</em>}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={leave}>Leave</button>
      </div>

      <div className="opponents">
        {opponents.map((p) => <OpponentSeat key={p.id} player={p} />)}
      </div>

      <div className="center-area">
        <div
          className={`pile draw-pile ${myTurn && !drawnId ? 'clickable' : ''}`}
          title="Draw"
          onClick={() => myTurn && !drawnId && socket.emit('game:draw')}
        >
          <Card faceDown />
          <span key={game.drawPileCount} className="pile-count">{game.drawPileCount}</span>
          {game.pendingDraw > 0 && <span className="pending-badge">+{game.pendingDraw}</span>}
        </div>
        <div className={`pile glow-${game.activeColor}`}>
          <div key={top.id} className="played-wrap">
            <Card card={top} />
          </div>
        </div>
        <div className={`direction ${game.direction === -1 ? 'ccw' : ''}`}>
          <FontAwesomeIcon icon={game.direction === -1 ? faRotateLeft : faRotateRight} />
        </div>
      </div>

      <div className={`status-bar ${myTurn ? 'your-turn' : ''}`}>{status}</div>

      <div className="action-bar">
        {myTurn && drawnId && (
          <button className="btn btn-ghost" onClick={() => socket.emit('game:pass')}>
            Keep it
          </button>
        )}
        {!game.winnerId && meState && game.hand.length > 0 && game.hand.length <= 2 && !meState.unoCalled && (
          <button className="btn uno-btn" onClick={() => socket.emit('game:uno')}>UNO!</button>
        )}
        {!game.winnerId && vulnerable && (
          <button
            className="btn catch-btn"
            onClick={() => socket.emit('game:catchUno', { targetId: vulnerable.id })}
          >
            Catch {vulnerable.name}!
          </button>
        )}
      </div>

      <Hand
        cards={game.hand}
        playableIds={playableIds}
        jumpIds={jumpIds}
        myTurn={myTurn}
        onClickCard={clickCard}
      />

      {wildCard && (
        <ColorPicker
          onPick={(color) => {
            socket.emit('game:play', { cardId: wildCard.id, color });
            setWildCard(null);
          }}
          onCancel={() => setWildCard(null)}
        />
      )}

      {game.winnerId && <GameOver game={game} room={room} me={me} onLeave={leave} />}
    </div>
  );
}
