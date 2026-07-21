import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import { sfx } from './sfx';
import { bgm } from './bgm';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import EventToast from './components/EventToast';
import ChatPanel from './components/ChatPanel';

// Map room/game state onto the music engine's scene (phase + 0..1 intensity).
// Tension rises as anyone nears their last card, a draw stack is pending, or
// someone is sitting on UNO. Kept here because it reads the same state the SFX
// diffs do.
const INTENSITY_BY_MIN_CARDS = { 1: 0.95, 2: 0.8, 3: 0.62, 4: 0.5, 5: 0.38 };
function sceneFromGame(room, game) {
  if (!room) return { phase: 'off', intensity: 0 };
  if (room.status === 'lobby' || !game) return { phase: 'lobby', intensity: 0.15 };
  if (game.winnerId) return { phase: 'over', intensity: 0 };
  const minCards = Math.min(...game.players.map((p) => p.cardCount));
  let intensity = INTENSITY_BY_MIN_CARDS[minCards] ?? 0.25;
  if (game.pendingDraw > 0) intensity = Math.min(1, intensity + 0.12);
  if (game.players.some((p) => p.unoCalled)) intensity = Math.max(intensity, 0.85);
  return { phase: 'play', intensity };
}

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
        sfx.play('chat');
      }
    };
    const onEvents = (events) => events.forEach((e) => {
      addToast(e.text);
      // Events are plain text; the UNO catch is the one alert not visible in
      // per-player state diffs, so sniff it here.
      if (e.text.includes('caught')) sfx.play('buzz');
    });
    const onError = (e) => {
      addToast(e.message, { error: true });
      sfx.play('buzz');
    };
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

  // Card ids repeat between games (the deck is rebuilt with the same ids), so
  // Hand can't tell a rematch deal from a draw by itself. Track deals here and
  // remount Hand per deal via this key, computed during render so the remount
  // lands in the same commit as the new game state.
  const dealCount = useRef(0);
  const lastDealGame = useRef(null);
  if (game !== lastDealGame.current) {
    const prev = lastDealGame.current;
    if (game && (!prev || (prev.winnerId && !game.winnerId))) dealCount.current++;
    lastDealGame.current = game;
  }

  // Game sounds are derived from state diffs (server events are plain text).
  // Value comparisons make the periodic game:sync resend a no-op. Own-hand
  // draw sounds live in Hand.jsx, synced to the per-card reveal.
  const prevGame = useRef(null);
  useEffect(() => {
    const prev = prevGame.current;
    prevGame.current = game;
    if (!game) return;
    // Fresh deal (first game, rematch, or rejoin): riffle only, no move diffs.
    if (!prev || (prev.winnerId && !game.winnerId)) {
      if (!game.winnerId) sfx.play('shuffle');
      return;
    }
    if (game.topCard.id !== prev.topCard.id) sfx.play('play');
    if (game.winnerId) {
      if (!prev.winnerId) sfx.play(game.winnerId === me ? 'win' : 'lose');
    } else if (game.currentPlayerId === me && prev.currentPlayerId !== me) {
      sfx.play('turn');
    }
    for (const p of game.players) {
      const was = prev.players.find((x) => x.id === p.id);
      if (!was) continue;
      if (p.unoCalled && !was.unoCalled) sfx.play('uno');
      if (p.id !== me && p.cardCount > was.cardCount) sfx.play('draw');
    }
  }, [game, me]);

  // Feed the adaptive music engine. Value-compare (rounded intensity) so the
  // periodic game:sync resend doesn't re-trigger transitions.
  const prevScene = useRef({ phase: null, intensity: -1 });
  useEffect(() => {
    const scene = sceneFromGame(room, game);
    const p = prevScene.current;
    if (scene.phase === p.phase && Math.abs(scene.intensity - p.intensity) < 0.02) return;
    prevScene.current = scene;
    bgm.setScene(scene);
  }, [room, game]);

  const reset = useCallback(() => { setRoom(null); setGame(null); setChat([]); setChatOpen(false); }, []);

  let screen;
  if (!room) {
    screen = <Home />;
  } else if (room.status === 'lobby') {
    screen = <Lobby room={room} me={me} onLeave={reset} />;
  } else if (game) {
    screen = <GameTable room={room} game={game} me={me} dealKey={dealCount.current} onLeave={reset} />;
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
