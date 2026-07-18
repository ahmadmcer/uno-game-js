import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import EventToast from './components/EventToast';
import ChatPanel from './components/ChatPanel';

export default function App() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const toastId = useRef(0);
  // Socket listeners are registered once, so they read the latest me/chatOpen
  // through this ref instead of stale closures.
  const chatCtx = useRef({ me: null, chatOpen: false });
  chatCtx.current = { me, chatOpen };

  const addToast = useCallback((text, { error = false, chat = false, onClick, duration = 4500 } = {}) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), { id, text, error, chat, onClick }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  useEffect(() => {
    const onMe = ({ playerId }) => setMe(playerId);
    const onRoom = (r) => {
      setRoom(r);
      if (r.status === 'lobby') setGame(null);
    };
    const onNone = () => { setRoom(null); setGame(null); setChat([]); setChatOpen(false); };
    const onState = (g) => setGame(g);
    const onChatHistory = (msgs) => setChat(msgs);
    const onChatMessage = (msg) => {
      setChat((c) => [...c.slice(-49), msg]);
      const ctx = chatCtx.current;
      if (msg.playerId !== ctx.me && !ctx.chatOpen) {
        const preview = msg.text.length > 60 ? `${msg.text.slice(0, 60)}…` : msg.text;
        addToast(`${msg.name}: ${preview}`, { chat: true, duration: 8000, onClick: () => setChatOpen(true) });
      }
    };
    const onEvents = (events) => events.forEach((e) => addToast(e.text));
    const onError = (e) => addToast(e.message, { error: true });
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
    socket.on('chat:history', onChatHistory);
    socket.on('chat:message', onChatMessage);
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
      socket.off('chat:history', onChatHistory);
      socket.off('chat:message', onChatMessage);
      socket.off('game:event', onEvents);
      socket.off('game:error', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [addToast]);

  const reset = useCallback(() => { setRoom(null); setGame(null); setChat([]); setChatOpen(false); }, []);

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
      {room && <ChatPanel messages={chat} me={me} open={chatOpen} setOpen={setChatOpen} />}
      <EventToast toasts={toasts} raised={!!room} />
    </div>
  );
}
