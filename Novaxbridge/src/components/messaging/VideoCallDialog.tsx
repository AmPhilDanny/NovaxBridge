import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWebRTC } from '@/components/video-call/useWebRTC';
import { VideoPlayer } from '@/components/video-call/VideoPlayer';
import { MeetingControls } from '@/components/video-call/MeetingControls';
import { ConnectionStatus } from '@/components/video-call/ConnectionStatus';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  displayName: string;
}

export default function VideoCallDialog({ open, onOpenChange, roomId, displayName }: VideoCallDialogProps) {
  const {
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
  } = useWebRTC(roomId, displayName);

  const handleEndCall = () => {
    endCall();
    onOpenChange(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      endCall();
    }
    onOpenChange(o);
  };

  useEffect(() => {
    if (!open) {
      endCall();
    }
  }, [open]);

  const allPeers = [
    ...remotePeers,
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[800px] h-[90vh] max-h-[700px] p-0 gap-0 overflow-hidden flex flex-col bg-black">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/80 shrink-0">
          <span className="text-xs text-white/60 font-mono">
            Room: {roomId}
          </span>
          <div className="flex items-center gap-3">
            <ConnectionStatus
              displayName={`${displayName} (You)`}
              connectionState={connectionState}
            />
            {remotePeers.map((peer) => (
              <ConnectionStatus
                key={peer.peerId}
                displayName={peer.displayName}
                connectionState={peer.connectionState}
              />
            ))}
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 overflow-auto p-2 min-h-0">
          <div
            className="grid gap-2 h-full"
            style={{
              gridTemplateColumns: `repeat(${Math.min(allPeers.length + 1, 2)}, 1fr)`,
              gridTemplateRows: `repeat(${Math.ceil((allPeers.length + 1) / 2)}, auto)`,
            }}
          >
            <VideoPlayer
              stream={localStream}
              muted
              mirrored
              displayName={`${displayName} (You)`}
            />
            {remotePeers.map((peer) => (
              <VideoPlayer
                key={peer.peerId}
                stream={peer.stream || null}
                displayName={peer.displayName}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center pb-4 pt-2 shrink-0 bg-black/80">
          <MeetingControls
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onScreenShare={screenShare}
            onEndCall={handleEndCall}
            isMicOn={isMicOn}
            isCameraOn={isCameraOn}
            isScreenSharing={isScreenSharing}
            roomId={roomId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
