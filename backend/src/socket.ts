import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from './utils/constants';
import { corsAllowedOrigins } from './index';
import pool from './config/database';

let io: Server | null = null;

// Track connected users: userId -> Set of socketIds (supports multiple devices)
const connectedUsers = new Map<number, Set<string>>();
// Which chat each socket currently has on screen, so a message the person is
// already looking at does not also ring as a push notification (board 25).
const openChats = new Map<string, number>();

const PRESENCE_FRESH_MS = 2 * 60 * 1000;

export async function isViewingChat(userId: number, matchId: number): Promise<boolean> {
  // Fast path: this instance holds the socket.
  const sockets = connectedUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      if (openChats.get(socketId) === matchId) return true;
    }
  }
  // Another Cloud Run instance may hold it: the app writes presence through.
  try {
    const row = await pool.query(
      `SELECT 1 FROM users
        WHERE id = $1 AND active_chat_match_id = $2
          AND active_chat_at > NOW() - ($3 || ' milliseconds')::interval`,
      [userId, matchId, String(PRESENCE_FRESH_MS)]
    );
    return row.rows.length > 0;
  } catch {
    return false;
  }
}

const persistPresence = (userId: number, matchId: number | null) => {
  pool
    .query('UPDATE users SET active_chat_match_id = $2, active_chat_at = CASE WHEN $2::int IS NULL THEN NULL ELSE NOW() END WHERE id = $1', [userId, matchId])
    .catch(() => {});
};

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

    // --- Chat presence ---
    socket.on('chat:open', (data: { matchId: number }) => {
      const matchId = Number(data?.matchId);
      if (!Number.isInteger(matchId)) return;
      openChats.set(socket.id, matchId);
      persistPresence(userId, matchId);
    });
    socket.on('chat:close', () => {
      openChats.delete(socket.id);
      persistPresence(userId, null);
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      if (openChats.has(socket.id)) persistPresence(userId, null);
      openChats.delete(socket.id);
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
