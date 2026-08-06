import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "@/integrations/supabase/client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const SIGNALING_SERVER = API_URL.replace(/\/api\/?$/, "");

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const s = io(SIGNALING_SERVER, {
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      s.on("connect", () => {
        if (cancelled) { s.disconnect(); return; }
        setIsConnected(true);
        setSocket(s);
        socketRef.current = s;
      });

      s.on("disconnect", () => {
        if (!cancelled) setIsConnected(false);
      });

      s.on("connect_error", () => {
        if (!cancelled) setIsConnected(false);
      });
    }

    connect();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      const old = socketRef.current;
      if (old) {
        old.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      connect();
    });

    return () => {
      cancelled = true;
      const old = socketRef.current;
      if (old) old.disconnect();
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
