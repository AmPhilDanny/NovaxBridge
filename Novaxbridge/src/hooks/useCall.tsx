import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "./useSocket";
import { supabase } from "@/integrations/supabase/client";

type CallState = "idle" | "calling" | "ringing" | "connected";
type CallDirection = "outgoing" | "incoming" | null;

interface CallPeer {
  id: string;
  displayName: string;
  avatar_url?: string;
}

interface CallContextType {
  callState: CallState;
  callDirection: CallDirection;
  callPeer: CallPeer | null;
  callRoomId: string | null;
  startCall: (toUserId: string, calleeName: string, calleeAvatarUrl?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  cancelCall: () => void;
}

const CallContext = createContext<CallContextType>({
  callState: "idle",
  callDirection: null,
  callPeer: null,
  callRoomId: null,
  startCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  cancelCall: () => {},
});

const RING_TIMEOUT_MS = 30_000; // 30 seconds

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callDirection, setCallDirection] = useState<CallDirection>(null);
  const [callPeer, setCallPeer] = useState<CallPeer | null>(null);
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRingTimer() {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: { from: CallPeer; roomId: string }) => {
      // Don't interrupt an active call
      if (callState !== "idle") return;
      setCallPeer(data.from);
      setCallRoomId(data.roomId);
      setCallDirection("incoming");
      setCallState("ringing");
    };

    const onAccepted = async (data: { roomId: string }) => {
      clearRingTimer();
      setCallState("connected");
      const { data: { session } } = await supabase.auth.getSession();
      const displayName = session?.user?.user_metadata?.full_name || session?.user?.email || "User";
      navigate(`/video-call/${data.roomId}`, { state: { displayName } });
    };

    const onRejected = () => {
      clearRingTimer();
      resetCall();
    };

    const onCancelled = () => {
      clearRingTimer();
      resetCall();
    };

    const onUnavailable = () => {
      clearRingTimer();
      resetCall();
    };

    const onEnded = () => {
      clearRingTimer();
      resetCall();
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:cancelled", onCancelled);
    socket.on("call:unavailable", onUnavailable);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:cancelled", onCancelled);
      socket.off("call:unavailable", onUnavailable);
      socket.off("call:ended", onEnded);
      clearRingTimer();
    };
  }, [socket, callState, navigate]);

  function resetCall() {
    setCallState("idle");
    setCallDirection(null);
    setCallPeer(null);
    setCallRoomId(null);
  }

  const startCall = useCallback(async (toUserId: string, calleeName: string, calleeAvatarUrl?: string) => {
    if (!socket || !toUserId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const callerName = session?.user?.user_metadata?.full_name || session?.user?.email || "User";
    const callerAvatar = session?.user?.user_metadata?.avatar_url || undefined;

    const roomId = crypto.randomUUID();
    socket.emit("call:outgoing", {
      to: toUserId,
      roomId,
      callerInfo: { displayName: callerName, avatar_url: callerAvatar },
    });
    setCallPeer({ id: toUserId, displayName: calleeName, avatar_url: calleeAvatarUrl });
    setCallRoomId(roomId);
    setCallDirection("outgoing");
    setCallState("calling");

    // Auto-cancel after RING_TIMEOUT_MS if no answer
    clearRingTimer();
    ringTimerRef.current = setTimeout(() => {
      socket.emit("call:cancel", { roomId });
      resetCall();
      // Import toast lazily to avoid circular deps
      import("sonner").then(({ toast }) => {
        toast.info(`${calleeName} didn't answer`);
      });
    }, RING_TIMEOUT_MS);
  }, [socket]);

  const acceptCall = useCallback(async () => {
    if (!socket || !callRoomId) return;
    clearRingTimer();
    socket.emit("call:accept", { roomId: callRoomId });
    setCallState("connected");
    const { data: { session } } = await supabase.auth.getSession();
    const displayName = session?.user?.user_metadata?.full_name || session?.user?.email || "User";
    navigate(`/video-call/${callRoomId}`, { state: { displayName } });
  }, [socket, callRoomId, navigate]);

  const rejectCall = useCallback(() => {
    if (!socket || !callRoomId) return;
    clearRingTimer();
    socket.emit("call:reject", { roomId: callRoomId });
    resetCall();
  }, [socket, callRoomId]);

  const endCall = useCallback(() => {
    if (!socket || !callRoomId) return;
    clearRingTimer();
    socket.emit("call:end", { roomId: callRoomId });
    resetCall();
  }, [socket, callRoomId]);

  const cancelCall = useCallback(() => {
    if (!socket || !callRoomId) return;
    clearRingTimer();
    socket.emit("call:cancel", { roomId: callRoomId });
    resetCall();
  }, [socket, callRoomId]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callDirection,
        callPeer,
        callRoomId,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        cancelCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
