import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachSockets } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
attachSockets(io);

// In production, serve the built client from the same port.
const dist = path.resolve(__dirname, '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = process.env.UNO_PORT || 3001;
httpServer.listen(port, () => {
  console.log(`UNO server listening on http://localhost:${port}`);
});
