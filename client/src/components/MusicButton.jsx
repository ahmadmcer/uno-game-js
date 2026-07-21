import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic } from '@fortawesome/free-solid-svg-icons';
import { bgm } from '../bgm';

// Toggles the adaptive background music, independent of the SFX mute. Dims the
// note icon when off (there's no reliable free "music-slash" glyph).
export default function MusicButton() {
  const [on, setOn] = useState(bgm.isEnabled());
  const label = on ? 'Music on' : 'Music off';

  const toggle = () => setOn(bgm.toggleEnabled());

  return (
    <button
      className={`btn btn-ghost btn-sm mute-btn music-btn${on ? '' : ' is-off'}`}
      title={label}
      aria-label={label}
      onClick={toggle}
    >
      <FontAwesomeIcon icon={faMusic} />
    </button>
  );
}
