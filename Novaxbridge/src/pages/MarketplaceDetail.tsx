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
import {
  Loader2,
  ArrowLeft,
  Clock,
  MapPin,
  Star,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getListing,
  createOrder,
  deleteListing,
  getListingReviews,
  getListingRating,
  getProviderStats,
  submitReview,
  getOrders,
  formatPrice,
  MarketplaceListing,
  ListingReview,
  ListingRating,
  ProviderStats,
} from '@/lib/marketplace';

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [ratingStat, setRatingStat] = useState<ListingRating>({ average: 0, count: 0 });
  const [reviewableOrder, setReviewableOrder] = useState<string | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        if (data?.role === 'admin') setIsAdmin(true);
      });
    }
  }, [user]);

  // Check if current user has a completed order for this listing that needs a review
  useEffect(() => {
    if (!user || !id) return;
    const checkReviewable = async () => {
      try {
        const orders = await getOrders({ role: 'buyer' });
        const match = orders.find(
          (o) => o.listing_id === id && o.status === 'completed' && o.rating === null
        );
        if (match) setReviewableOrder(match.id);
      } catch {
        // silently ignore
      }
    };
    checkReviewable();
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const [data, reviewsData, rating] = await Promise.all([
        getListing(id!),
        getListingReviews(id!),
        getListingRating(id!),
      ]);
      setListing(data);
      setReviews(reviewsData);
      setRatingStat(rating);
      // Load provider stats
      getProviderStats(data.provider_id).then(setProviderStats).catch(() => {});
    } catch (error) {
      toast.error('Failed to load listing');
      navigate('/marketplace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!user) {
      toast.error('Sign in to place an order');
      navigate('/auth');
      return;
    }
    if (!listing) return;
    if (listing.provider_id === user.id) {
      toast.error('You cannot order your own listing');
      return;
    }
    setOrdering(true);
    try {
      const order = await createOrder(listing.id);
      toast.success('Order placed!');
      navigate(`/orders/${order.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    setDeleting(true);
    try {
      await deleteListing(listing!.id);
      toast.success('Listing deleted');
      navigate('/marketplace');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete listing');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewableOrder || newRating < 1 || !newReview.trim()) return;
    setSubmittingReview(true);
    try {
      await submitReview(reviewableOrder, newRating, newReview.trim());
      toast.success('Review submitted!');
      setReviewableOrder(null);
      setNewRating(0);
      setNewReview('');
      // Reload reviews
      const [reviewsData, rating] = await Promise.all([
        getListingReviews(id!),
        getListingRating(id!),
      ]);
      setReviews(reviewsData);
      setRatingStat(rating);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!listing && isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          <p className="text-muted-foreground">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const isOwn = user?.id === listing.provider_id;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Back */}
        <button
          onClick={() => navigate('/marketplace')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to marketplace
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {listing.service && (
                  <Badge variant="secondary">{listing.service.name}</Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    listing.status === 'active'
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {listing.status === 'active' ? 'Active' : listing.status}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold text-primary">{listing.title}</h1>
            </div>

            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Duration: {listing.duration_hours} hour{listing.duration_hours > 1 ? 's' : ''}
              </span>
            </div>

            <Separator />

            {/* Provider card */}
            {listing.provider && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Service Provider</h3>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={listing.provider.avatar_url || undefined} />
                      <AvatarFallback>
                        {(listing.provider.full_name || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        to={`/talent/${listing.provider_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {listing.provider.full_name || 'Student'}
                      </Link>
                      {listing.provider.headline && (
                        <p className="text-sm text-muted-foreground">{listing.provider.headline}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews section */}
            <Separator />
            <div>
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Reviews
                {ratingStat.count > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {ratingStat.average} avg ({ratingStat.count} review{ratingStat.count > 1 ? 's' : ''})
                  </span>
                )}
              </h2>

              {reviews.length === 0 ? (
                <p className="text-muted-foreground text-sm">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={r.buyer?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(r.buyer?.full_name || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{r.buyer?.full_name || 'Anonymous'}</span>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                {Array.from({ length: r.rating }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-amber-500" />
                                ))}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{r.review}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Leave a review */}
              {reviewableOrder && (
                <Card className="mt-6 border-secondary/30 bg-secondary/5">
                  <CardContent className="pt-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Leave a review
                    </h3>
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
                              className={`w-6 h-6 ${
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
                      <Label className="text-xs">Your review</Label>
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
                      onClick={handleSubmitReview}
                      disabled={newRating < 1 || newReview.trim().length < 10 || submittingReview}
                      className="gap-1.5"
                    >
                      {submittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {submittingReview ? 'Submitting...' : 'Submit review'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-secondary">
                    ₦{Number(listing.price).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Fixed price</p>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {listing.duration_hours} hour{listing.duration_hours > 1 ? 's' : ''}
                    </span>
                  </div>
                  {listing.service && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{listing.service.name}</span>
                    </div>
                  )}
                  {ratingStat.count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating</span>
                      <span className="font-medium flex items-center gap-1 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        {ratingStat.average} ({ratingStat.count})
                      </span>
                    </div>
                  )}

                  {/* Provider stats */}
                  {providerStats && providerStats.total_orders > 0 && (
                    <>
                      <Separator />
                      <div className="text-xs space-y-1.5">
                        <p className="text-muted-foreground font-medium mb-1">Provider stats</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Orders done</span>
                          <span className="font-medium">{providerStats.total_orders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="font-medium text-green-600">{providerStats.completion_rate}%</span>
                        </div>
                        {providerStats.avg_response_hours !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Response time</span>
                            <span className="font-medium">{providerStats.avg_response_hours}h</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleOrder}
                  disabled={ordering || !user || isOwn}
                >
                  {ordering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  {isOwn ? 'Your listing' : ordering ? 'Placing order...' : 'Hire now'}
                </Button>

                {/* Contact Seller button */}
                {listing.provider && user && !isOwn && (
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/messages?userId=${listing.provider_id}&orderId=`)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contact seller
                  </Button>
                )}

                {!user && (
                  <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Sign in to place an order
                  </p>
                )}

                {(isOwn || isAdmin) && (
                  <>
                    <Separator />
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleting ? 'Deleting...' : 'Delete listing'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
