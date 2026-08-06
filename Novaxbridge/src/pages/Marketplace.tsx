import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Store, Search, Clock, Zap, ArrowRight, Star, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { getListings, getServices, getListingRating, getProviderStats, formatPrice, MarketplaceListing, Service, ListingRating, ProviderStats } from '@/lib/marketplace';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'typing', label: 'Typing & Transcription' },
  { value: 'research', label: 'Research' },
  { value: 'design', label: 'Design' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'writing', label: 'Writing' },
  { value: 'development', label: 'Development' },
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'virtual_assistance', label: 'Virtual Assistance' },
  { value: 'academic', label: 'Academic Support' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low to high' },
  { value: 'price_desc', label: 'Price: High to low' },
];

const ITEMS_PER_PAGE = 12;

export default function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search value for backend
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [ratings, setRatings] = useState<Record<string, ListingRating>>({});
  const [providerStats, setProviderStatsMap] = useState<Record<string, ProviderStats>>({});

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, sort, minPrice, maxPrice, debouncedSearch]);

  const fetchData = useCallback(async () => {
    try {
      const [listingsResult, servicesData] = await Promise.all([
        getListings({
          status: 'active',
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          search: debouncedSearch || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          sort: sort as 'newest' | 'price_asc' | 'price_desc',
          page,
          limit: ITEMS_PER_PAGE,
        }),
        getServices(),
      ]);
      setListings(listingsResult.listings);
      setTotalCount(listingsResult.count);
      setServices(servicesData);

      // Fetch ratings for all listings in parallel
      const ratingResults = await Promise.allSettled(
        listingsResult.listings.map((l) => getListingRating(l.id))
      );
      const newRatings: Record<string, ListingRating> = {};
      listingsResult.listings.forEach((l, i) => {
        if (ratingResults[i].status === 'fulfilled') {
          newRatings[l.id] = ratingResults[i].value;
        }
      });
      setRatings(newRatings);

      // Fetch provider stats for all unique providers
      const providerIds = [...new Set(listingsResult.listings.map((l) => l.provider_id).filter(Boolean))];
      const statsMap: Record<string, ProviderStats> = {};
      await Promise.allSettled(
        providerIds.map(async (pid) => {
          statsMap[pid] = await getProviderStats(pid);
        })
      );
      setProviderStatsMap(statsMap);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error loading marketplace');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, debouncedSearch, minPrice, maxPrice, sort, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    setPage(1);
  };

  const hasActiveFilters = categoryFilter || minPrice || maxPrice || sort !== 'newest' || debouncedSearch;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2 flex items-center gap-3">
            <Store className="w-8 h-8 text-secondary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Hire skilled students for short-term tasks — typing, research, design, tutoring, and more.
            Quick, affordable, and vetted talent from across Africa.
          </p>
        </div>

        {/* Search row */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              title="Price filter"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Price filter collapse */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card border rounded-lg">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Min price</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Max price</label>
              <Input
                type="number"
                min={0}
                placeholder="Any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-28"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-3.5 h-3.5" />
                Clear all
              </Button>
            )}
          </div>
        )}

        {/* Results info */}
        {listings.length > 0 && (
          <p className="text-xs text-muted-foreground mb-4">
            {totalCount} listing{totalCount !== 1 ? 's' : ''} found
            {debouncedSearch && <span> for &quot;{debouncedSearch}&quot;</span>}
          </p>
        )}

        {/* Content */}
        {listings.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading marketplace...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No listings found</h3>
            <p className="text-muted-foreground mb-6">
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Be the first to offer a service on the marketplace.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="gap-1.5">
                <X className="w-4 h-4" />
                Clear filters
              </Button>
            )}
            {!hasActiveFilters && user && (
              <Button asChild>
                <Link to="/marketplace/new">Create a listing</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <Card key={listing.id} className="hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/marketplace/${listing.id}`}
                          className="font-semibold text-primary hover:underline line-clamp-1"
                        >
                          {listing.title}
                        </Link>
                        {listing.service && (
                          <Badge variant="secondary" className="mt-1.5 text-xs">
                            {listing.service.name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-lg font-bold text-secondary whitespace-nowrap">
                        {formatPrice(Number(listing.price))}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                      {listing.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {listing.duration_hours}h
                      </span>
                      {listing.provider && (
                        <span className="flex items-center gap-1 truncate">
                          <Zap className="w-3.5 h-3.5" />
                          {listing.provider.full_name || 'Student'}
                          {providerStats[listing.provider_id]?.total_orders > 0 && (
                            <span className="text-[10px] text-green-600 font-medium ml-0.5 shrink-0">
                              &middot; {providerStats[listing.provider_id].completion_rate}%
                            </span>
                          )}
                        </span>
                      )}
                      {ratings[listing.id]?.count > 0 && (
                        <span className="flex items-center gap-1 ml-auto text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          {ratings[listing.id].average}
                          <span className="text-muted-foreground">({ratings[listing.id].count})</span>
                        </span>
                      )}
                    </div>
                    <Button asChild size="sm" className="w-full gap-1.5 mt-2">
                      <Link to={`/marketplace/${listing.id}`}>
                        View details <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="sm"
                      className="w-9"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
