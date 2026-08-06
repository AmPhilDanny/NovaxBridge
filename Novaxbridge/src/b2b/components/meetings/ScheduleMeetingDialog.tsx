import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleMeeting, getOrgMembers, type OrgMember } from '../../lib/api';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
  preselectedMembers?: string[];
}

export default function ScheduleMeetingDialog({ open, onOpenChange, onScheduled, preselectedMembers }: ScheduleMeetingDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(preselectedMembers || []);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (open && members.length === 0) {
      loadMembers();
    }
    if (!open) {
      setTitle('');
      setDescription('');
      setScheduledDate('');
      setScheduledTime('');
      setDuration('60');
      setSelectedMembers(preselectedMembers || []);
    }
  }, [open]);

  useEffect(() => {
    if (preselectedMembers) {
      setSelectedMembers(preselectedMembers);
    }
  }, [preselectedMembers]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await getOrgMembers();
      setMembers(res.data || []);
    } catch {
      // silent
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !scheduledDate || !scheduledTime) {
      toast.error('Title, date, and time are required');
      return;
    }

    setSubmitting(true);
    try {
      const scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      await scheduleMeeting({
        title,
        description: description || undefined,
        scheduled_at,
        duration_minutes: parseInt(duration) || 60,
        participant_ids: selectedMembers.length > 0 ? selectedMembers : undefined,
      });
      toast.success('Meeting scheduled successfully');
      onOpenChange(false);
      onScheduled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-600" />
            Schedule a Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a Jitsi video conference for your team or interview.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Sync, Interview with John"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, notes, or context..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">
                <CalendarIcon className="w-3.5 h-3.5 inline mr-1" />
                Date
              </Label>
              <Input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={minDate}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledTime">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Time
              </Label>
              <Input
                id="scheduledTime"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Participants (team members)</Label>
            {loadingMembers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading members...
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No team members found. You can still schedule and share the link.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.user_id)}
                      onChange={() => toggleMember(member.user_id)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium">{member.user?.full_name || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground ml-auto capitalize">{member.role}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling...</>
              ) : (
                <><Video className="w-4 h-4 mr-2" /> Schedule Meeting</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
