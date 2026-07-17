import { useState } from 'react';
import { socket } from '../socket';

export default function Home() {
  const [name, setName] = useState(localStorage.getItem('uno-name') || '');
  const [code, setCode] = useState('');
  const ready = name.trim().length > 0;

  const remember = () => localStorage.setItem('uno-name', name.trim());

  const create = () => {
    if (!ready) return;
    remember();
    socket.emit('room:create', { name: name.trim() });
  };

  const join = () => {
    if (!ready || code.trim().length < 4) return;
    remember();
    socket.emit('room:join', { code: code.trim(), name: name.trim() });
  };

  return (
    <div className="home">
      <h1 className="logo">UNO</h1>
      <div className="panel home-panel">
        <input
          type="text"
          placeholder="Your name"
          maxLength={20}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary" disabled={!ready} onClick={create}>
          Create a room
        </button>
        <div className="divider">— or join a friend —</div>
        <div className="join-row">
          <input
            type="text"
            className="code-input"
            placeholder="CODE"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className="btn" disabled={!ready || code.length < 4} onClick={join}>
            Join
          </button>
        </div>
      </div>
      <p className="hint">Play with friends online — bots can fill the empty seats.</p>
    </div>
  );
}
