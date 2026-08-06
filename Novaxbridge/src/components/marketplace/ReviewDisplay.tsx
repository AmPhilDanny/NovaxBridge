import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProviderReviews } from '@/lib/marketplace';
import type { ProviderReview } from '@/lib/marketplace';

interface ReviewDisplayProps {
  providerId: string;
  reviews?: ProviderReview[];
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ReviewDisplay({ providerId, reviews: initialReviews }: ReviewDisplayProps) {
  const [reviews, setReviews] = useState<ProviderReview[]>(initialReviews || []);
  const [isLoading, setIsLoading] = useState(!initialReviews);

  useEffect(() => {
    if (initialReviews) return;
    setIsLoading(true);
    getProviderReviews(providerId)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [providerId, initialReviews]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No reviews yet</p>
      </div>
    );
  }

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-900">{avg.toFixed(1)}</span>
        <span className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              className={i < Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
            />
          ))}
        </span>
        <span className="text-sm text-gray-500">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <Card key={review.id} className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={review.buyer?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(review.buyer?.full_name || 'A').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {review.buyer?.full_name || 'Anonymous'}
                    </span>
                    <span className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-gray-400">{relativeTime(review.created_at)}</span>
                  </div>
                  {review.review && (
                    <p className="text-sm text-gray-600 mt-1">"{review.review}"</p>
                  )}
                  {review.listing && (
                    <p className="text-xs text-gray-400 mt-1">
                      on <span className="text-purple-600">{review.listing.title}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
