export default function EventToast({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.error ? 'error' : ''}`}>{t.text}</div>
      ))}
    </div>
  );
}
