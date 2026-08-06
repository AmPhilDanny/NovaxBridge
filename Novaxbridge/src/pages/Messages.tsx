import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ConversationList from '@/components/messaging/ConversationList';
import ChatBox from '@/components/messaging/ChatBox';
import NewMessageDialog from '@/components/messaging/NewMessageDialog';
import { createConversation, getConversations, Conversation } from '@/lib/marketplace';
import { Loader2, MessageSquare, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<{ id?: string; name: string; avatar: string | null } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);

  // If URL has userId, create/get conversation
  useEffect(() => {
    const userId = searchParams.get('userId');
    const orderId = searchParams.get('orderId');
    if (userId && user) {
      setCreating(true);
      createConversation(userId, orderId || undefined)
        .then((conv) => {
          setSelectedConv(conv);
          window.history.replaceState({}, '', '/messages');
        })
        .catch((err) => toast.error(err.message))
        .finally(() => setCreating(false));
    }
  }, [searchParams, user]);

  // Load profile info for selected conversation
  useEffect(() => {
    if (selectedConv?.other_profiles?.[0]) {
      const p = selectedConv.other_profiles[0];
      setOtherProfile({ id: p.id, name: p.full_name || 'Unknown', avatar: p.avatar_url });
    }
  }, [selectedConv]);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-secondary" />
            Messages
          </h1>
          <Button onClick={() => setNewMsgOpen(true)} className="gap-1.5">
            <PenSquare className="w-4 h-4" />
            New Message
          </Button>
        </div>

        {creating ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 border rounded-lg overflow-hidden min-h-[600px]">
            {/* Conversation list - sidebar */}
            <div className="md:col-span-1 border-r bg-card hidden md:block">
              <ConversationList
                onSelect={setSelectedConv}
                selectedId={selectedConv?.id}
              />
            </div>

            {/* Mobile: show list or chat */}
            <div className="md:hidden">
              {selectedConv ? (
                <ChatBox
                  conversationId={selectedConv.id}
                  otherUserId={otherProfile?.id}
                  otherUserName={otherProfile?.name || 'Unknown'}
                  otherUserAvatar={otherProfile?.avatar || null}
                  onBack={() => setSelectedConv(null)}
                />
              ) : (
                <ConversationList
                  onSelect={setSelectedConv}
                  selectedId={selectedConv?.id}
                />
              )}
            </div>

            {/* Desktop chat area */}
            <div className="md:col-span-2 hidden md:flex flex-col">
              {selectedConv ? (
                <ChatBox
                  conversationId={selectedConv.id}
                  otherUserId={otherProfile?.id}
                  otherUserName={otherProfile?.name || 'Unknown'}
                  otherUserAvatar={otherProfile?.avatar || null}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Select a conversation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onConversationCreated={(convId) => {
          const reloadAndSelect = async () => {
            try {
              const convs = await getConversations();
              const found = convs.find((c) => c.id === convId);
              if (found) setSelectedConv(found);
            } catch {}
          };
          reloadAndSelect();
        }}
      />
    </div>
  );
}
