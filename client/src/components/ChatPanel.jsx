import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faXmark, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
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
            <button className="btn-x" title="Close chat" onClick={() => setOpen(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
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
            <button className="btn btn-ghost btn-sm" title="Send" aria-label="Send" onClick={send}>
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </div>
        </div>
      )}
      <button className="chat-fab" title="Chat" onClick={() => setOpen((o) => !o)}>
        <FontAwesomeIcon icon={faComments} />
        {unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>
    </div>
  );
}
