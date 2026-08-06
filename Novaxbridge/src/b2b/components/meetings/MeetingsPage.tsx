import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getMeetings, getMeetingNotifications, markNotificationRead, type OrgMeeting, type OrgMeetingNotification } from '../../lib/api';
import MeetingsSection from './MeetingsSection';

export default function MeetingsPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<OrgMeeting[]>([]);
  const [notifications, setNotifications] = useState<OrgMeetingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const fetchMeetings = useCallback(async () => {
    try {
      const status = activeTab === 'upcoming' ? 'scheduled,live' : activeTab === 'past' ? 'completed,cancelled' : undefined;
      const res = await getMeetings(status);
      setMeetings(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getMeetingNotifications();
      setNotifications(res.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    fetchNotifications();
  }, [fetchMeetings, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      {/* Notifications bar */}
      {notifications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <Bell className="w-4 h-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-amber-500 text-white text-[10px] px-1.5">{unreadCount} new</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {notifications.slice(0, 5).map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-2 rounded-md text-sm ${
                  !notif.read_at ? 'bg-amber-100/50 font-medium' : 'text-gray-500'
                }`}
              >
                <span className="mt-0.5">
                  {notif.type === 'started' ? '🔴' : notif.type === 'cancelled' ? '❌' : '📅'}
                </span>
                <span className="flex-1">{notif.message}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(notif.sent_at).toLocaleDateString()}
                </span>
                {!notif.read_at && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    className="text-amber-600 hover:text-amber-800 shrink-0"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {notifications.length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{notifications.length - 5} more</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b pb-0.5">
        {(['upcoming', 'all', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setLoading(true); }}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-md ${
              activeTab === tab
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Meetings section */}
      <MeetingsSection
        meetings={meetings}
        loading={loading}
        userName={profile?.full_name || profile?.email || 'User'}
        onRefresh={() => { fetchMeetings(); fetchNotifications(); }}
        showScheduleButton={true}
      />
    </div>
  );
}
