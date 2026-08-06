import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShoppingBag, Package, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  getOrders,
  updateOrderStatus,
  Order,
} from '@/lib/marketplace';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-500/15 text-green-700 dark:text-green-400',
  disputed: 'bg-red-500/15 text-red-700 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-purple-500/15 text-purple-700',
};

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<'buyer' | 'provider'>('buyer');
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});
  const [reviewMap, setReviewMap] = useState<Record<string, string>>({});
  const [submittingOrder, setSubmittingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user, role, statusFilter]);

  const fetchOrders = async () => {
    try {
      const data = await getOrders({ role, status: statusFilter || undefined });
      setOrders(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (orderId: string, status: string) => {
    setSubmittingOrder(orderId);
    try {
      const extra: { rating?: number; review?: string } = {};
      if (status === 'completed') {
        if (ratingMap[orderId]) extra.rating = ratingMap[orderId];
        if (reviewMap[orderId]) extra.review = reviewMap[orderId];
      }
      await updateOrderStatus(orderId, status, extra);
      toast.success(`Order ${status.replace('_', ' ')}`);
      fetchOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setSubmittingOrder(null);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
          <Package className="w-7 h-7 text-secondary" />
          My Orders
        </h1>
        <p className="text-muted-foreground mb-8">Track and manage your orders.</p>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Tabs value={role} onValueChange={(v) => setRole(v as 'buyer' | 'provider')} className="flex-1">
            <TabsList>
              <TabsTrigger value="buyer">Orders I placed</TabsTrigger>
              <TabsTrigger value="provider">Orders I received</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orders.length === 0 && isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-6">
              {role === 'buyer' ? 'Browse the marketplace to place your first order.' : 'Wait for someone to hire you.'}
            </p>
            <Button asChild>
              <Link to="/marketplace">Browse marketplace</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={STATUS_STYLES[order.status] || ''} variant="secondary">
                          {order.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium truncate">
                        {order.listing?.title || 'Service order'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>
                          {role === 'buyer'
                            ? `Provider: ${order.provider?.full_name || '—'}`
                            : `Buyer: ${order.buyer?.full_name || '—'}`}
                        </span>
                        <span className="font-medium text-foreground">
                          ₦{Number(order.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {role === 'provider' && order.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={() => handleAction(order.id, 'in_progress')} disabled={submittingOrder === order.id}>
                        {submittingOrder === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Accept
                      </Button>
                    </div>
                  )}

                  {role === 'buyer' && order.status === 'in_progress' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAction(order.id, 'completed')} disabled={submittingOrder === order.id}>
                          {submittingOrder === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Mark Complete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAction(order.id, 'disputed')} disabled={submittingOrder === order.id}>
                          Dispute
                        </Button>
                      </div>
                    </div>
                  )}

                  {role === 'buyer' && order.status === 'pending' && (
                    <div className="mt-4">
                      <Button size="sm" variant="outline" onClick={() => handleAction(order.id, 'cancelled')} disabled={submittingOrder === order.id}>
                        Cancel
                      </Button>
                    </div>
                  )}

                  {order.status === 'completed' && order.rating && (
                    <div className="mt-3 flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{order.rating}/5</span>
                      {order.review && <span className="text-muted-foreground ml-2">"{order.review}"</span>}
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t border-border">
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-xs text-secondary hover:underline font-medium"
                    >
                      View details →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
