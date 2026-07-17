import { socket } from '../socket';

export default function GameOver({ game, room, me, onLeave }) {
  const winner = game.players.find((p) => p.id === game.winnerId);
  const isHost = room.hostId === me;
  const youWon = game.winnerId === me;

  return (
    <div className="overlay">
      <div className="modal">
        <div className="gameover-emoji">{youWon ? '🏆' : '🎉'}</div>
        <h2>{youWon ? 'You win!' : `${winner?.name ?? 'Someone'} wins!`}</h2>
        {isHost ? (
          <button className="btn btn-primary" onClick={() => socket.emit('game:rematch')}>
            Play again
          </button>
        ) : (
          <p className="hint">Waiting for the host to start a rematch…</p>
        )}
        <div className="gameover-leave">
          <button className="btn btn-ghost" onClick={onLeave}>Leave room</button>
        </div>
      </div>
    </div>
  );
}
