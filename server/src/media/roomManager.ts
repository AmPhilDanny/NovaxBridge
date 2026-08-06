import type { Router, Transport, Producer, Consumer } from 'mediasoup/types';
import { createRouter } from './mediasoupManager.js';

export type RoomType = 'P2P' | 'GROUP' | 'OPEN';

export interface RoomParticipant {
  socketId: string;
  userId: string;
  displayName: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export interface Room {
  id: string;
  type: RoomType;
  router: Router;
  participants: Map<string, RoomParticipant>;
  createdAt: number;
  metadata: {
    callerId?: string;
    calleeId?: string;
    orgId?: string;
    meetingId?: string;
    token?: string;
  };
}

class RoomManager {
  private rooms = new Map<string, Room>();

  async createRoom(
    roomId: string,
    type: RoomType,
    metadata: Room['metadata'] = {},
  ): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const router = await createRouter();
    const room: Room = {
      id: roomId,
      type,
      router,
      participants: new Map(),
      createdAt: Date.now(),
      metadata,
    };

    this.rooms.set(roomId, room);

    // Auto-cleanup empty rooms after 5 minutes
    setTimeout(() => {
      const r = this.rooms.get(roomId);
      if (r && r.participants.size === 0) {
        this.closeRoom(roomId);
      }
    }, 5 * 60 * 1000);

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getParticipant(roomId: string, userId: string): RoomParticipant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return room.participants.get(userId);
  }

  addParticipant(
    roomId: string,
    userId: string,
    socketId: string,
    displayName: string,
  ): RoomParticipant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const participant: RoomParticipant = {
      socketId,
      userId,
      displayName,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    room.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (participant) {
      // Close all producers
      participant.producers.forEach((producer) => producer.close());
      // Close all consumers
      participant.consumers.forEach((consumer) => consumer.close());
      // Close all transports
      participant.transports.forEach((transport) => transport.close());
    }

    room.participants.delete(userId);

    // Auto-close P2P rooms when one participant leaves
    if (room.type === 'P2P' && room.participants.size < 2) {
      this.closeRoom(roomId);
    }
  }

  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.forEach((participant) => {
      participant.producers.forEach((p) => p.close());
      participant.consumers.forEach((c) => c.close());
      participant.transports.forEach((t) => t.close());
    });

    room.router.close();
    this.rooms.delete(roomId);
  }

  /** Get all participant user IDs in a room (excluding a specific userId) */
  getOtherParticipants(roomId: string, userId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.participants.keys()).filter((id) => id !== userId);
  }

  /** Check if a user can join a P2P room */
  canJoinP2P(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.type !== 'P2P') return false;
    return userId === room.metadata.callerId || userId === room.metadata.calleeId;
  }

  /** Check if a user can join a GROUP room */
  canJoinGroup(roomId: string, userId: string, memberIds: string[]): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.type !== 'GROUP') return false;
    return memberIds.includes(userId);
  }

  /** Check if a user can join an OPEN room */
  canJoinOpen(roomId: string, token: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.type !== 'OPEN') return false;
    return token === room.metadata.token;
  }

  /** List all active rooms with participant info (for admin monitoring) */
  listRooms(): Array<{
    id: string;
    type: RoomType;
    participantCount: number;
    participants: Array<{ userId: string; displayName: string }>;
    createdAt: number;
    ageMs: number;
    metadata: Room['metadata'];
  }> {
    const now = Date.now();
    const list: Array<{
      id: string;
      type: RoomType;
      participantCount: number;
      participants: Array<{ userId: string; displayName: string }>;
      createdAt: number;
      ageMs: number;
      metadata: Room['metadata'];
    }> = [];

    this.rooms.forEach((room) => {
      list.push({
        id: room.id,
        type: room.type,
        participantCount: room.participants.size,
        participants: Array.from(room.participants.entries()).map(([userId, p]) => ({
          userId,
          displayName: p.displayName,
        })),
        createdAt: room.createdAt,
        ageMs: now - room.createdAt,
        metadata: room.metadata,
      });
    });

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Cleanup stale rooms (call periodically) */
  cleanupStaleRooms(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let count = 0;
    this.rooms.forEach((room, id) => {
      if (room.participants.size === 0 && now - room.createdAt > maxAgeMs) {
        this.closeRoom(id);
        count++;
      }
    });
    return count;
  }
}

export const roomManager = new RoomManager();
