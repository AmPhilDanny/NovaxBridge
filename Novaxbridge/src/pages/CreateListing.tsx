import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { getServices, createListing, Service } from '@/lib/marketplace';

export default function CreateListing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isFirm = profile?.role === 'firm';

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [durationHours, setDurationHours] = useState('24');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadServices();
  }, [user]);

  const loadServices = async () => {
    try {
      const data = await getServices();
      setServices(data);
    } catch {
      toast.error('Failed to load service categories');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !serviceId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isFirm && !price) {
      toast.error('Price is required for listing categories');
      return;
    }

    const priceNum = price ? Number(price) : 0;
    if (price && (isNaN(priceNum) || priceNum < 0)) {
      toast.error('Please enter a valid price');
      return;
    }

    const hours = Number(durationHours);
    if (isNaN(hours) || hours < 1) {
      toast.error('Duration must be at least 1 hour');
      return;
    }

    setSubmitting(true);
    try {
      const listing = await createListing({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        service_id: serviceId,
        duration_hours: hours,
      });
      toast.success('Listing created!');
      navigate(`/marketplace/${listing.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <button
          onClick={() => navigate('/marketplace')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to marketplace
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {isFirm ? (
                <><Plus className="w-6 h-6 text-secondary" /> Create a listing</>
              ) : (
                <><Briefcase className="w-6 h-6 text-secondary" /> Create a gig</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. I'll type your 50-page document in 24 hours"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what you're offering in detail — what the buyer gets, turnaround time, any requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Category *</Label>
                {loadingServices ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading categories...
                  </div>
                ) : (
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service category" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.name} — ₦{Number(svc.base_price).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₦) {isFirm ? '*' : '(optional for gigs)'}</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    placeholder="5000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    placeholder="24"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating listing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Publish listing
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
