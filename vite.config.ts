import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'http';

function localSignalingPlugin(): Plugin {
  // Store connected SSE response streams by roomId
  const rooms = new Map<string, Set<ServerResponse>>();

  return {
    name: 'local-signaling-bridge',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();

        // 1. SSE Stream: /api/signaling/events?roomId=...&senderId=...
        if (req.method === 'GET' && req.url.startsWith('/api/signaling/events')) {
          const url = new URL(req.url, 'http://localhost');
          const roomId = url.searchParams.get('roomId');

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
          roomClients.add(res);

          req.on('close', () => {
            roomClients.delete(res);
            if (roomClients.size === 0) rooms.delete(roomId);
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

              if (roomId && rooms.has(roomId)) {
                const messageString = `data: ${JSON.stringify(data)}\n\n`;
                const roomClients = rooms.get(roomId)!;
                roomClients.forEach((clientRes) => {
                  try {
                    clientRes.write(messageString);
                  } catch (e) {
                    // Ignore broken client connection
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
});
