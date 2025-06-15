import http from 'http';
import { Server } from 'socket.io';
import app from './app';

const port = process.env.PORT || 8000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log('🟢 WebSocket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔴 WebSocket disconnected:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
