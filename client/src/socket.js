import { io } from 'socket.io-client';

// crypto.randomUUID only exists in secure contexts (https/localhost); LAN
// players arrive over plain http://<ip>, so fall back to getRandomValues.
const makeToken = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// Per-tab session token: survives a refresh (reconnect keeps your seat) but
// separate tabs get separate identities, so one browser can host two players.
let token = sessionStorage.getItem('uno-token');
if (!token) {
  token = makeToken();
  sessionStorage.setItem('uno-token', token);
}

export const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
