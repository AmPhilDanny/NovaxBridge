import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Shield, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminRole } from '@/lib/api-client';

const PERMISSION_FLAGS = [
  { key: 'access_admin', label: 'Access Admin Dashboard' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_roles', label: 'Manage Roles' },
  { key: 'manage_services', label: 'Manage Services' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'manage_disputes', label: 'Manage Disputes' },
  { key: 'manage_payouts', label: 'Manage Payouts' },
  { key: 'manage_settings', label: 'Manage Site Settings' },
  { key: 'browse_marketplace', label: 'Browse Marketplace' },
  { key: 'create_listings', label: 'Create Listings' },
  { key: 'create_projects', label: 'Create Projects' },
  { key: 'apply_projects', label: 'Apply to Projects' },
  { key: 'post_jobs', label: 'Post Jobs' },
  { key: 'apply_jobs', label: 'Apply to Jobs' },
  { key: 'access_b2b', label: 'Access B2B Dashboard' },
  { key: 'send_messages', label: 'Send Messages' },
  { key: 'manage_org_members', label: 'Manage Org Members' },
  { key: 'manage_org_settings', label: 'Manage Org Settings' },
  { key: 'manage_contracts', label: 'Manage Contracts' },
  { key: 'manage_hiring', label: 'Manage Hiring Pipeline' },
];

function buildPermissions(enabledKeys: string[]): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  for (const pf of PERMISSION_FLAGS) {
    perms[pf.key] = enabledKeys.includes(pf.key);
  }
  return perms;
}

function enabledCount(permissions: Record<string, boolean>): number {
  return Object.values(permissions).filter(Boolean).length;
}

interface RoleManagerProps {
  onRolesChange?: () => void;
}

export default function RoleManager({ onRolesChange }: RoleManagerProps) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSection, setShowSection] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createScope, setCreateScope] = useState<'platform' | 'org'>('platform');
  const [createDesc, setCreateDesc] = useState('');
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [editRole, setEditRole] = useState<AdminRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const [deleteRole, setDeleteRole] = useState<AdminRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (showSection) fetchRoles();
  }, [showSection]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await adminApi.roles();
      setRoles(res.data || []);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setCreating(true);
    try {
      await adminApi.createRole({
        name: createName.trim(),
        scope: createScope,
        description: createDesc.trim() || undefined,
        permissions: buildPermissions(createPerms),
      });
      toast.success(`Role "${createName}" created`);
      setCreateOpen(false);
      setCreateName('');
      setCreateScope('platform');
      setCreateDesc('');
      setCreatePerms([]);
      fetchRoles();
      onRolesChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (role: AdminRole) => {
    setEditRole(role);
    setEditName(role.name);
    setEditDesc(role.description || '');
    const enabled = PERMISSION_FLAGS.filter((pf) => role.permissions[pf.key]).map((pf) => pf.key);
    setEditPerms(enabled);
  };

  const handleEdit = async () => {
    if (!editRole) return;
    setEditing(true);
    try {
      const updates: Record<string, unknown> = {};
      if (editName.trim() !== editRole.name) updates.name = editName.trim();
      if (editDesc.trim() !== (editRole.description || '')) updates.description = editDesc.trim();
      const newPerms = buildPermissions(editPerms);
      if (JSON.stringify(newPerms) !== JSON.stringify(editRole.permissions)) updates.permissions = newPerms;
      if (Object.keys(updates).length === 0) {
        toast.info('No changes made');
        setEditRole(null);
        return;
      }
      await adminApi.updateRole(editRole.id, updates);
      toast.success('Role updated');
      setEditRole(null);
      fetchRoles();
      onRolesChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    setDeleting(true);
    try {
      await adminApi.deleteRole(deleteRole.id);
      toast.success(`Role "${deleteRole.name}" deleted`);
      setDeleteRole(null);
      fetchRoles();
      onRolesChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSection(!showSection)}
        className="gap-1.5"
      >
        <Shield className="w-4 h-4" />
        {showSection ? 'Hide' : 'Manage'} Roles
      </Button>

      {showSection && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {loading ? 'Loading...' : `${roles.length} role${roles.length !== 1 ? 's' : ''} total`}
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Role
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No roles found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            role.scope === 'platform'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }
                        >
                          {role.scope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {role.description || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {enabledCount(role.permissions)} of {PERMISSION_FLAGS.length} enabled
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(role)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500"
                                    disabled={role.is_system_role}
                                    onClick={() => setDeleteRole(role)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {role.is_system_role && (
                                <TooltipContent>System role cannot be deleted</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Role
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. editor" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Scope</Label>
                    <Select value={createScope} onValueChange={(v) => setCreateScope(v as 'platform' | 'org')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">Platform</SelectItem>
                        <SelectItem value="org">Organization</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="What this role can do..." rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Permissions</Label>
                  <p className="text-xs text-muted-foreground">{createPerms.length} of {PERMISSION_FLAGS.length} selected</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {PERMISSION_FLAGS.map((pf) => (
                      <label key={pf.key} className="flex items-start gap-2 cursor-pointer text-sm py-1">
                        <Checkbox
                          checked={createPerms.includes(pf.key)}
                          onCheckedChange={(checked) => {
                            setCreatePerms((prev) =>
                              checked ? [...prev, pf.key] : prev.filter((k) => k !== pf.key)
                            );
                          }}
                          className="mt-0.5"
                        />
                        <span className="leading-tight">{pf.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5" />
                  Edit Role
                </DialogTitle>
              </DialogHeader>
              {editRole && (
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={editRole.is_system_role} />
                    {editRole.is_system_role && (
                      <p className="text-xs text-muted-foreground">System roles cannot be renamed</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Scope</Label>
                    <Input value={editRole.scope} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Permissions</Label>
                    <p className="text-xs text-muted-foreground">{editPerms.length} of {PERMISSION_FLAGS.length} selected</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {PERMISSION_FLAGS.map((pf) => (
                        <label key={pf.key} className="flex items-start gap-2 cursor-pointer text-sm py-1">
                          <Checkbox
                            checked={editPerms.includes(pf.key)}
                            onCheckedChange={(checked) => {
                              setEditPerms((prev) =>
                                checked ? [...prev, pf.key] : prev.filter((k) => k !== pf.key)
                              );
                            }}
                            className="mt-0.5"
                          />
                          <span className="leading-tight">{pf.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
                <Button onClick={handleEdit} disabled={editing}>
                  {editing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={!!deleteRole} onOpenChange={(o) => !o && setDeleteRole(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <ShieldAlert className="w-5 h-5" />
                  Delete Role
                </DialogTitle>
              </DialogHeader>
              {deleteRole && (
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <strong>{deleteRole.name}</strong>? This action cannot be undone.
                  Users assigned this role will need to be reassigned.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteRole(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
