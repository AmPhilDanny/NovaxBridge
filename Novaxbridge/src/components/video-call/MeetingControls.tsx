import { Mic, MicOff, Camera, CameraOff, MonitorUp, MonitorDown, Link, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MeetingControlsProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onScreenShare: () => void;
  onEndCall: () => void;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  roomId: string;
}

export function MeetingControls({
  onToggleMic,
  onToggleCamera,
  onScreenShare,
  onEndCall,
  isMicOn,
  isCameraOn,
  isScreenSharing,
  roomId,
}: MeetingControlsProps) {
  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-2 sm:gap-3 bg-background/90 backdrop-blur border border-border px-3 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleMic}
              variant={isMicOn ? "secondary" : "destructive"}
              size="icon"
              className="rounded-full h-9 w-9 sm:h-11 sm:w-11"
            >
              {isMicOn ? <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> : <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMicOn ? "Mute microphone" : "Unmute microphone"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleCamera}
              variant={isCameraOn ? "secondary" : "destructive"}
              size="icon"
              className="rounded-full h-9 w-9 sm:h-11 sm:w-11"
            >
              {isCameraOn ? <Camera className="h-4 w-4 sm:h-5 sm:w-5" /> : <CameraOff className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isCameraOn ? "Turn off camera" : "Turn on camera"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onScreenShare}
              variant="secondary"
              size="icon"
              className="rounded-full h-9 w-9 sm:h-11 sm:w-11"
            >
              {isScreenSharing ? <MonitorDown className="h-4 w-4 sm:h-5 sm:w-5" /> : <MonitorUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isScreenSharing ? "Stop sharing" : "Share screen"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={copyInviteLink}
              variant="secondary"
              size="icon"
              className="rounded-full h-9 w-9 sm:h-11 sm:w-11"
            >
              <Link className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy invite link</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onEndCall}
              variant="destructive"
              size="icon"
              className="rounded-full h-9 w-9 sm:h-11 sm:w-11"
            >
              <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>End call</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
