import { Server, Socket } from 'socket.io';
import type { RtpCapabilities, DtlsParameters } from 'mediasoup/types';
import pino from 'pino';
import { roomManager, RoomType } from '../media/roomManager.js';

const logger = pino({ name: 'call-handler' });

interface JoinRoomPayload {
  roomId: string;
  roomType: RoomType;
  userId: string;
  displayName: string;
  rtpCapabilities: RtpCapabilities;
  /** P2P specific: caller/callee ids */
  callerId?: string;
  calleeId?: string;
  /** OPEN room token */
  token?: string;
  /** GROUP member ids */
  memberIds?: string[];
}

interface CreateTransportPayload {
  roomId: string;
  userId: string;
  direction: 'send' | 'recv';
}

interface ConnectTransportPayload {
  roomId: string;
  userId: string;
  transportId: string;
  dtlsParameters: DtlsParameters;
}

interface ProducePayload {
  roomId: string;
  userId: string;
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  paused?: boolean;
  appData?: any;
}

interface ConsumePayload {
  roomId: string;
  userId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

export function setupCallHandlers(io: Server): void {
  const callNsp = io.of('/call');

  callNsp.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;

    socket.on('disconnect', () => {
      if (currentRoomId && currentUserId) {
        handleLeaveRoom(currentRoomId, currentUserId);
      }
    });

    // ── Join Room ──
    socket.on(
      'join-room',
      async (
        payload: JoinRoomPayload,
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, roomType, userId, displayName, rtpCapabilities, callerId, calleeId, token, memberIds } = payload;

          // Create or get the room
          const metadata: any = {};
          if (roomType === 'P2P') {
            metadata.callerId = callerId;
            metadata.calleeId = calleeId;
          }
          if (roomType === 'OPEN') {
            metadata.token = token;
          }

          const room = await roomManager.createRoom(roomId, roomType, metadata);

          // Verify authorization
          let authorized = false;
          switch (roomType) {
            case 'P2P':
              authorized = roomManager.canJoinP2P(roomId, userId);
              break;
            case 'GROUP':
              authorized = roomManager.canJoinGroup(roomId, userId, memberIds || []);
              break;
            case 'OPEN':
              authorized = roomManager.canJoinOpen(roomId, token || '');
              break;
          }

          if (!authorized) {
            return callback({ error: 'Not authorized to join this room' });
          }

          // Add participant to room
          roomManager.addParticipant(roomId, userId, socket.id, displayName);
          currentRoomId = roomId;
          currentUserId = userId;

          // Join the socket room for broadcasting
          socket.join(roomId);

          // Notify existing participants about the new user
          socket.to(roomId).emit('user-joined', {
            userId,
            displayName,
            participants: getParticipantList(roomId),
          });

          // Emit existing producers to the new participant (so they know what to consume)
          const existingProducers: Array<{ producerId: string; kind: string; userId: string }> = [];
          room.participants.forEach((p, puid) => {
            if (puid !== userId) {
              p.producers.forEach((producer) => {
                existingProducers.push({
                  producerId: producer.id,
                  kind: producer.kind,
                  userId: puid,
                });
              });
            }
          });
          for (const ep of existingProducers) {
            socket.emit('new-producer', ep);
          }

          // Send router RTP capabilities to the new participant
          callback({
            routerRtpCapabilities: room.router.rtpCapabilities,
            participants: getParticipantList(roomId),
          });

          logger.info({ roomId, userId, roomType }, 'User joined room');
        } catch (err: any) {
          logger.error({ err }, 'join-room error');
          callback({ error: err.message || 'Failed to join room' });
        }
      },
    );

    // ── Create WebRTC Transport ──
    socket.on(
      'create-transport',
      async (
        payload: CreateTransportPayload,
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, direction } = payload;
          const room = roomManager.getRoom(roomId);
          if (!room) return callback({ error: 'Room not found' });

          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || undefined;
          if (direction === 'send') {
            const transport = await room.router.createWebRtcTransport({
              listenIps: [{ ip: '0.0.0.0', announcedIp }],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
              initialAvailableOutgoingBitrate: 1000000,
            });

            participant.transports.set(transport.id, transport);

            transport.on('dtlsstatechange', (dtlsState: string) => {
              if (dtlsState === 'closed') {
                transport.close();
                participant.transports.delete(transport.id);
              }
            });

            transport.on('routerclose', () => {
              transport.close();
              participant.transports.delete(transport.id);
            });

            callback({
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
              sctpParameters: transport.sctpParameters,
            });
          } else {
            const transport = await room.router.createWebRtcTransport({
              listenIps: [{ ip: '0.0.0.0', announcedIp }],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
              initialAvailableOutgoingBitrate: 1000000,
            });

            participant.transports.set(transport.id, transport);

            transport.on('dtlsstatechange', (dtlsState: string) => {
              if (dtlsState === 'closed') {
                transport.close();
                participant.transports.delete(transport.id);
              }
            });

            transport.on('routerclose', () => {
              transport.close();
              participant.transports.delete(transport.id);
            });

            callback({
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
              sctpParameters: transport.sctpParameters,
            });
          }
        } catch (err: any) {
          logger.error({ err }, 'create-transport error');
          callback({ error: err.message || 'Failed to create transport' });
        }
      },
    );

    // ── Connect Transport ──
    socket.on(
      'connect-transport',
      async (
        payload: ConnectTransportPayload,
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, transportId, dtlsParameters } = payload;
          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          const transport = participant.transports.get(transportId);
          if (!transport) return callback({ error: 'Transport not found' });

          await transport.connect({ dtlsParameters });
          callback({ connected: true });
        } catch (err: any) {
          logger.error({ err }, 'connect-transport error');
          callback({ error: err.message || 'Failed to connect transport' });
        }
      },
    );

    // ── Produce Media ──
    socket.on(
      'produce',
      async (
        payload: ProducePayload,
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, transportId, kind, rtpParameters, paused, appData } = payload;
          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          const transport = participant.transports.get(transportId);
          if (!transport) return callback({ error: 'Transport not found' });

          const producer = await transport.produce({
            kind,
            rtpParameters,
            paused: paused ?? false,
            appData: appData ?? {},
          });

          participant.producers.set(producer.id, producer);

          // Notify other participants about the new producer
          socket.to(roomId).emit('new-producer', {
            producerId: producer.id,
            kind: producer.kind,
            userId,
          });

          producer.on('transportclose', () => {
            producer.close();
            participant.producers.delete(producer.id);
          });

          callback({
            id: producer.id,
            kind: producer.kind,
          });
        } catch (err: any) {
          logger.error({ err }, 'produce error');
          callback({ error: err.message || 'Failed to produce' });
        }
      },
    );

    // ── Consume Media ──
    socket.on(
      'consume',
      async (
        payload: ConsumePayload,
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, producerId, rtpCapabilities } = payload;
          const room = roomManager.getRoom(roomId);
          if (!room) return callback({ error: 'Room not found' });

          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          // Check if the client can consume this producer
          if (!room.router.canConsume({ producerId, rtpCapabilities })) {
            return callback({ error: 'Cannot consume this producer' });
          }

          const recvTransport = participant.transports.get(payload.transportId);
          if (!recvTransport) {
            return callback({ error: 'Recv transport not found' });
          }

          const consumer = await recvTransport.consume({
            producerId,
            rtpCapabilities,
            paused: true, // Start paused, client resumes
          });

          participant.consumers.set(consumer.id, consumer);

          consumer.on('transportclose', () => {
            consumer.close();
            participant.consumers.delete(consumer.id);
          });

          consumer.on('producerclose', () => {
            consumer.close();
            participant.consumers.delete(consumer.id);
            socket.emit('producer-closed', { producerId });
          });

          callback({
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
          });
        } catch (err: any) {
          logger.error({ err }, 'consume error');
          callback({ error: err.message || 'Failed to consume' });
        }
      },
    );

    // ── Resume Consumer ──
    socket.on(
      'resume-consumer',
      async (
        payload: { roomId: string; userId: string; consumerId: string },
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, consumerId } = payload;
          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          const consumer = participant.consumers.get(consumerId);
          if (!consumer) return callback({ error: 'Consumer not found' });

          await consumer.resume();
          callback({ resumed: true });
        } catch (err: any) {
          logger.error({ err }, 'resume-consumer error');
          callback({ error: err.message || 'Failed to resume consumer' });
        }
      },
    );

    // ── Close Producer ──
    socket.on(
      'close-producer',
      async (
        payload: { roomId: string; userId: string; producerId: string },
        callback: (response: any) => void,
      ) => {
        try {
          const { roomId, userId, producerId } = payload;
          const participant = roomManager.getParticipant(roomId, userId);
          if (!participant) return callback({ error: 'Not in room' });

          const producer = participant.producers.get(producerId);
          if (!producer) return callback({ error: 'Producer not found' });

          producer.close();
          participant.producers.delete(producerId);

          socket.to(roomId).emit('producer-closed', { producerId });
          callback({ closed: true });
        } catch (err: any) {
          logger.error({ err }, 'close-producer error');
          callback({ error: err.message || 'Failed to close producer' });
        }
      },
    );

    // ── Leave Room ──
    socket.on(
      'leave-room',
      (
        payload: { roomId: string; userId: string },
        callback?: (response: any) => void,
      ) => {
        const { roomId, userId } = payload;
        handleLeaveRoom(roomId, userId);
        socket.leave(roomId);
        currentRoomId = null;
        currentUserId = null;
        callback?.({ left: true });
      },
    );

    // ── Helper: handle user leaving ──
    function handleLeaveRoom(roomId: string, userId: string): void {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      roomManager.removeParticipant(roomId, userId);

      // Notify remaining participants
      socket.to(roomId).emit('user-left', {
        userId,
        participants: getParticipantList(roomId),
      });

      logger.info({ roomId, userId }, 'User left room');
    }
  });
}

function getParticipantList(roomId: string): Array<{ userId: string; displayName: string }> {
  const room = roomManager.getRoom(roomId);
  if (!room) return [];
  return Array.from(room.participants.entries()).map(([userId, p]) => ({
    userId,
    displayName: p.displayName,
  }));
}
