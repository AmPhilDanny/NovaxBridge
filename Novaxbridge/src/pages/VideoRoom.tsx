import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useJitsiRoom } from "@/components/video-call/useJitsiRoom";
import { MeetingControls } from "@/components/video-call/MeetingControls";
import { ConnectionStatus } from "@/components/video-call/ConnectionStatus";
import { Loader2 } from "lucide-react";
import { post } from "@/lib/api-client";

type AuthState = "loading" | "authenticated" | "anonymous";

interface JitsiConfig {
  jwt: string | null;
  domain: string;
  appId: string;
  roomPrefix: string;
  displayName: string;
}

export default function VideoRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState((location.state as any)?.displayName || "");
  const [authState, setAuthState] = useState<AuthState>(
    (location.state as any)?.displayName ? "authenticated" : "loading"
  );
  const hasRedirected = useRef(false);
  const [jitsiConfig, setJitsiConfig] = useState<JitsiConfig | null>(null);

  useEffect(() => {
    if (displayName) {
      if (!jitsiConfig) {
        post('/video-call/token').then((r) => setJitsiConfig(r as any)).catch(() => {});
      }
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const name = session?.user?.user_metadata?.full_name || session?.user?.email || "";
      if (name) {
        setDisplayName(name);
        setAuthState("authenticated");
        post('/video-call/token').then((r) => setJitsiConfig(r as any)).catch(() => {});
      } else {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          navigate('/auth');
        }
      }
    });
  }, [displayName, jitsiConfig, navigate]);

  const {
    containerRef,
    connectionState,
    participants,
    toggleMic,
    toggleCamera,
    endCall,
    screenShare,
    isMicOn,
    isCameraOn,
    isScreenSharing,
  } = useJitsiRoom(roomId || "", displayName, jitsiConfig ? {
    jwt: jitsiConfig.jwt,
    domain: jitsiConfig.domain,
    roomPrefix: jitsiConfig.roomPrefix,
    scriptSrc: `https://${jitsiConfig.domain}/${jitsiConfig.appId}/external_api.js`,
  } : undefined);

  const handleEndCall = () => {
    endCall();
    navigate("/");
  };

  // Loading state while checking auth
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-secondary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  if (authState === "anonymous") return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-border bg-card/50 z-10 min-w-0">
        <span className="text-xs sm:text-sm text-muted-foreground truncate min-w-0">
          <span className="hidden sm:inline">Room: </span>
          <span className="text-foreground font-mono">{roomId}</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <ConnectionStatus
            displayName={`${displayName}${displayName.length > 12 ? '' : ' (You)'}`}
            connectionState={connectionState}
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-0" />

      <div className="flex justify-center pb-4 sm:pb-6 pt-1 sm:pt-2 z-10">
        <MeetingControls
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onScreenShare={screenShare}
          onEndCall={handleEndCall}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          isScreenSharing={isScreenSharing}
          roomId={roomId || ""}
        />
      </div>
    </div>
  );
}
