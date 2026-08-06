import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, CalendarPlus, Clock, Users, PhoneOff, Loader2, Play, Bell } from 'lucide-react';
import { toast } from 'sonner';
import type { OrgMeeting } from '../../b2b-types';
import { startMeeting, endMeeting, cancelMeeting, notifyMeetingParticipants } from '../../lib/api';
import B2BVideoCall from './B2BVideoCall';
import ScheduleMeetingDialog from './ScheduleMeetingDialog';

interface MeetingsSectionProps {
  meetings: OrgMeeting[];
  loading?: boolean;
  userName: string;
  onRefresh?: () => void;
  showScheduleButton?: boolean;
  /** Callback when a meeting is started (e.g. track analytics) */
  onMeetingStarted?: (meeting: OrgMeeting) => void;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  live: 'bg-green-100 text-green-700 border-green-200 animate-pulse',
  completed: 'bg-gray-100 text-gray-500 border-gray-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function isMeetingPast(meeting: OrgMeeting): boolean {
  const endTime = new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60000;
  return endTime < Date.now() && meeting.status === 'scheduled';
}

export default function MeetingsSection({ meetings, loading, userName, onRefresh, showScheduleButton = true, onMeetingStarted }: MeetingsSectionProps) {
  const [activeCall, setActiveCall] = useState<{ roomName: string; title: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleStartMeeting = async (meeting: OrgMeeting) => {
    setActionLoading(meeting.id);
    try {
      if (meeting.status === 'scheduled') {
        await startMeeting(meeting.id);
      }
      setActiveCall({ roomName: meeting.room_name, title: meeting.title });
      onMeetingStarted?.(meeting);
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to start meeting');
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinMeeting = (meeting: OrgMeeting) => {
    setActiveCall({ roomName: meeting.room_name, title: meeting.title });
  };

  const handleEndMeeting = async (meeting: OrgMeeting) => {
    setActionLoading(meeting.id);
    try {
      await endMeeting(meeting.id);
      toast.success('Meeting ended');
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to end meeting');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelMeeting = async (meeting: OrgMeeting) => {
    if (!confirm(`Cancel "${meeting.title}"?`)) return;
    setActionLoading(meeting.id);
    try {
      await cancelMeeting(meeting.id);
      toast.success('Meeting cancelled');
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to cancel meeting');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotify = async (meeting: OrgMeeting) => {
    setActionLoading(`notify-${meeting.id}`);
    try {
      const res = await notifyMeetingParticipants(meeting.id);
      toast.success(`Notification sent to ${res.notified_count} participant(s)`);
    } catch (err) {
      toast.error('Failed to send notification');
    } finally {
      setActionLoading(null);
    }
  };

  const activeMeetings = meetings.filter((m) => m.status === 'live');
  const upcomingMeetings = meetings.filter((m) => m.status === 'scheduled' && !isMeetingPast(m));
  const pastMeetings = meetings.filter((m) => m.status === 'completed' || m.status === 'cancelled' || isMeetingPast(m));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Active / Live Meetings */}
      {activeMeetings.length > 0 && (
        <Card className="border-green-300 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Live Now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                actionLoading={actionLoading}
                onJoin={() => handleJoinMeeting(meeting)}
                onEnd={() => handleEndMeeting(meeting)}
                onCancel={() => handleCancelMeeting(meeting)}
                onNotify={() => handleNotify(meeting)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="w-4 h-4 text-purple-600" />
            Meetings
            {upcomingMeetings.length > 0 && (
              <Badge variant="secondary" className="ml-2">{upcomingMeetings.length} upcoming</Badge>
            )}
          </CardTitle>
          {showScheduleButton && (
            <Button size="sm" onClick={() => setScheduleOpen(true)} className="bg-purple-600 hover:bg-purple-700">
              <CalendarPlus className="w-4 h-4 mr-1.5" />
              Schedule
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="text-center py-10">
              <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">No meetings scheduled</p>
              {showScheduleButton && (
                <Button onClick={() => setScheduleOpen(true)} variant="outline">
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Schedule a Meeting
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  actionLoading={actionLoading}
                  onJoin={() => handleJoinMeeting(meeting)}
                  onStart={() => handleStartMeeting(meeting)}
                  onCancel={() => handleCancelMeeting(meeting)}
                  onNotify={() => handleNotify(meeting)}
                />
              ))}
              {pastMeetings.length > 0 && (
                <details className="group">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 py-2 list-none flex items-center gap-2">
                    <span className="border-b border-dashed border-gray-300">Past meetings ({pastMeetings.length})</span>
                  </summary>
                  <div className="space-y-2 mt-2 opacity-60">
                    {pastMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {activeCall && (
        <B2BVideoCall
          open={!!activeCall}
          onOpenChange={() => {
            setActiveCall(null);
            onRefresh?.();
          }}
          roomName={activeCall.roomName}
          userName={userName}
          meetingTitle={activeCall.title}
        />
      )}

      <ScheduleMeetingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={onRefresh}
      />
    </>
  );
}

// ── Individual Meeting Card ──

interface MeetingCardProps {
  meeting: OrgMeeting;
  actionLoading?: string | null;
  onJoin?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onCancel?: () => void;
  onNotify?: () => void;
}

function MeetingCard({ meeting, actionLoading, onJoin, onStart, onEnd, onCancel, onNotify }: MeetingCardProps) {
  const dt = formatDateTime(meeting.scheduled_at);
  const isLive = meeting.status === 'live';
  const isScheduled = meeting.status === 'scheduled';
  const isCancelled = meeting.status === 'cancelled';
  const isCompleted = meeting.status === 'completed';
  const isPast = isMeetingPast(meeting) && meeting.status === 'scheduled';
  const participantCount = meeting.participants?.length || 0;

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      isLive ? 'border-green-300 bg-green-50' :
      isPast ? 'border-gray-200 bg-gray-50' :
      'border-gray-200 hover:border-purple-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-gray-900 truncate">{meeting.title}</h4>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${STATUS_STYLES[meeting.status] || ''}`}>
              {isPast ? 'past' : meeting.status}
            </Badge>
          </div>
          {meeting.description && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-1">{meeting.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dt.date} at {dt.time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {participantCount > 0 ? `${participantCount} participant${participantCount !== 1 ? 's' : ''}` : 'No participants'}
            </span>
            {meeting.duration_minutes && (
              <span>{meeting.duration_minutes} min</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLive && onJoin && (
            <Button size="sm" onClick={onJoin} className="bg-green-600 hover:bg-green-700 text-white">
              <Video className="w-3.5 h-3.5 mr-1" />
              Join
            </Button>
          )}
          {isScheduled && !isPast && onStart && (
            <Button size="sm" onClick={onStart} disabled={actionLoading === meeting.id} className="bg-purple-600 hover:bg-purple-700">
              {actionLoading === meeting.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              Start
            </Button>
          )}
          {isLive && onEnd && (
            <Button size="sm" variant="destructive" onClick={onEnd} disabled={actionLoading === meeting.id}>
              {actionLoading === meeting.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneOff className="w-3.5 h-3.5 mr-1" />}
              End
            </Button>
          )}
          {isScheduled && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel} disabled={actionLoading === meeting.id} className="text-red-600 border-red-200 hover:bg-red-50">
              Cancel
            </Button>
          )}
          {isScheduled && onNotify && (
            <Button size="sm" variant="ghost" onClick={onNotify} disabled={actionLoading === `notify-${meeting.id}`} title="Notify participants">
              {actionLoading === `notify-${meeting.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
