import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Store, Plus, Edit3, Trash2, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMyListings,
  deleteListing,
  updateListing,
  MarketplaceListing,
} from '@/lib/marketplace';

export default function MyListings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit dialog
  const [editing, setEditing] = useState<MarketplaceListing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchListings();
    else navigate('/auth');
  }, [user]);

  const fetchListings = async () => {
    try {
      const data = await getMyListings();
      setListings(data);
    } catch (error) {
      toast.error('Failed to load your listings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (listing: MarketplaceListing) => {
    setEditing(listing);
    setEditTitle(listing.title);
    setEditDesc(listing.description);
    setEditPrice(String(listing.price));
    setEditDuration(String(listing.duration_hours));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editTitle.trim() || !editDesc.trim() || !editPrice || !editDuration) {
      toast.error('Fill all fields'); return;
    }
    setSaving(true);
    try {
      await updateListing(editing.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        price: Number(editPrice),
        duration_hours: Number(editDuration),
      });
      toast.success('Listing updated');
      setEditing(null);
      fetchListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteListing(id);
      toast.success('Listing deleted');
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <Store className="w-7 h-7 text-secondary" />
              My Listings
            </h1>
            <p className="text-muted-foreground">Manage your marketplace listings.</p>
          </div>
          <Button asChild className="gap-1.5">
            <Link to="/marketplace/new">
              <Plus className="w-4 h-4" />
              New listing
            </Link>
          </Button>
        </div>

        {listings.length === 0 && isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No listings yet</h3>
            <p className="text-muted-foreground mb-6">Create your first marketplace listing to start offering services.</p>
            <Button asChild>
              <Link to="/marketplace/new">Create listing</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((listing) => (
              <Card key={listing.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/marketplace/${listing.id}`} className="font-semibold text-primary hover:underline line-clamp-1">
                        {listing.title}
                      </Link>
                      {listing.service && (
                        <Badge variant="secondary" className="mt-1 text-xs">{listing.service.name}</Badge>
                      )}
                    </div>
                    <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                      {listing.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{listing.description}</p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {listing.duration_hours}h
                    </span>
                    <span className="font-bold text-secondary">₦{Number(listing.price).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleEdit(listing)}>
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleDelete(listing.id)} disabled={deleting === listing.id}>
                      {deleting === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₦)</Label>
                <Input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Duration (hrs)</Label>
                <Input type="number" min="1" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
