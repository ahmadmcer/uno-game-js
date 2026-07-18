import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faUser, faXmark, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import { socket } from '../socket';

const RULE_DEFS = [
  ['stacking', 'Stacking', 'Answer a +2/+4 with your own — the penalty piles up and passes along'],
  ['drawUntilPlayable', 'Draw to match', "Can't play? Keep drawing until you find a playable card"],
  ['jumpIn', 'Jump-in', 'Holding an identical card? Slap it down out of turn'],
];

export default function Lobby({ room, me, onLeave }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === me;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const setRule = (key, value) => socket.emit('room:setRules', { [key]: value });

  const leave = () => {
    socket.emit('room:leave');
    onLeave();
  };

  return (
    <div className="lobby-wrap">
      <div className="panel lobby">
        <div className="lobby-head">
          <div>
            <div className="label">Room code</div>
            <div className="room-code">{room.code}</div>
          </div>
          <button className="btn btn-ghost" onClick={copy}>
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="players">
          {room.players.map((p) => (
            <div key={p.id} className="player-row">
              <span className="player-icon">
                <FontAwesomeIcon icon={p.isBot ? faRobot : faUser} />
              </span>
              <span className="player-name">{p.name}</span>
              {p.id === room.hostId && <span className="tag">host</span>}
              {p.id === me && <span className="tag you">you</span>}
              {!p.isBot && !p.connected && <span className="tag warn">offline</span>}
              {p.isBot && isHost && (
                <button
                  className="btn-x"
                  title="Remove bot"
                  onClick={() => socket.emit('room:removeBot', { botId: p.id })}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="lobby-row">
          <button
            className="btn btn-ghost"
            disabled={!isHost || room.players.length >= room.maxPlayers}
            onClick={() => socket.emit('room:addBot')}
          >
            + Add bot
          </button>
          <span className="hint">{room.players.length}/{room.maxPlayers} players</span>
        </div>

        <div className="rules">
          <div className="label">House rules{!isHost && ' (host decides)'}</div>
          {RULE_DEFS.map(([key, title, desc]) => (
            <label key={key} className="rule-row">
              <input
                type="checkbox"
                checked={!!room.rules[key]}
                disabled={!isHost}
                onChange={(e) => setRule(key, e.target.checked)}
              />
              <span>
                <strong>{title}</strong>
                <br />
                <small>{desc}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="lobby-actions">
          {isHost ? (
            <button
              className="btn btn-primary"
              disabled={room.players.length < 2}
              onClick={() => socket.emit('room:start')}
            >
              Start game
            </button>
          ) : (
            <span className="hint">Waiting for the host to start…</span>
          )}
          <button className="btn btn-ghost" onClick={leave}>Leave</button>
        </div>
      </div>
    </div>
  );
}
