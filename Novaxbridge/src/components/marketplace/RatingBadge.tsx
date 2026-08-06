import { Star, StarHalf } from 'lucide-react';

interface RatingBadgeProps {
  average: number;
  count: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function RatingBadge({ average, count, size = 'sm' }: RatingBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1',
  };
  const starSize = { sm: 12, md: 14, lg: 18 };

  const fullStars = Math.floor(average);
  const hasHalf = average - fullStars >= 0.25;

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]} text-amber-500`} title={`${average} out of 5 stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} size={starSize[size]} className="fill-amber-400 text-amber-400" />
      ))}
      {hasHalf && <StarHalf key="half" size={starSize[size]} className="fill-amber-400 text-amber-400" />}
      <span className="font-medium text-gray-700 ml-0.5">{average.toFixed(1)}</span>
      <span className="text-gray-400 ml-0.5">({count})</span>
    </span>
  );
}
