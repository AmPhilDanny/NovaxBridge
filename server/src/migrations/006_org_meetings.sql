-- ─────────────────────────────────────────────────────────────
-- Migration 006: Org Meetings
-- Adds meeting scheduling for B2B organizations with Jitsi integration
-- Supports: scheduled meetings, participants, RSVP, notifications
-- ─────────────────────────────────────────────────────────────

-- Organization meetings table
CREATE TABLE IF NOT EXISTS org_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_url TEXT,
  room_name TEXT NOT NULL UNIQUE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting participants (org members or external talent)
CREATE TABLE IF NOT EXISTS org_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES org_meetings(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  participant_type TEXT NOT NULL DEFAULT 'member' CHECK (participant_type IN ('member', 'external')),
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant', 'interviewer', 'interviewee')),
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'maybe')),
  notified_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_meetings_org ON org_meetings(org_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_meetings_status ON org_meetings(org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_meetings_scheduled_at ON org_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_org_meeting_participants_meeting ON org_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_org_meeting_participants_user ON org_meeting_participants(user_id);

-- Meeting notifications table
CREATE TABLE IF NOT EXISTS org_meeting_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES org_meetings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'updated', 'cancelled', 'reminder', 'started')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_notifications_recipient ON org_meeting_notifications(recipient_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notifications_org ON org_meeting_notifications(org_id, sent_at DESC);

-- Trigger to auto-update updated_at on org_meetings
CREATE OR REPLACE FUNCTION update_org_meetings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_meetings_updated ON org_meetings;
CREATE TRIGGER trg_org_meetings_updated
  BEFORE UPDATE ON org_meetings
  FOR EACH ROW EXECUTE FUNCTION update_org_meetings_timestamp();

-- Auto-create a notification when a meeting is inserted or updated
CREATE OR REPLACE FUNCTION notify_meeting_change()
RETURNS TRIGGER AS $$
DECLARE
  notif_type TEXT;
  notif_message TEXT;
  org_name TEXT;
BEGIN
  SELECT name INTO org_name FROM organizations WHERE id = NEW.org_id;

  IF TG_OP = 'INSERT' THEN
    notif_type := 'scheduled';
    notif_message := format('A new meeting "%s" has been scheduled for %s', NEW.title, org_name);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' THEN
      notif_type := 'cancelled';
      notif_message := format('Meeting "%s" has been cancelled', NEW.title);
    ELSIF NEW.status = 'live' THEN
      notif_type := 'started';
      notif_message := format('Meeting "%s" is now live — join now!', NEW.title);
    ELSE
      notif_type := 'updated';
      notif_message := format('Meeting "%s" details have been updated', NEW.title);
    END IF;
  END IF;

  -- Insert notification for all participants
  INSERT INTO org_meeting_notifications (meeting_id, org_id, recipient_id, type, message)
  SELECT NEW.id, NEW.org_id, p.user_id, notif_type, notif_message
  FROM org_meeting_participants p
  WHERE p.meeting_id = NEW.id AND p.user_id IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meeting_notify_insert ON org_meetings;
CREATE TRIGGER trg_meeting_notify_insert
  AFTER INSERT ON org_meetings
  FOR EACH ROW EXECUTE FUNCTION notify_meeting_change();

DROP TRIGGER IF EXISTS trg_meeting_notify_update ON org_meetings;
CREATE TRIGGER trg_meeting_notify_update
  AFTER UPDATE OF status ON org_meetings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_meeting_change();
