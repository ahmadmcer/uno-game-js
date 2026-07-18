import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';

export default function ChatPanel({ messages, me, open, setOpen }) {
  const [text, setText] = useState('');
  const [readCount, setReadCount] = useState(0);
  const listRef = useRef(null);

  const unread = open ? 0 : Math.max(0, messages.length - readCount);

  useEffect(() => {
    if (open) {
      setReadCount(messages.length);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [open, messages]);

  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    socket.emit('chat:send', { text: clean });
    setText('');
  };

  return (
    <div className="chat">
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <span className="label">Chat</span>
            <button className="btn-x" title="Close chat" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-list" ref={listRef}>
            {messages.length === 0 && <div className="hint">Say hi 👋</div>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.playerId === me ? 'mine' : ''}`}>
                <span className="chat-name">{m.name}</span>
                <span className="chat-bubble">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              placeholder="Message…"
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn btn-ghost btn-sm" onClick={send}>Send</button>
          </div>
        </div>
      )}
      <button className="chat-fab" title="Chat" onClick={() => setOpen((o) => !o)}>
        💬
        {unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>
    </div>
  );
}
