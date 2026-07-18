import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-solid-svg-icons';

export default function EventToast({ toasts, raised }) {
  return (
    <div className={`toasts ${raised ? 'raised' : ''}`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.error ? 'error' : ''} ${t.chat ? 'chat-toast' : ''}`}
          onClick={t.onClick}
        >
          {t.chat && <><FontAwesomeIcon icon={faComment} />{' '}</>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
