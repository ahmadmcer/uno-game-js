export default function EventToast({ toasts, raised }) {
  return (
    <div className={`toasts ${raised ? 'raised' : ''}`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.error ? 'error' : ''} ${t.chat ? 'chat-toast' : ''}`}
          onClick={t.onClick}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
