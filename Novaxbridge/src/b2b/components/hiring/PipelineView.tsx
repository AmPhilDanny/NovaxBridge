import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, CheckSquare, Square, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getPipelineApplications, updatePipelineStatus, bulkUpdatePipelineStatus,
  scheduleMeeting, B2BApiError,
  type PipelineApplication,
} from '../../lib/api';
import { toast } from 'sonner';
import ErrorDisplay from '../ErrorDisplay';
import B2BVideoCall from '../meetings/B2BVideoCall';

const PIPELINE_COLUMNS = [
  { key: 'pending', label: 'New', color: 'bg-gray-100 text-gray-700' },
  { key: 'reviewed', label: 'Reviewed', color: 'bg-blue-100 text-blue-700' },
  { key: 'interviewed', label: 'Interviewed', color: 'bg-purple-100 text-purple-700' },
  { key: 'offer', label: 'Offer', color: 'bg-amber-100 text-amber-700' },
  { key: 'accepted', label: 'Hired', color: 'bg-green-100 text-green-700' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
] as const;

type PipelineStatus = typeof PIPELINE_COLUMNS[number]['key'];

function SortableCard({
  app, isSelected, onToggleSelect, onClick,
}: {
  app: PipelineApplication;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
    data: { type: 'application', app },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2">
      <div className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm ${isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-start gap-2">
          <button onClick={(e) => { e.stopPropagation(); onToggleSelect(); }} className="mt-0.5">
            {isSelected ? <CheckSquare className="w-4 h-4 text-purple-600" /> : <Square className="w-4 h-4 text-gray-300" />}
          </button>
          <div className="min-w-0 flex-1" onClick={onClick}>
            <p className="text-sm font-medium text-gray-900 truncate">{app.profiles?.full_name || 'Unknown'}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{app.jobs?.title || 'Unknown job'}</p>
            {app.profiles?.headline && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{app.profiles.headline}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {app.profiles?.skills?.slice(0, 3).map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnCard({ app }: { app: PipelineApplication }) {
  const [showDetail, setShowDetail] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);

  return (
    <>
      <div
        className="p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:shadow-sm transition-shadow"
        onClick={() => setShowDetail(true)}
      >
        <p className="text-sm font-medium text-gray-900 truncate">{app.profiles?.full_name || 'Unknown'}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{app.jobs?.title || 'Unknown job'}</p>
        {app.created_at && (
          <p className="text-xs text-gray-400 mt-1">{new Date(app.created_at).toLocaleDateString()}</p>
        )}
      </div>

      {showDetail && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">{app.profiles?.full_name || 'Unknown'}</h3>
            <p className="text-sm text-gray-500 mt-1">{app.jobs?.title} — {app.jobs?.type}</p>
            {app.profiles?.headline && <p className="text-sm text-gray-600 mt-3">{app.profiles.headline}</p>}
            {app.profiles?.skills && app.profiles.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {app.profiles.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            )}
            {app.cover_letter && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cover Letter</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap line-clamp-6">{app.cover_letter}</p>
              </div>
            )}
            {app.resume_url && (
              <a href={app.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-purple-600 mt-3 hover:underline">
                <ExternalLink className="w-3 h-3" /> View Resume
              </a>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowDetail(false)}>Close</Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => setInterviewOpen(true)}
              >
                <Video className="w-3.5 h-3.5 mr-1" />
                Interview
              </Button>
            </div>
          </div>
        </div>
      )}

      {interviewOpen && (
        <InterviewCallOverlay
          app={app}
          onClose={() => setInterviewOpen(false)}
        />
      )}
    </>
  );
}

function InterviewCallOverlay({ app, onClose }: { app: PipelineApplication; onClose: () => void }) {
  const { profile } = useAuth();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const candidateName = app.profiles?.full_name || 'Candidate';
        await scheduleMeeting({
          title: `Interview: ${candidateName} - ${app.jobs?.title || 'Position'}`,
          description: `Interview with ${candidateName} for ${app.jobs?.title || 'a position'}`,
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          participant_ids: app.student_id ? [app.student_id] : undefined,
        });
      } catch {
        // continue with local room
      }
      setRoomName(`b2b-interview-${app.id.slice(0, 8)}-${Date.now().toString(36)}`);
      setLoading(false);
    })();
  }, [app]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Preparing interview room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Video Interview</h3>
        <p className="text-sm text-gray-500 mb-4">
          Interviewing: <strong>{app.profiles?.full_name || 'Candidate'}</strong> for {app.jobs?.title || 'position'}
        </p>
        <B2BVideoCall
          open={true}
          onOpenChange={(o) => { if (!o) onClose(); }}
          roomName={roomName || 'interview-room'}
          userName={profile?.full_name || profile?.email || 'Interviewer'}
          meetingTitle={`Interview: ${app.profiles?.full_name || 'Candidate'}`}
        />
      </div>
    </div>
  );
}

export default function PipelineView() {
  const [apps, setApps] = useState<PipelineApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<B2BApiError | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeApp, setActiveApp] = useState<PipelineApplication | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchApps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getPipelineApplications();
      setApps(result.data);
    } catch (err) {
      if (err instanceof B2BApiError) {
        setError(err);
      } else {
        setError(new B2BApiError('UNKNOWN', 'Failed to load applications'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const grouped = PIPELINE_COLUMNS.reduce((acc, col) => {
    acc[col.key] = apps.filter(a => a.status === col.key);
    return acc;
  }, {} as Record<string, PipelineApplication[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const app = apps.find(a => a.id === event.active.id);
    if (app) setActiveApp(app);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveApp(null);
    const { active, over } = event;
    if (!over) return;

    const appId = active.id as string;
    const targetColumn = over.data.current?.type === 'column'
      ? (over.id as string)
      : apps.find(a => a.id === over.id)?.status;

    if (!targetColumn || targetColumn === apps.find(a => a.id === appId)?.status) return;

    // Optimistic update
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: targetColumn as PipelineStatus } : a));

    try {
      await updatePipelineStatus(appId, targetColumn);
    } catch {
      fetchApps();
      toast.error('Failed to update pipeline status');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdatePipelineStatus(Array.from(selectedIds), status);
      setApps(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status: status as PipelineStatus } : a));
      setSelectedIds(new Set());
      toast.success(`Updated ${selectedIds.size} application(s)`);
    } catch {
      toast.error('Bulk update failed');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto pt-8">
        <ErrorDisplay error={error} onRetry={fetchApps} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <span className="text-sm font-medium text-purple-900">{selectedIds.size} selected</span>
          {PIPELINE_COLUMNS.map(col => (
            <Button key={col.key} size="sm" variant="outline" onClick={() => handleBulkUpdate(col.key)}>
              Move to {col.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {PIPELINE_COLUMNS.map(col => (
            <div key={col.key} className="bg-gray-50 rounded-lg p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded ${col.color}`}>
                  {col.label}
                </h3>
                <span className="text-xs text-gray-400">{grouped[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {grouped[col.key]?.map(app => (
                  <SortableCard
                    key={app.id}
                    app={app}
                    isSelected={selectedIds.has(app.id)}
                    onToggleSelect={() => toggleSelect(app.id)}
                    onClick={() => {}}
                  />
                ))}
              </div>
              {(!grouped[col.key] || grouped[col.key].length === 0) && (
                <p className="text-xs text-gray-400 text-center py-8">No applicants</p>
              )}
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeApp && <ColumnCard app={activeApp} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
