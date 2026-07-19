import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { sfx } from '../sfx';

export default function MuteButton() {
  const [muted, setMuted] = useState(sfx.isMuted());
  const label = muted ? 'Unmute sounds' : 'Mute sounds';

  const toggle = () => {
    const m = sfx.toggleMute();
    setMuted(m);
    if (!m) sfx.play('chat'); // audible confirmation that sound is back on
  };

  return (
    <button className="btn btn-ghost btn-sm mute-btn" title={label} aria-label={label} onClick={toggle}>
      <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} />
    </button>
  );
}
