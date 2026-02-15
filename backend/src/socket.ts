import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from './utils/constants';
import { corsAllowedOrigins } from './index';

let io: Server | null = null;

// Track connected users: userId -> Set of socketIds (supports multiple devices)
const connectedUsers = new Map<number, Set<string>>();

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsAllowedOrigins || '*',
      methods: ['GET', 'POST'],
    },
  });

  // JWT authentication middleware on handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_CONFIG.secret) as { userId: number };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId: number = (socket as any).userId;

    // Track this socket for the user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)!.add(socket.id);

    // Auto-join user's personal room
    socket.join(`user:${userId}`);

    console.log(`Socket connected: user ${userId} (socket ${socket.id})`);

    // --- Typing events ---
    socket.on('typing:start', (data: { matchId: number; recipientId: number }) => {
      io!.to(`user:${data.recipientId}`).emit('typing', {
        matchId: data.matchId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { matchId: number; recipientId: number }) => {
      io!.to(`user:${data.recipientId}`).emit('typing', {
        matchId: data.matchId,
        userId,
        isTyping: false,
      });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      const sockets = connectedUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
      console.log(`Socket disconnected: user ${userId} (socket ${socket.id})`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}
