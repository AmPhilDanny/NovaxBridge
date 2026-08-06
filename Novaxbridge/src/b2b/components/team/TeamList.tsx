import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, X, Mail, Clock, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgMembers } from '../../hooks/useOrgMembers';
import {
  changeMemberRole, getOrgInvites, cancelInvite, inviteMember, scheduleMeeting,
} from '../../lib/api';
import type { OrgMember, OrgInvite } from '../../b2b-types';
import { toast } from 'sonner';
import { useOrg } from '../../hooks/useOrg';
import { ORG_ROLE_LABELS, ORG_MANAGER_ROLES } from '../../lib/constants';
import B2BVideoCall from '../meetings/B2BVideoCall';

export default function TeamList() {
  const { org, role: myRole } = useOrg();
  const { profile } = useAuth();
  const { members, isLoading, refresh, invite, remove, isInviting } = useOrgMembers();
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callRoomName, setCallRoomName] = useState<string | null>(null);
  const [startingCall, setStartingCall] = useState(false);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const fetchInvites = useCallback(async () => {
    if (!canManage) return;
    try {
      setIsLoadingInvites(true);
      const result = await getOrgInvites();
      setInvites(result.data.filter(i => i.status === 'pending'));
    } catch {
      // ignore
    } finally {
      setIsLoadingInvites(false);
    }
  }, [canManage]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await inviteMember({ email: inviteEmail.trim(), role: inviteRole as any });
      toast.success('Invitation sent');
      setInviteEmail('');
      setInviteDialogOpen(false);
      fetchInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setRoleChangeLoading(memberId);
    try {
      await changeMemberRole(memberId, newRole);
      refresh();
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await remove(removeTarget.id);
      toast.success('Member removed');
      setRemoveTarget(null);
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.success('Invite cancelled');
    } catch {
      toast.error('Failed to cancel invite');
    }
  };

  const handleTeamCall = async () => {
    setStartingCall(true);
    try {
      const roomName = `b2b-${org?.slug || 'team'}-${Date.now().toString(36)}`;
      await scheduleMeeting({
        title: 'Team Conference Call',
        scheduled_at: new Date().toISOString(),
        duration_minutes: 60,
        participant_ids: members.map((m) => m.user_id).filter(Boolean) as string[],
      });
      setCallRoomName(roomName);
      setCallOpen(true);
    } catch {
      const roomName = `b2b-${org?.slug || 'team'}-${Date.now().toString(36)}`;
      setCallRoomName(roomName);
      setCallOpen(true);
    } finally {
      setStartingCall(false);
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTeamCall} disabled={startingCall}>
            {startingCall ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
            Team Call
          </Button>
          {canManage && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4 mr-2" /> Invite Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isInviting} className="w-full">
                  {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Members table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No team members yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-semibold flex-shrink-0">
                      {member.user?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.user?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">{member.user?.email || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {canManage && member.role !== 'owner' ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v)}
                        disabled={roleChangeLoading === member.id}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {ORG_ROLE_LABELS[member.role] || member.role}
                      </Badge>
                    )}
                    {canManage && member.role !== 'owner' && (
                      <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(member)}>
                        <X className="w-3 h-3 text-gray-400" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {canManage && pendingInvites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-300" />
                    <div>
                      <p className="text-sm text-gray-700">{invite.email}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{ORG_ROLE_LABELS[invite.role]}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleCancelInvite(invite.id)}>
                      <X className="w-3 h-3 text-gray-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {callRoomName && (
        <B2BVideoCall
          open={callOpen}
          onOpenChange={(o) => { setCallOpen(o); if (!o) setCallRoomName(null); }}
          roomName={callRoomName}
          userName={profile?.full_name || profile?.email || 'Team Member'}
          meetingTitle="Team Conference Call"
        />
      )}

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.user?.full_name || 'This member'} will lose access to the organization and all its resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
