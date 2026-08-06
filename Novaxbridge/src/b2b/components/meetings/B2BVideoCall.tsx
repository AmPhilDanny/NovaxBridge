import { useRef, useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJitsiRoom } from '@/components/video-call/useJitsiRoom';
import { post } from '@/lib/api-client';

interface B2BVideoCallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  userName: string;
  meetingTitle?: string;
}

export default function B2BVideoCall({ open, onOpenChange, roomName, userName, meetingTitle }: B2BVideoCallProps) {
  const [active, setActive] = useState(false);
  const prevOpenRef = useRef(false);
  const [jitsiConfig, setJitsiConfig] = useState<{ jwt: string | null; domain: string; appId: string; roomPrefix: string } | null>(null);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setActive(true);
      post('/video-call/token').then((r) => setJitsiConfig(r as any)).catch(() => {});
    }
    if (!open) {
      setActive(false);
      setJitsiConfig(null);
    }
    prevOpenRef.current = open;
  }, [open]);

  const {
    containerRef,
    connectionState,
    toggleMic,
    toggleCamera,
    endCall,
    isMicOn,
    isCameraOn,
  } = useJitsiRoom(active ? roomName : '', active ? userName : '', jitsiConfig ? {
    jwt: jitsiConfig.jwt,
    domain: jitsiConfig.domain,
    roomPrefix: jitsiConfig.roomPrefix,
    scriptSrc: `https://${jitsiConfig.domain}/${jitsiConfig.appId}/external_api.js`,
  } : undefined);

  const handleHangup = useCallback(() => {
    endCall();
    onOpenChange(false);
  }, [endCall, onOpenChange]);

  const isConnecting = connectionState === 'new' || connectionState === 'connecting';
  const hasError = connectionState === 'failed';

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) handleHangup();
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[800px] h-[90vh] max-h-[700px] p-0 gap-0 overflow-hidden">
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Connection status banner */}
          {isConnecting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/60 mx-auto mb-3" />
                <p className="text-white/60 text-sm">Connecting to call...</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
              <div className="text-center max-w-sm px-4">
                <p className="text-red-400 text-sm mb-2">Connection failed</p>
                <p className="text-white/50 text-xs mb-4">Could not connect to the video room. Please try again.</p>
                <Button size="sm" variant="outline" onClick={handleHangup} className="text-white border-white/20">
                  Close
                </Button>
              </div>
            </div>
          )}

          <div ref={containerRef} className="flex-1 relative" />

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 p-4 bg-black/80">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMic}
              className={`rounded-full w-12 h-12 ${
                !isMicOn
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCamera}
              className={`rounded-full w-12 h-12 ${
                !isCameraOn
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHangup}
              className="rounded-full w-12 h-12 bg-red-500 text-white hover:bg-red-600"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
