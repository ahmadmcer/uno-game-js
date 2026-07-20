import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

// Privacy toggle for same-room play: covers your own hand so someone glancing
// at your screen can't read your cards. Purely local — the icon mirrors the
// current state (eye-slash while hiding, like MuteButton shows the muted icon).
export default function HideButton({ on, onToggle }) {
  const label = on ? 'Show my cards' : 'Hide my cards';

  return (
    <button className="btn btn-ghost btn-sm mute-btn" title={label} aria-label={label} onClick={onToggle}>
      <FontAwesomeIcon icon={on ? faEyeSlash : faEye} />
    </button>
  );
}
