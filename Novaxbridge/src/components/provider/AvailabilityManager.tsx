import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Plus, Trash2, CalendarIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAvailabilitySlots,
  getAvailabilityOverrides,
  upsertAvailabilitySlot,
  deleteAvailabilitySlot,
  upsertAvailabilityOverride,
  deleteAvailabilityOverride,
  DAY_FULL_LABELS,
  type AvailabilitySlot,
  type AvailabilityOverride,
} from '@/lib/marketplace';

interface Props {
  providerId: string;
}

const TIME_PRESETS = [
  { label: 'Morning', start: '09:00', end: '12:00' },
  { label: 'Afternoon', start: '13:00', end: '17:00' },
  { label: 'Full day', start: '09:00', end: '17:00' },
];

export default function AvailabilityManager({ providerId }: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [overrideDate, setOverrideDate] = useState<Date | undefined>(undefined);
  const [overrideAvailable, setOverrideAvailable] = useState(false);
  const [overrideStart, setOverrideStart] = useState('09:00');
  const [overrideEnd, setOverrideEnd] = useState('17:00');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        getAvailabilitySlots(providerId),
        getAvailabilityOverrides(providerId),
      ]);
      setSlots(s);
      setOverrides(o);
    } catch (err) {
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providerId) load();
  }, [providerId]);

  const handleAddSlot = async () => {
    if (!startTime || !endTime) {
      toast.error('Set a start and end time');
      return;
    }
    if (startTime >= endTime) {
      toast.error('End time must be after start time');
      return;
    }
    setSavingSlot(true);
    try {
      await upsertAvailabilitySlot(providerId, {
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
      });
      toast.success('Time slot added');
      await load();
    } catch (err) {
      toast.error('Failed to add slot');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await deleteAvailabilitySlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      toast.error('Failed to delete slot');
    }
  };

  const handleAddOverride = async () => {
    if (!overrideDate) {
      toast.error('Select a date');
      return;
    }
    if (overrideAvailable && (!overrideStart || !overrideEnd)) {
      toast.error('Set time range for available override');
      return;
    }
    if (overrideAvailable && overrideStart >= overrideEnd) {
      toast.error('End time must be after start time');
      return;
    }
    setSavingOverride(true);
    try {
      await upsertAvailabilityOverride(providerId, {
        date: overrideDate.toISOString().split('T')[0],
        is_available: overrideAvailable,
        start_time: overrideAvailable ? overrideStart : undefined,
        end_time: overrideAvailable ? overrideEnd : undefined,
        reason: overrideReason || undefined,
      });
      toast.success(overrideAvailable ? 'Custom hours set' : 'Day marked unavailable');
      setOverrideDate(undefined);
      setOverrideReason('');
      setOverrideAvailable(false);
      await load();
    } catch (err) {
      toast.error('Failed to save override');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      await deleteAvailabilityOverride(overrideId);
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    } catch (err) {
      toast.error('Failed to delete override');
    }
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h12 = hour % 12 || 12;
    return `${h12}:${m}${ampm}`;
  };

  const slotMap: Record<number, AvailabilitySlot[]> = {};
  for (let i = 0; i < 7; i++) slotMap[i] = [];
  for (const s of slots) {
    if (!slotMap[s.day_of_week]) slotMap[s.day_of_week] = [];
    slotMap[s.day_of_week].push(s);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Weekly schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add slot form */}
          <div className="flex flex-wrap items-end gap-3 bg-muted/40 p-4 rounded-lg">
            <div className="grid gap-1.5">
              <Label className="text-xs">Day</Label>
              <select
                className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
              >
                {DAY_FULL_LABELS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={handleAddSlot} disabled={savingSlot} size="sm" className="gap-1.5">
              {savingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add slot
            </Button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Quick fill:</span>
            {TIME_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={async () => {
                  setSavingSlot(true);
                  try {
                    for (let d = 1; d <= 5; d++) {
                      await upsertAvailabilitySlot(providerId, { day_of_week: d, start_time: p.start, end_time: p.end });
                    }
                    toast.success(`${p.label} slots added (Mon–Fri)`);
                    await load();
                  } catch {
                    toast.error('Failed to add presets');
                  } finally {
                    setSavingSlot(false);
                  }
                }}
                disabled={savingSlot}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Weekly grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 7 }, (_, day) => {
              const daySlots = slotMap[day] || [];
              return (
                <div key={day} className="border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground mb-2">{DAY_FULL_LABELS[day]}</p>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No slots</p>
                  ) : (
                    <div className="space-y-1.5">
                      {daySlots.map((s) => (
                        <div key={s.id} className="flex items-center justify-between group">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </Badge>
                          <button
                            onClick={() => handleDeleteSlot(s.id)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Date-specific overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Date exceptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-muted/40 p-4 rounded-lg">
            <div className="grid gap-1.5">
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-40 justify-start text-left font-normal gap-2">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {overrideDate ? overrideDate.toLocaleDateString() : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={overrideDate}
                    onSelect={setOverrideDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideAvailable}
                  onChange={(e) => setOverrideAvailable(e.target.checked)}
                  className="rounded border-border"
                />
                Available
              </label>
            </div>
            {overrideAvailable && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="time"
                    value={overrideStart}
                    onChange={(e) => setOverrideStart(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="time"
                    value={overrideEnd}
                    onChange={(e) => setOverrideEnd(e.target.value)}
                    className="w-28"
                  />
                </div>
              </>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Public holiday"
                className="w-40"
              />
            </div>
            <Button onClick={handleAddOverride} disabled={savingOverride} size="sm" className="gap-1.5">
              {savingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>

          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No date exceptions yet.</p>
          ) : (
            <div className="space-y-2">
              {overrides
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm py-2 px-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground min-w-[120px]">
                        {new Date(o.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <Badge variant={o.is_available ? 'default' : 'destructive'} className="text-xs">
                        {o.is_available ? `${formatTime(o.start_time!)} – ${formatTime(o.end_time!)}` : 'Unavailable'}
                      </Badge>
                      {o.reason && <span className="text-xs text-muted-foreground">{o.reason}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteOverride(o.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
