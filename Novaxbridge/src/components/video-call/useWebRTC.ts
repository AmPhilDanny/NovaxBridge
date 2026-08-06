import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "@/integrations/supabase/client";

// Derive Socket.IO server URL from the API URL (strip /api suffix so Socket.IO connects to root)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const SIGNALING_SERVER = API_URL.replace(/\/api\/?$/, "");
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

type ConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";

interface PeerInfo {
  id: string;
  displayName: string;
}

interface PeerConnection {
  peerId: string;
  displayName: string;
  connectionState: ConnectionState;
  stream?: MediaStream;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remotePeers: PeerConnection[];
  connectionState: ConnectionState;
  toggleMic: () => void;
  toggleCamera: () => void;
  endCall: () => void;
  screenShare: () => void;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

export function useWebRTC(roomId: string, displayName: string): UseWebRTCReturn {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<PeerConnection[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("new");
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Get local media
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        // Permission denied or no camera — proceed without local video
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Connect to signaling server
  useEffect(() => {
    if (!roomId || !displayName) return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const token = session?.access_token || "";

      const socket = io(SIGNALING_SERVER, {
        transports: ["websocket", "polling"],
        auth: { token },
      });
      socketRef.current = socket;

      const peer: PeerInfo = { id: socket.id || crypto.randomUUID(), displayName };

      socket.on("connect", () => {
        peer.id = socket.id || peer.id;
        socket.emit("room:join", { roomId, peer }, (ack: any) => {
          if (!ack.success) {
            console.error("Failed to join room:", ack.error);
          }
        });
      });

      socket.on("room:joined", (data: any) => {
        const remoteList: PeerConnection[] = data.peers
          .filter((p: PeerInfo) => p.id !== peer.id)
          .map((p: PeerInfo) => ({
            peerId: p.id,
            displayName: p.displayName,
            connectionState: "connecting" as ConnectionState,
          }));
        setRemotePeers(remoteList);
        setConnectionState("connected");
      });

      socket.on("room:peer-joined", (data: any) => {
        const newPeer = data.peer as PeerInfo;
        setRemotePeers((prev) => {
          if (prev.some((p) => p.peerId === newPeer.id)) return prev;
          return [
            ...prev,
            { peerId: newPeer.id, displayName: newPeer.displayName, connectionState: "connecting" as ConnectionState },
          ];
        });
        createPeerConnection(newPeer.id, true, socket, peer.id, roomId);
      });

      socket.on("room:peer-left", (data: any) => {
        const peerId = data.peerId as string;
        closePeerConnection(peerId);
        setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerId));
      });

      socket.on("signal:offer", (data: any) => {
        createPeerConnection(data.from, false, socket, peer.id, roomId).then((pc) => {
          pc.setRemoteDescription(new RTCSessionDescription(data.offer as RTCSessionDescriptionInit))
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer))
            .then(() => {
              socket.emit("signal:answer", { roomId, to: data.from, answer: pc.localDescription });
              const cands = pendingCandidates.current.get(data.from) || [];
              cands.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
              pendingCandidates.current.delete(data.from);
            })
            .catch((err) => console.error("Error handling offer:", err));
        });
      });

      socket.on("signal:answer", (data: any) => {
        const pc = pcRefs.current.get(data.from);
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
            .catch((err) => console.error("Error setting remote answer:", err));
        }
      });

      socket.on("signal:ice-candidate", (data: any) => {
        const pc = pcRefs.current.get(data.from);
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit))
            .catch((err) => console.error("Error adding ICE candidate:", err));
        } else {
          const cands = pendingCandidates.current.get(data.from) || [];
          cands.push(data.candidate as RTCIceCandidateInit);
          pendingCandidates.current.set(data.from, cands);
        }
      });

      socket.on("room:force-ended", (data: any) => {
        endCall();
      });

      socket.on("disconnect", () => {
        setConnectionState("disconnected");
      });
    });

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("room:leave", { roomId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, displayName]);

  async function createPeerConnection(
    peerId: string,
    initiator: boolean,
    socket: Socket,
    localPeerId: string,
    roomId: string,
  ): Promise<RTCPeerConnection> {
    const existing = pcRefs.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRefs.current.set(peerId, pc);

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal:ice-candidate", { roomId, to: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as ConnectionState;
      setRemotePeers((prev) =>
        prev.map((p) => (p.peerId === peerId ? { ...p, connectionState: state } : p)),
      );
      if (state === "failed" || state === "disconnected") {
        closePeerConnection(peerId);
      }
    };

    pc.ontrack = (event) => {
      setRemotePeers((prev) =>
        prev.map((p) => (p.peerId === peerId ? { ...p, stream: event.streams[0] } : p)),
      );
    };

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal:offer", { roomId, to: peerId, offer });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    }

    return pc;
  }

  function closePeerConnection(peerId: string) {
    const pc = pcRefs.current.get(peerId);
    if (pc) {
      pc.close();
      pcRefs.current.delete(peerId);
    }
    pendingCandidates.current.delete(peerId);
  }

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  const screenShare = useCallback(async () => {
    if (isScreenSharing) {
      const screenStream = screenStreamRef.current;
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const localStream = localStreamRef.current;
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          pcRefs.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(videoTrack);
          });
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        pcRefs.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          screenShare();
        };
        setIsScreenSharing(true);
      } catch {
        // User cancelled screen share
      }
    }
  }, [isScreenSharing]);

  const endCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    pcRefs.current.forEach((pc) => pc.close());
    pcRefs.current.clear();
    if (socketRef.current) {
      socketRef.current.emit("room:leave", { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setLocalStream(null);
    setRemotePeers([]);
    setConnectionState("closed");
  }, [roomId]);

  return {
    localStream,
    remotePeers,
    connectionState,
    toggleMic,
    toggleCamera,
    endCall,
    screenShare,
    isMicOn,
    isCameraOn,
    isScreenSharing,
  };
}
