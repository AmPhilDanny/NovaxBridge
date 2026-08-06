import { Socket } from 'socket.io';
import { roomManager, RoomType } from '../media/roomManager.js';
import { adminClient } from '../lib/supabase-admin.js';

interface AuthPayload {
  userId: string;
  roomId: string;
  roomType: RoomType;
  displayName: string;
  /** Required for OPEN rooms */
  token?: string;
  /** Required for GROUP rooms */
  memberIds?: string[];
}

/**
 * Socket.IO middleware that authorizes room access based on room type.
 *
 * P2P  – only callerId and calleeId can join
 * GROUP – user must be in the org's member list
 * OPEN  – valid roomToken required
 */
export async function roomAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const payload: AuthPayload | undefined = (socket as any).handshake?.auth?.room;

  if (!payload || !payload.userId || !payload.roomId || !payload.roomType) {
    return next(new Error('Missing room auth payload'));
  }

  const { userId, roomId, roomType, memberIds, token } = payload;

  let authorized = false;

  switch (roomType) {
    case 'P2P': {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return next(new Error('Room not found'));
      }
      authorized = roomManager.canJoinP2P(roomId, userId);
      break;
    }

    case 'GROUP': {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return next(new Error('Room not found'));
      }
      // If memberIds provided, use them; otherwise validate against DB
      if (memberIds && memberIds.length > 0) {
        authorized = roomManager.canJoinGroup(roomId, userId, memberIds);
      } else {
        // Look up org membership from DB
        authorized = await validateGroupMembership(userId, room);
      }
      break;
    }

    case 'OPEN': {
      if (!token) {
        return next(new Error('OPEN rooms require a token'));
      }
      authorized = roomManager.canJoinOpen(roomId, token);
      break;
    }

    default:
      return next(new Error(`Unknown room type: ${roomType}`));
  }

  if (!authorized) {
    return next(new Error('Not authorized to join this room'));
  }

  // Persist auth data on socket for route handlers
  (socket as any).roomAuth = payload;
  next();
}

/**
 * Validate that a user is an active member of the org that owns this room.
 */
async function validateGroupMembership(userId: string, room: any): Promise<boolean> {
  try {
    const orgId = room.metadata?.orgId;
    if (!orgId) return false;

    const { data } = await adminClient
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}
