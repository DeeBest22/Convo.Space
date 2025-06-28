import { Server } from 'socket.io';
import cors from 'cors';

export function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  return { io };
}

export function setupCorsMiddleware(app) {
  app.use(cors());
}