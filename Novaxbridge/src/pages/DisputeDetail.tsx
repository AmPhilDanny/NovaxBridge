import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, ArrowLeft, Send, AlertCircle, CheckCircle2, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDispute,
  getDisputeMessages,
  sendDisputeMessage,
  DISPUTE_STATUS_CONFIG,
  type Dispute,
  type DisputeMessage,
} from '@/lib/marketplace';

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    loadDispute();
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDispute = async () => {
    setLoading(true);
    try {
      const [d, msgs] = await Promise.all([
        getDispute(id!),
        getDisputeMessages(id!),
      ]);
      setDispute(d);
      setMessages(msgs);
    } catch (error) {
      toast.error('Failed to load dispute');
      navigate('/disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !id) return;
    setSending(true);
    try {
      const msg = await sendDisputeMessage(id, newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      // Reload dispute to get updated status
      getDispute(id).then(setDispute).catch(() => {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!dispute) return null;

  const statusCfg = DISPUTE_STATUS_CONFIG[dispute.status] || { label: dispute.status, color: '' };
  const isOpen = dispute.status === 'open' || dispute.status === 'under_review';
  const isResolved = dispute.status === 'resolved' || dispute.status === 'dismissed';
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <button
          onClick={() => navigate('/disputes')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to disputes
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Dispute header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={statusCfg.color} variant="secondary">
                    {statusCfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Raised {new Date(dispute.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-primary mb-2">{dispute.reason}</h1>
                {dispute.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{dispute.description}</p>
                )}
                {dispute.order && (
                  <div className="mt-3 text-sm">
                    <span className="text-muted-foreground">Order: </span>
                    <button
                      onClick={() => navigate(`/orders/${dispute.order_id}`)}
                      className="text-secondary hover:underline font-medium"
                    >
                      {dispute.order.title || `#${dispute.order_id.slice(0, 8)}`}
                    </button>
                    <span className="text-muted-foreground ml-2">
                      — ₦{Number(dispute.order.amount).toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resolution */}
            {isResolved && dispute.resolution && (
              <Card className={dispute.status === 'resolved' ? 'border-green-500/30' : 'border-muted'}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {dispute.status === 'resolved' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                    Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{dispute.resolution}</p>
                  {dispute.resolved_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Resolved {new Date(dispute.resolved_at).toLocaleDateString()}
                      {dispute.resolved_by_profile?.full_name && ` by ${dispute.resolved_by_profile.full_name}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Comments / Messages */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No messages yet. {isOpen ? 'An admin will review your dispute shortly.' : ''}
                  </p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.is_admin_message ? '' : 'flex-row-reverse'}`}
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={msg.sender?.avatar_url || undefined} />
                          <AvatarFallback className={msg.is_admin_message ? 'bg-secondary text-secondary-foreground text-xs' : 'text-xs'}>
                            {msg.is_admin_message ? 'A' : (msg.sender?.full_name || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[75%] ${msg.is_admin_message ? '' : 'items-end'}`}>
                          <div
                            className={`rounded-lg px-3 py-2 text-sm ${
                              msg.is_admin_message
                                ? 'bg-secondary/10 text-foreground'
                                : 'bg-primary/10 text-foreground'
                            }`}
                          >
                            <p className="text-xs text-muted-foreground mb-0.5">
                              {msg.is_admin_message ? 'Admin' : (msg.sender?.full_name || 'You')}
                            </p>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            {new Date(msg.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                <Separator className="my-4" />

                {/* Message input */}
                {isOpen ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isAdmin ? 'Reply as admin...' : 'Add details for the admin...'}
                      className="min-h-[44px] max-h-[120px] text-sm"
                      rows={1}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={sending || !newMessage.trim()}
                      size="icon"
                      className="shrink-0 self-end"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    This dispute is {dispute.status}. No further messages can be sent.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="sticky top-28">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <Badge className={`${statusCfg.color} text-sm px-3 py-1`} variant="secondary">
                    {statusCfg.label}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Raised by</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={dispute.raised_by_profile?.avatar_url || undefined} />
                        <AvatarFallback>{(dispute.raised_by_profile?.full_name || '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{dispute.raised_by_profile?.full_name || '—'}</span>
                    </div>
                  </div>

                  {dispute.order && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Order amount</p>
                      <p className="font-semibold text-secondary">
                        ₦{Number(dispute.order.amount).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Created</p>
                    <p className="text-foreground">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {dispute.resolved_at && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                      <p className="text-foreground">
                        {new Date(dispute.resolved_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <Button
                  className="w-full gap-1.5"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/orders/${dispute.order_id}`)}
                >
                  View order
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
