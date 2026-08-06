import { useState, useEffect, useRef } from 'react';
import { X, Video, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMeetings } from '../../lib/api';
import type { OrgMeeting } from '../../b2b-types';
import B2BVideoCall from './B2BVideoCall';

interface LiveMeetingBannerProps {
  userName: string;
}

const POLL_INTERVAL = 30_000;

export default function LiveMeetingBanner({ userName }: LiveMeetingBannerProps) {
  const [liveMeetings, setLiveMeetings] = useState<OrgMeeting[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeCall, setActiveCall] = useState<{ roomName: string; title: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveMeetings = async () => {
    try {
      const res = await getMeetings('live');
      setLiveMeetings(res.data || []);
    } catch {
      // polling — fail silently
    }
  };

  useEffect(() => {
    fetchLiveMeetings();
    intervalRef.current = setInterval(fetchLiveMeetings, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const visibleMeetings = liveMeetings.filter((m) => !dismissedIds.has(m.id));
  if (visibleMeetings.length === 0) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Left: status + title(s) */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 shrink-0" />
                {visibleMeetings.length === 1 ? (
                  <span className="text-sm font-medium truncate">
                    <span className="font-semibold">{visibleMeetings[0].title}</span> is live now
                  </span>
                ) : (
                  <span className="text-sm font-medium">
                    {visibleMeetings.length} meetings are live now
                  </span>
                )}
              </div>
            </div>

            {/* Right: join + dismiss */}
            <div className="flex items-center gap-2 shrink-0">
              {visibleMeetings.map((meeting) => (
                <Button
                  key={meeting.id}
                  size="sm"
                  onClick={() => setActiveCall({ roomName: meeting.room_name, title: meeting.title })}
                  className="bg-white text-green-700 hover:bg-green-50 border-0 text-xs h-7 font-semibold shadow-sm"
                >
                  <Video className="w-3.5 h-3.5 mr-1" />
                  {visibleMeetings.length > 1 ? meeting.title : 'Join'}
                </Button>
              ))}
              {/* Single dismiss hides all */}
              <button
                onClick={() => setDismissedIds(new Set(liveMeetings.map((m) => m.id)))}
                className="text-white/60 hover:text-white transition-colors ml-1"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeCall && (
        <B2BVideoCall
          open={!!activeCall}
          onOpenChange={() => setActiveCall(null)}
          roomName={activeCall.roomName}
          userName={userName}
          meetingTitle={activeCall.title}
        />
      )}
    </>
  );
}
