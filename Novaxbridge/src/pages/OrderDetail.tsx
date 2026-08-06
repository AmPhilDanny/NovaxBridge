import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Star,
  AlertCircle,
  MessageSquare,
  Ban,
  RefreshCw,
  Plus,
  Play,
  XCircle,
  Send,
  ListChecks,
  CreditCard,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getOrder,
  updateOrderStatus,
  Order,
  getMilestones,
  createMilestone,
  updateMilestoneStatus,
  OrderMilestone,
  updateReview,
  deleteReview,
} from '@/lib/marketplace';
import { supabase } from '@/integrations/supabase/client';
import PaymentCheckoutModal from '@/components/marketplace/PaymentCheckoutModal';
import PaymentStatusBadge from '@/components/marketplace/PaymentStatusBadge';
import EscrowReleaseButton from '@/components/marketplace/EscrowReleaseButton';
import ManualPaymentForm from '@/components/marketplace/ManualPaymentForm';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: CheckCircle2 },
  disputed: { label: 'Disputed', color: 'bg-red-500/15 text-red-700 dark:text-red-400', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: Ban },
  refunded: { label: 'Refunded', color: 'bg-purple-500/15 text-purple-700', icon: RefreshCw },
};

const ML_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  submitted: { label: 'Submitted', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  approved: { label: 'Approved', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

const TIMELINE = ['pending', 'in_progress', 'completed'] as const;

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');
  const [editReviewMode, setEditReviewMode] = useState(false);
  const [editRating, setEditRating] = useState(0);
  const [editReview, setEditReview] = useState('');

  // Milestone state
  const [milestones, setMilestones] = useState<OrderMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMlTitle, setNewMlTitle] = useState('');
  const [newMlDesc, setNewMlDesc] = useState('');
  const [newMlAmount, setNewMlAmount] = useState('');
  const [newMlDue, setNewMlDue] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Dispute state
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputing, setDisputing] = useState(false);

  // Payment state
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Offline/Manual payment state
  const [bankTransferOpen, setBankTransferOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const data = await getOrder(id!);
      setOrder(data);
      loadMilestones(data.id);
    } catch (error) {
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMilestones = async (orderId: string) => {
    setMilestonesLoading(true);
    try {
      const data = await getMilestones(orderId);
      setMilestones(data);
    } catch {
      // silent
    } finally {
      setMilestonesLoading(false);
    }
  };

  const handleAction = async (status: string, extra?: { rating?: number; review?: string }) => {
    if (!order) return;
    setActionLoading(status);
    try {
      await updateOrderStatus(order.id, status, extra);
      toast.success(`Order ${status.replace('_', ' ')}`);
      loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteWithReview = async () => {
    if (!order) return;
    await handleAction('completed', {
      ...(newRating > 0 ? { rating: newRating } : {}),
      ...(newReview.trim() ? { review: newReview.trim() } : {}),
    });
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const title = newMlTitle.trim();
    const amount = Number(newMlAmount);
    if (!title) { toast.error('Title is required'); return; }
    if (!amount || amount <= 0) { toast.error('Amount must be greater than 0'); return; }

    setAddingMilestone(true);
    try {
      await createMilestone(order.id, {
        title,
        description: newMlDesc.trim() || undefined,
        amount,
        due_date: newMlDue || undefined,
      });
      toast.success('Milestone added');
      setAddDialogOpen(false);
      setNewMlTitle('');
      setNewMlDesc('');
      setNewMlAmount('');
      setNewMlDue('');
      loadMilestones(order.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add milestone');
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleDispute = async () => {
    if (!order || !disputeReason.trim()) {
      toast.error('Please describe why you are disputing');
      return;
    }
    setDisputing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/marketplace-orders/orders/${order.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'disputed',
          dispute_reason: disputeReason.trim(),
          dispute_description: disputeDesc.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispute order');
      }
      toast.success('Dispute submitted. An admin will review it.');
      setDisputeOpen(false);
      loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to dispute');
    } finally {
      setDisputing(false);
    }
  };

  const handleMilestoneAction = async (milestoneId: string, status: string) => {
    setActionLoading(`ml-${milestoneId}`);
    try {
      await updateMilestoneStatus(milestoneId, status);
      toast.success(`Milestone ${status.replace('_', ' ')}`);
      loadMilestones(order!.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (!order && isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const isBuyer = user?.id === order.buyer_id;
  const isProvider = user?.id === order.provider_id;
  const StatusIcon = STATUS_CONFIG[order.status]?.icon || Clock;
  const currentStep = TIMELINE.indexOf(order.status as typeof TIMELINE[number]);

  // Milestone calculations
  const milestoneTotal = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
  const approvedTotal = milestones
    .filter((m) => m.status === 'approved')
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const progressPct = order.amount > 0 ? Math.min((approvedTotal / Number(order.amount)) * 100, 100) : 0;

  return (
    <>
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={STATUS_CONFIG[order.status]?.color || ''} variant="secondary">
                  <StatusIcon className="w-3 h-3 mr-1 inline" />
                  {STATUS_CONFIG[order.status]?.label || order.status}
                </Badge>
                {order.payment_status === 'paid' && (
                  <PaymentStatusBadge status="paid" />
                )}
                {order.payment_status === 'unpaid' && (
                  <PaymentStatusBadge status="unpaid" />
                )}
                {order.payment_status === 'pending' && (
                  <PaymentStatusBadge status="pending" />
                )}
                <span className="text-xs text-muted-foreground">
                  Order #{order.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-primary">
                {order.listing?.title || 'Service Order'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ordered on {new Date(order.created_at).toLocaleDateString()}
                {order.completed_at && ` — Completed ${new Date(order.completed_at).toLocaleDateString()}`}
              </p>
            </div>

            <Separator />

            {/* Status Timeline */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Progress
                </h3>
                <div className="relative">
                  {TIMELINE.map((step, i) => {
                    const StepIcon = STATUS_CONFIG[step].icon;
                    const isDone = currentStep >= i;
                    const isCurrent = currentStep === i;
                    return (
                      <div key={step} className="flex items-start gap-3 pb-6 last:pb-0 relative">
                        {i < TIMELINE.length - 1 && (
                          <div
                            className={`absolute left-[15px] top-7 w-0.5 h-full -z-10 ${
                              currentStep > i ? 'bg-green-500' : 'bg-border'
                            }`}
                          />
                        )}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-green-500/15 text-green-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <StepIcon className="w-4 h-4" />
                        </div>
                        <div className="pt-0.5">
                          <p className={`font-medium text-sm ${isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {STATUS_CONFIG[step].label}
                            {isCurrent && <span className="ml-2 text-xs text-secondary">(current)</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Milestones */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-muted-foreground" />
                    Milestones
                    {milestones.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">({milestones.length})</span>
                    )}
                  </h3>
                  {isProvider && (order.status === 'pending' || order.status === 'in_progress') && (
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Milestone
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Milestone</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddMilestone} className="space-y-4">
                          <div>
                            <Label htmlFor="ml-title">Title</Label>
                            <Input
                              id="ml-title"
                              value={newMlTitle}
                              onChange={(e) => setNewMlTitle(e.target.value)}
                              placeholder="e.g. Research phase"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="ml-desc">Description (optional)</Label>
                            <Textarea
                              id="ml-desc"
                              value={newMlDesc}
                              onChange={(e) => setNewMlDesc(e.target.value)}
                              placeholder="What this milestone covers..."
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="ml-amount">Amount (₦)</Label>
                              <Input
                                id="ml-amount"
                                type="number"
                                min="1"
                                max={Number(order.amount) - milestoneTotal}
                                value={newMlAmount}
                                onChange={(e) => setNewMlAmount(e.target.value)}
                                placeholder="0"
                                required
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Remaining: ₦{(Number(order.amount) - milestoneTotal).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="ml-due">Due date (optional)</Label>
                              <Input
                                id="ml-due"
                                type="date"
                                value={newMlDue}
                                onChange={(e) => setNewMlDue(e.target.value)}
                              />
                            </div>
                          </div>
                          <Button type="submit" disabled={addingMilestone} className="w-full">
                            {addingMilestone ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Add Milestone
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Progress bar */}
                {milestones.length > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>₦{approvedTotal.toLocaleString()} approved</span>
                      <span>of ₦{Number(order.amount).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Milestone list */}
                {milestonesLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                  </div>
                ) : milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No milestones yet.
                    {isProvider && (order.status === 'pending' || order.status === 'in_progress')
                      ? ' Add milestones to break this order into phases.'
                      : ' The provider will add milestones soon.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {milestones.map((ml, i) => {
                      const mlConfig = ML_STATUS_CONFIG[ml.status] || { label: ml.status, color: '' };
                      const isMlAction = actionLoading === `ml-${ml.id}`;
                      return (
                        <div key={ml.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{ml.title}</p>
                                {ml.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ml.description}</p>
                                )}
                              </div>
                              <Badge className={`${mlConfig.color} shrink-0`} variant="secondary">
                                {mlConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">₦{Number(ml.amount).toLocaleString()}</span>
                              {ml.due_date && <span>Due: {new Date(ml.due_date).toLocaleDateString()}</span>}
                            </div>

                            {/* Milestone action buttons */}
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {isProvider && ml.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMilestoneAction(ml.id, 'in_progress')}
                                  disabled={isMlAction}
                                >
                                  {isMlAction ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                  Start
                                </Button>
                              )}
                              {isProvider && ml.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMilestoneAction(ml.id, 'submitted')}
                                  disabled={isMlAction}
                                >
                                  {isMlAction ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                                  Submit for approval
                                </Button>
                              )}
                              {isBuyer && ml.status === 'submitted' && (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleMilestoneAction(ml.id, 'approved')}
                                    disabled={isMlAction}
                                  >
                                    {isMlAction ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMilestoneAction(ml.id, 'rejected')}
                                    disabled={isMlAction}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Listing details */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Service Details</h3>
                {order.listing && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Listing</span>
                      <Link to={`/marketplace/${order.listing_id}`} className="text-secondary hover:underline font-medium">
                        {order.listing.title}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-secondary">₦{Number(order.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{(order.listing as unknown as Record<string, unknown>)?.duration_hours as string || '—'} hours</span>
                    </div>
                    {(order.listing as unknown as Record<string, unknown>)?.description && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">Description</span>
                        <p className="text-foreground mt-1 whitespace-pre-wrap">
                          {(order.listing as unknown as Record<string, unknown>)?.description as string || ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Review section */}
            {order.status === 'completed' && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Review
                  </h3>
                  {editReviewMode ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Rating</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setEditRating(star)}
                              className="p-0.5 transition-colors"
                            >
                              <Star
                                className={`w-7 h-7 ${
                                  star <= editRating
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Review</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          rows={3}
                          placeholder="Update your review..."
                          value={editReview}
                          onChange={(e) => setEditReview(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            setActionLoading('edit-review');
                            try {
                              await updateReview(order.id, editRating || undefined, editReview.trim() || undefined);
                              toast.success('Review updated');
                              setEditReviewMode(false);
                              loadOrder();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Failed to update review');
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                          disabled={actionLoading === 'edit-review' || editRating < 1}
                        >
                          {actionLoading === 'edit-review' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : null}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditReviewMode(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : order.rating ? (
                    <div>
                      <div className="flex items-center gap-1 text-amber-500 mb-1">
                        {Array.from({ length: order.rating }).map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-amber-500" />
                        ))}
                        {Array.from({ length: 5 - order.rating }).map((_, i) => (
                          <Star key={`e${i}`} className="w-5 h-5 text-muted-foreground" />
                        ))}
                        <span className="text-sm font-medium text-foreground ml-1">{order.rating}/5</span>
                      </div>
                      {order.review && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{order.review}"</p>
                      )}
                      {isBuyer && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditRating(order.rating || 0);
                              setEditReview(order.review || '');
                              setEditReviewMode(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (!confirm('Delete this review?')) return;
                              setActionLoading('delete-review');
                              try {
                                await deleteReview(order.id);
                                toast.success('Review deleted');
                                loadOrder();
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : 'Failed to delete review');
                              } finally {
                                setActionLoading(null);
                              }
                            }}
                            disabled={actionLoading === 'delete-review'}
                          >
                            {actionLoading === 'delete-review' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : 'Delete'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : isBuyer ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        How was your experience? Leave a review for the provider.
                      </p>
                      <div>
                        <Label className="text-xs">Rating</Label>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setNewRating(star)}
                              className="p-0.5 transition-colors"
                            >
                              <Star
                                className={`w-7 h-7 ${
                                  star <= newRating
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Review (optional)</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          rows={3}
                          placeholder="Share your experience..."
                          value={newReview}
                          onChange={(e) => setNewReview(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAction('completed', {
                            rating: newRating || undefined,
                            review: newReview.trim() || undefined,
                          })
                        }
                        disabled={actionLoading === 'review' || newRating < 1}
                      >
                        {actionLoading === 'review' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : null}
                        Submit review
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Waiting for the buyer to leave a review.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="sticky top-28">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-secondary">
                    ₦{Number(order.amount).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Order total</p>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Buyer</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={order.buyer?.avatar_url || undefined} />
                        <AvatarFallback>{(order.buyer?.full_name || '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{order.buyer?.full_name || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Provider</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={order.provider?.avatar_url || undefined} />
                        <AvatarFallback>{(order.provider?.full_name || '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{order.provider?.full_name || '—'}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {isProvider && order.status === 'pending' && (
                    <Button
                      className="w-full gap-1.5"
                      size="sm"
                      onClick={() => handleAction('in_progress')}
                      disabled={actionLoading === 'in_progress'}
                    >
                      {actionLoading === 'in_progress' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Accept order
                    </Button>
                  )}

                  {isBuyer && order.status === 'in_progress' && (
                    <div className="space-y-2">
                      <Button
                        className="w-full gap-1.5"
                        size="sm"
                        onClick={handleCompleteWithReview}
                        disabled={actionLoading === 'completed'}
                      >
                        {actionLoading === 'completed' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Mark complete
                      </Button>
                      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
                        <DialogTrigger asChild>
                          <Button
                            className="w-full gap-1.5"
                            variant="outline"
                            size="sm"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Dispute
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Raise a dispute</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="grid gap-2">
                              <Label htmlFor="reason">Reason *</Label>
                              <select
                                id="reason"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                              >
                                <option value="">Select a reason...</option>
                                <option value="Work not delivered">Work not delivered</option>
                                <option value="Quality not as expected">Quality not as expected</option>
                                <option value="Missed deadline">Missed deadline</option>
                                <option value="Incomplete work">Incomplete work</option>
                                <option value="Communication issue">Communication issue</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="desc">Details</Label>
                              <textarea
                                id="desc"
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={disputeDesc}
                                onChange={(e) => setDisputeDesc(e.target.value)}
                                placeholder="Explain what went wrong, include any relevant details..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={handleDispute}
                              disabled={disputing || !disputeReason.trim()}
                              variant="destructive"
                            >
                              {disputing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                              Submit dispute
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {order.status === 'disputed' && (
                    <Button
                      className="w-full gap-1.5"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/disputes?order=${order.id}`)}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      View dispute
                    </Button>
                  )}

                  {isBuyer && (order.payment_status === 'unpaid' || order.payment_status === 'pending') && (
                    <>
                      <Button
                        className="w-full gap-1.5"
                        size="sm"
                        onClick={() => setCheckoutOpen(true)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {order.payment_status === 'pending' ? 'Continue Payment' : 'Pay Now'}
                      </Button>
                      <ManualPaymentForm
                        open={bankTransferOpen}
                        onOpenChange={setBankTransferOpen}
                        orderId={order.id}
                        onSubmitted={loadOrder}
                      />
                      <Button
                        className="w-full gap-1.5"
                        variant="outline"
                        size="sm"
                        onClick={() => setBankTransferOpen(true)}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Pay by Transfer
                      </Button>
                    </>
                  )}

                  {isProvider && order.payment_status === 'paid' && order.status === 'completed' && !(order as unknown as Record<string, unknown>).escrow_release_at && (
                    <EscrowReleaseButton
                      orderId={order.id}
                      onReleased={loadOrder}
                    />
                  )}

                  {isBuyer && order.status === 'pending' && order.payment_status !== 'paid' && (
                    <Button
                      className="w-full gap-1.5"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction('cancelled')}
                      disabled={actionLoading === 'cancelled'}
                    >
                      {actionLoading === 'cancelled' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      Cancel order
                    </Button>
                  )}

                  <Button
                    className="w-full gap-1.5"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const otherId = isBuyer ? order.provider_id : order.buyer_id;
                      navigate(`/messages?userId=${otherId}&orderId=${order.id}`);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message {isBuyer ? 'provider' : 'buyer'}
                  </Button>

                  {(order as unknown as Record<string, unknown>).escrow_release_at && (
                    <div className="text-xs text-muted-foreground text-center pt-1 px-2">
                      <p>Funds release scheduled for {new Date((order as unknown as Record<string, unknown>).escrow_release_at as string).toLocaleString()}</p>
                    </div>
                  )}

                  <Button className="w-full gap-1.5" variant="ghost" size="sm" asChild>
                    <Link to={`/marketplace/${order.listing_id}`}>
                      View listing
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>

    <PaymentCheckoutModal
      open={checkoutOpen}
      onOpenChange={setCheckoutOpen}
      orderId={order.id}
      amount={Number(order.amount)}
      currency={order.currency || 'NGN'}
      onPaymentInitiated={loadOrder}
    />

    <ManualPaymentForm
      open={bankTransferOpen}
      onOpenChange={setBankTransferOpen}
      orderId={order.id}
      onSubmitted={loadOrder}
    />
    </>
  );
}