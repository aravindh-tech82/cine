import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'http';

interface SSEClient {
  res: ServerResponse;
  senderId: string;
}

function localSignalingPlugin(): Plugin {
  // Store connected SSE response streams by roomId
  const rooms = new Map<string, Set<SSEClient>>();
  const roomHistory = new Map<string, any[]>();

  return {
    name: 'local-signaling-bridge',
    configureServer(server) {
      // 15-second keep-alive interval to prevent Chrome from closing idle EventSource streams
      const keepAliveInterval = setInterval(() => {
        rooms.forEach((clients) => {
          clients.forEach((client) => {
            try {
              client.res.write(': keep-alive\n\n');
            } catch {
              // Ignore broken client connections
            }
          });
        });
      }, 15000);

      server.httpServer?.on('close', () => {
        clearInterval(keepAliveInterval);
      });

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();

        // 1. SSE Stream: /api/signaling/events?roomId=...&senderId=...
        if (req.method === 'GET' && req.url.startsWith('/api/signaling/events')) {
          const url = new URL(req.url, 'http://localhost');
          const roomId = url.searchParams.get('roomId');
          const senderId = url.searchParams.get('senderId') || '';

          if (!roomId) {
            res.writeHead(400);
            return res.end('Missing roomId');
          }

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(': connected\n\n');

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          const roomClients = rooms.get(roomId)!;
          const currentClient: SSEClient = { res, senderId };
          roomClients.add(currentClient);

          // Replay persistent room announcements (join, movie-selected) to newly connected peer
          if (roomHistory.has(roomId)) {
            const history = roomHistory.get(roomId)!;
            history.forEach((msg) => {
              if (msg.senderId !== senderId && (msg.type === 'join' || msg.type === 'movie-selected')) {
                try {
                  res.write(`data: ${JSON.stringify(msg)}\n\n`);
                } catch {
                  // Ignore
                }
              }
            });
          }

          req.on('close', () => {
            roomClients.delete(currentClient);
            if (roomClients.size === 0) {
              rooms.delete(roomId);
              roomHistory.delete(roomId);
            }
          });
          return;
        }

        // 2. Broadcast send: POST /api/signaling/send
        if (req.method === 'POST' && req.url.startsWith('/api/signaling/send')) {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const roomId = data.roomId;
              const senderId = data.senderId;

              // Store persistent room messages
              if (roomId && (data.type === 'join' || data.type === 'movie-selected')) {
                if (!roomHistory.has(roomId)) {
                  roomHistory.set(roomId, []);
                }
                const history = roomHistory.get(roomId)!;
                const existingIdx = history.findIndex(
                  (m) => m.senderId === senderId && m.type === data.type
                );
                if (existingIdx !== -1) {
                  history[existingIdx] = data;
                } else {
                  history.push(data);
                }
              }

              if (roomId && rooms.has(roomId)) {
                const messageString = `data: ${JSON.stringify(data)}\n\n`;
                const roomClients = rooms.get(roomId)!;
                // Forward message to all clients in room EXCEPT the sender
                roomClients.forEach((client) => {
                  if (client.senderId !== senderId) {
                    try {
                      client.res.write(messageString);
                    } catch {
                      // Ignore broken client connection
                    }
                  }
                });
              }

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // 3. CORS preflight OPTIONS
        if (req.method === 'OPTIONS' && req.url.startsWith('/api/signaling')) {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          return res.end();
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    localSignalingPlugin(),
  ],
  preview: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
