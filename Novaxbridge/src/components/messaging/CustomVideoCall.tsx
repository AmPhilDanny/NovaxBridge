import VideoCallDialog from '@/components/messaging/VideoCallDialog';

interface CustomVideoCallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  userName: string;
}

export default function CustomVideoCall({ open, onOpenChange, roomName, userName }: CustomVideoCallProps) {
  return (
    <VideoCallDialog
      open={open}
      onOpenChange={onOpenChange}
      roomId={roomName}
      displayName={userName}
    />
  );
}
