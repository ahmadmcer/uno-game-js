import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import EventToast from './components/EventToast';

export default function App() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const toastId = useRef(0);

  const addToast = useCallback((text, error = false) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    const onMe = ({ playerId }) => setMe(playerId);
    const onRoom = (r) => {
      setRoom(r);
      if (r.status === 'lobby') setGame(null);
    };
    const onNone = () => { setRoom(null); setGame(null); };
    const onState = (g) => setGame(g);
    const onEvents = (events) => events.forEach((e) => addToast(e.text));
    const onError = (e) => addToast(e.message, true);
    const onConnect = () => {
      setConnected(true);
      socket.emit('game:sync');
    };
    const onDisconnect = () => setConnected(false);
    // Safety net against silently dropped packets (flaky proxies, sleeping
    // laptops, backgrounded mobile tabs): cheap periodic resync.
    const syncTimer = setInterval(() => socket.emit('game:sync'), 4000);

    socket.on('me', onMe);
    socket.on('room:update', onRoom);
    socket.on('room:none', onNone);
    socket.on('game:state', onState);
    socket.on('game:event', onEvents);
    socket.on('game:error', onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      clearInterval(syncTimer);
      socket.off('me', onMe);
      socket.off('room:update', onRoom);
      socket.off('room:none', onNone);
      socket.off('game:state', onState);
      socket.off('game:event', onEvents);
      socket.off('game:error', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [addToast]);

  const reset = useCallback(() => { setRoom(null); setGame(null); }, []);

  let screen;
  if (!room) {
    screen = <Home />;
  } else if (room.status === 'lobby') {
    screen = <Lobby room={room} me={me} onLeave={reset} />;
  } else if (game) {
    screen = <GameTable room={room} game={game} me={me} onLeave={reset} />;
  } else {
    screen = <div className="loading">Dealing cards…</div>;
  }

  return (
    <div className="app">
      {!connected && <div className="conn-banner">Reconnecting…</div>}
      {screen}
      <EventToast toasts={toasts} />
    </div>
  );
}
