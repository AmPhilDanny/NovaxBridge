import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare } from 'lucide-react';
import { getConversations, Conversation } from '@/lib/marketplace';

interface ConversationListProps {
  onSelect: (conv: Conversation) => void;
  selectedId?: string;
}

export default function ConversationList({ onSelect, selectedId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const convs = await getConversations();
      setConversations(convs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-secondary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs">Start a conversation from an order or profile page.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => {
        const profile = conv.other_profiles?.[0];
        const initials = profile?.full_name
          ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
          : '?';

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 ${
              selectedId === conv.id ? 'bg-muted' : ''
            }`}
          >
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-sm truncate">
                  {profile?.full_name || 'Unknown'}
                </span>
                {conv.last_message && (
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(conv.last_message.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {conv.last_message?.content || 'No messages yet'}
              </p>
            </div>
            {conv.unread_count > 0 && (
              <Badge className="shrink-0 ml-1" variant="default">
                {conv.unread_count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
