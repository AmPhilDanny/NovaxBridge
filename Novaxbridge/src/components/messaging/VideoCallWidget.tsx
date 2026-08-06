import { useCall } from '@/hooks/useCall';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

interface VideoCallWidgetProps {
  conversationId?: string;
  orderId?: string;
  otherUserId?: string;
  otherUserName?: string;
  userName: string;
  /** Optional: if true, shows a small icon button instead of full button */
  compact?: boolean;
}

export default function VideoCallWidget({
  otherUserId,
  otherUserName,
  userName: _userName,
  compact,
}: VideoCallWidgetProps) {
  const { startCall } = useCall();

  const handleStartCall = () => {
    if (!otherUserId) return;
    startCall(otherUserId, otherUserName || 'User');
  };

  return (
    <Button
      onClick={handleStartCall}
      variant={compact ? 'ghost' : 'default'}
      size={compact ? 'icon' : 'default'}
      className={compact ? 'h-9 w-9' : 'gap-1.5'}
      title="Start video call"
      disabled={!otherUserId}
    >
      <Video className="w-4 h-4" />
      {!compact && 'Video Call'}
    </Button>
  );
}
