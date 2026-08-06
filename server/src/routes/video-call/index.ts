import { Router, Request, Response } from 'express';
import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { adminClient } from '../../lib/supabase-admin.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { notificationQueue } from '../../jobs/notificationWorker.js';
import { roomManager } from '../../media/roomManager.js';

// ── Types ──

interface PeerInfo {
  id: string;
  displayName: string;
}

interface RoomMeta {
  id: string;
  createdAt: string;
  peerCount: number;
  peers: { id: string; displayName: string }[];
}

interface Room {
  id: string;
  createdAt: string;
  peers: Map<string, PeerInfo>;
}

interface PendingCall {
  callerUserId: string;
  calleeUserId: string;
  callerSocketIds: Set<string>;
  calleeSocketIds: Set<string>;
  callerInfo: { displayName: string; avatar_url?: string };
  roomId: string;
}

interface SocketData {
  userId?: string;
  peer?: PeerInfo;
}

interface ClientToServerEvents {
  'room:join': (data: { roomId: string; peer: PeerInfo }, callback: (ack: { success: boolean; error?: string }) => void) => void;
  'room:leave': (data: { roomId: string }) => void;
  'signal:offer': (data: { roomId: string; to: string; offer: unknown }) => void;
  'signal:answer': (data: { roomId: string; to: string; answer: unknown }) => void;
  'signal:ice-candidate': (data: { roomId: string; to: string; candidate: unknown }) => void;
  // Call signaling
  'call:outgoing': (data: { to: string; roomId: string; callerInfo: { displayName: string; avatar_url?: string } }) => void;
  'call:accept': (data: { roomId: string }) => void;
  'call:reject': (data: { roomId: string }) => void;
  'call:end': (data: { roomId: string }) => void;
  'call:cancel': (data: { roomId: string }) => void;
}

interface ServerToClientEvents {
  'room:joined': (data: { roomId: string; peers: PeerInfo[] }) => void;
  'room:peer-joined': (data: { peer: PeerInfo }) => void;
  'room:peer-left': (data: { peerId: string }) => void;
  'signal:offer': (data: { from: string; offer: unknown }) => void;
  'signal:answer': (data: { from: string; answer: unknown }) => void;
  'signal:ice-candidate': (data: { from: string; candidate: unknown }) => void;
  'room:error': (data: { message: string }) => void;
  'room:force-ended': (data: { reason: string }) => void;
  // Call signaling
  'call:incoming': (data: { from: { id: string; displayName: string; avatar_url?: string }; roomId: string }) => void;
  'call:accepted': (data: { roomId: string }) => void;
  'call:rejected': (data: { roomId: string }) => void;
  'call:ended': (data: { roomId: string; by: string }) => void;
  'call:cancelled': (data: { roomId: string }) => void;
  'call:unavailable': (data: { roomId: string }) => void;
}

// ── In-memory stores ──

const rooms = new Map<string, Room>();
/** userId → Set of socketIds (supports multi-device) */
const userSockets = new Map<string, Set<string>>();
/** roomId → PendingCall details for active call invitations */
const pendingCalls = new Map<string, PendingCall>();

function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

function createRoom(roomId: string): Room {
  const room: Room = { id: roomId, createdAt: new Date().toISOString(), peers: new Map() };
  rooms.set(roomId, room);
  return room;
}

function removePeerFromAllRooms(socket: Socket<ClientToServerEvents, ServerToClientEvents, any, SocketData>) {
  const peerInfo = socket.data.peer;
  if (!peerInfo) return;

  for (const [roomId, room] of rooms) {
    if (room.peers.has(peerInfo.id)) {
      room.peers.delete(peerInfo.id);
      socket.leave(roomId);
      socket.to(roomId).emit('room:peer-left', { peerId: peerInfo.id });
      if (room.peers.size === 0) {
        rooms.delete(roomId);
      }
    }
  }
}

function forceEndRoom(roomId: string, io: Server<ClientToServerEvents, ServerToClientEvents, any, SocketData>, reason: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room:force-ended', { reason });
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (sockets) {
    for (const socketId of sockets) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.leave(roomId);
      }
    }
  }
  rooms.delete(roomId);
}

/** Register a user's socket for presence / call routing */
function registerUserSocket(userId: string, socketId: string) {
  let sockets = userSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    userSockets.set(userId, sockets);
  }
  sockets.add(socketId);
}

/** Unregister a user's socket on disconnect */
function unregisterUserSocket(userId: string, socketId: string) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) userSockets.delete(userId);
}

/** Check if a user has any active socket connections */
function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return !!sockets && sockets.size > 0;
}

/** Get all socket IDs for a user */
function getUserSocketIds(userId: string): string[] {
  const sockets = userSockets.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/** Clean up pending calls involving a user (when they disconnect) */
function cleanupPendingCallsForUser(userId: string, socketId: string, io: Server<ClientToServerEvents, ServerToClientEvents, any, SocketData>) {
  for (const [roomId, call] of pendingCalls) {
    // If disconnecting socket was the caller
    if (call.callerSocketIds.has(socketId)) {
      call.callerSocketIds.delete(socketId);
      // Notify callee that call was cancelled
      for (const sid of call.calleeSocketIds) {
        io.to(sid).emit('call:cancelled', { roomId });
      }
      pendingCalls.delete(roomId);
      return;
    }
    // If disconnecting socket was the callee
    if (call.calleeSocketIds.has(socketId)) {
      call.calleeSocketIds.delete(socketId);
      // Notify caller that callee is gone
      for (const sid of call.callerSocketIds) {
        io.to(sid).emit('call:cancelled', { roomId });
      }
      pendingCalls.delete(roomId);
      return;
    }
  }
}

// ── Express Router (admin + token endpoints) ──

export const videoCallRouter: Router = Router();

const JITSI_APP_ID = process.env.JITSI_APP_ID || 'vpaas-magic-cookie-1c2a6cf898fe492281f3afe3c0c8d2f0';
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || '';

videoCallRouter.post('/token', async (req: Request, res: Response) => {
  const user = req.user!;

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', user.id)
    .single();

  const fullName = profile?.full_name || user.email || 'User';
  const email = profile?.email || user.email || '';
  const avatar = profile?.avatar_url || '';

  if (!JITSI_APP_SECRET) {
    res.json({
      jwt: null,
      domain: '8x8.vc',
      appId: JITSI_APP_ID,
      roomPrefix: JITSI_APP_ID,
      displayName: fullName,
    });
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  const token = jwt.sign(
    {
      aud: 'jitsi',
      iss: JITSI_APP_ID,
      iat: now,
      exp: now + 3600,
      nbf: now - 5,
      sub: JITSI_APP_ID,
      room: '*',
      context: {
        user: {
          id: user.id,
          name: fullName,
          email,
          avatar,
        },
        features: {
          livestreaming: false,
          'file-upload': false,
          'outbound-call': false,
          transcription: false,
          recording: false,
        },
      },
    },
    JITSI_APP_SECRET,
    { algorithm: 'HS256' },
  );

  res.json({
    jwt: token,
    domain: '8x8.vc',
    appId: JITSI_APP_ID,
    roomPrefix: JITSI_APP_ID,
    displayName: fullName,
  });
});

videoCallRouter.use(requireAdmin);

/** GET /video-call/admin/rooms — list active rooms with peer info */
videoCallRouter.get('/admin/rooms', (_req: Request, res: Response) => {
  const roomList: RoomMeta[] = [];
  for (const [, room] of rooms) {
    roomList.push({
      id: room.id,
      createdAt: room.createdAt,
      peerCount: room.peers.size,
      peers: Array.from(room.peers.values()),
    });
  }
  res.json({ data: roomList });
});

/** GET /video-call/admin/rooms/:roomId — single room detail */
videoCallRouter.get('/admin/rooms/:roomId', (req: Request, res: Response) => {
  const room = rooms.get(req.params.roomId);
  if (!room) throw new AppError(404, 'Room not found');
  res.json({
    data: {
      id: room.id,
      createdAt: room.createdAt,
      peerCount: room.peers.size,
      peers: Array.from(room.peers.values()),
    },
  });
});

/**
 * POST /video-call/admin/rooms/:roomId/end — force-end a room.
 * The actual force-end logic runs after response is sent via a stored io reference.
 */
videoCallRouter.post('/admin/rooms/:roomId/end', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) throw new AppError(404, 'Room not found');
  const reason = (req.body?.reason as string) || 'Ended by admin';
  // io reference is set by setupVideoCallSignaling
  if ((videoCallRouter as any).__io) {
    forceEndRoom(roomId, (videoCallRouter as any).__io, reason);
  }
  res.json({ data: { id: roomId, status: 'ended', reason } });
});

/**
 * GET /video-call/admin/sfu-rooms — list all active Mediasoup rooms
 * Shows rooms from the SFU (mediasoup) system, separate from P2P signaling rooms.
 */
videoCallRouter.get('/admin/sfu-rooms', (_req: Request, res: Response) => {
  const rooms = roomManager.listRooms();
  res.json({ data: rooms, count: rooms.length });
});

/**
 * POST /video-call/admin/sfu-rooms/:roomId/close — force-close a Mediasoup room
 */
videoCallRouter.post('/admin/sfu-rooms/:roomId/close', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = roomManager.getRoom(roomId);
  if (!room) throw new AppError(404, 'Mediasoup room not found');
  roomManager.closeRoom(roomId);
  res.json({ data: { id: roomId, status: 'closed' } });
});

// ── Socket.IO Signaling Setup ──

export function setupVideoCallSignaling(
  io: Server<ClientToServerEvents, ServerToClientEvents, any, SocketData>,
): void {
  // Store io reference on the router for admin endpoints
  (videoCallRouter as any).__io = io;

  // ── Auth Middleware ──
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      if (error || !user) return next(new Error('Invalid token'));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, any, SocketData>) => {
    const userId = socket.data.userId!;
    registerUserSocket(userId, socket.id);

    // ── Room Signaling ──

    socket.on('room:join', ({ roomId, peer }, callback) => {
      try {
        let room = getRoom(roomId);
        if (!room) {
          room = createRoom(roomId);
        }

        if (room.peers.size >= 4) {
          callback({ success: false, error: 'Room is full (max 4 participants)' });
          return;
        }

        socket.data.peer = peer;
        socket.join(roomId);
        room.peers.set(peer.id, peer);

        const peers = Array.from(room.peers.values());
        callback({ success: true });
        socket.emit('room:joined', { roomId, peers });
        socket.to(roomId).emit('room:peer-joined', { peer });
      } catch {
        callback({ success: false, error: 'Internal server error' });
      }
    });

    socket.on('room:leave', ({ roomId }) => {
      const peerInfo = socket.data.peer;
      if (!peerInfo) return;

      const room = getRoom(roomId);
      if (!room) return;

      room.peers.delete(peerInfo.id);
      socket.leave(roomId);
      socket.to(roomId).emit('room:peer-left', { peerId: peerInfo.id });

      if (room.peers.size === 0) {
        rooms.delete(roomId);
      }
    });

    socket.on('signal:offer', ({ roomId: _roomId, to, offer }) => {
      socket.to(to).emit('signal:offer', { from: socket.id, offer });
    });

    socket.on('signal:answer', ({ roomId: _roomId, to, answer }) => {
      socket.to(to).emit('signal:answer', { from: socket.id, answer });
    });

    socket.on('signal:ice-candidate', ({ roomId: _roomId, to, candidate }) => {
      socket.to(to).emit('signal:ice-candidate', { from: socket.id, candidate });
    });

    // ── Call Signaling ──

    socket.on('call:outgoing', async ({ to, roomId, callerInfo }) => {
      const callerUserId = socket.data.userId;
      if (!callerUserId || !to || !roomId) return;

      // Don't allow calling yourself
      if (callerUserId === to) return;

      // Check if room already exists (call already in progress for this room)
      if (pendingCalls.has(roomId)) {
        return;
      }

      const calleeSocketIds = getUserSocketIds(to);

      if (calleeSocketIds.length > 0) {
        // Callee is online — establish pending call
        pendingCalls.set(roomId, {
          callerUserId,
          calleeUserId: to,
          callerSocketIds: new Set([socket.id]),
          calleeSocketIds: new Set(calleeSocketIds),
          callerInfo,
          roomId,
        });

        // Notify all callee devices
        for (const sid of calleeSocketIds) {
          io.to(sid).emit('call:incoming', {
            from: { id: callerUserId, displayName: callerInfo.displayName, avatar_url: callerInfo.avatar_url },
            roomId,
          });
        }
      } else {
        // Callee is offline — create in-app notification
        try {
          await adminClient.from('notifications').insert({
            profile_id: to,
            title: 'Missed Call',
            message: `${callerInfo.displayName} called you`,
            type: 'video_call',
            reference_type: 'video_call',
            reference_id: roomId,
          });
        } catch {
          // Notification creation is best-effort
        }

        // Enqueue push notification for offline callee
        try {
          await notificationQueue.add('push:call', {
            type: 'push:call',
            calleeUserId: to,
            callerName: callerInfo.displayName,
            roomId,
            roomType: 'P2P',
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          });
        } catch {
          // Push notification delivery is best-effort
        }

        socket.emit('call:unavailable', { roomId } as any);
      }
    });

    socket.on('call:accept', ({ roomId }) => {
      const pending = pendingCalls.get(roomId);
      if (!pending) return;

      // Only the intended callee can accept
      if (socket.data.userId !== pending.calleeUserId) return;

      pendingCalls.delete(roomId);

      // Notify all caller sockets
      for (const sid of pending.callerSocketIds) {
        io.to(sid).emit('call:accepted', { roomId });
      }
    });

    socket.on('call:reject', ({ roomId }) => {
      const pending = pendingCalls.get(roomId);
      if (!pending) return;

      if (socket.data.userId !== pending.calleeUserId) return;

      pendingCalls.delete(roomId);

      for (const sid of pending.callerSocketIds) {
        io.to(sid).emit('call:rejected', { roomId });
      }
    });

    socket.on('call:cancel', ({ roomId }) => {
      const pending = pendingCalls.get(roomId);
      if (!pending) return;

      if (socket.data.userId !== pending.callerUserId) return;

      pendingCalls.delete(roomId);

      for (const sid of pending.calleeSocketIds) {
        io.to(sid).emit('call:cancelled', { roomId });
      }
    });

    socket.on('call:end', ({ roomId }) => {
      socket.to(roomId).emit('call:ended', { roomId, by: socket.data.userId || 'unknown' });
    });

    socket.on('disconnect', () => {
      removePeerFromAllRooms(socket);
      cleanupPendingCallsForUser(userId, socket.id, io);
      unregisterUserSocket(userId, socket.id);
    });
  });
}
