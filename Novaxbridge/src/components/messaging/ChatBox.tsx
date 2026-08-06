import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Loader2, Send, ArrowLeft, Paperclip, X, FileText, ImageIcon } from 'lucide-react';
import VideoCallWidget from './VideoCallWidget';
import { sendMessage, getMessages, Message, MessageAttachment, uploadChatAttachment, getChatAttachmentUrl, getChatBubbleStyle, DEFAULT_BUBBLE_STYLE, type ChatBubbleStyle } from '@/lib/marketplace';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ChatBoxProps {
  conversationId: string;
  otherUserId?: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  onBack?: () => void;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'application/zip',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface PendingFile {
  file: File;
  uploading: boolean;
  preview?: string;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(mime: string): boolean {
  return mime.startsWith('image/');
}

function AttachmentPreview({ file, onRemove, uploading }: { file: PendingFile; onRemove: () => void; uploading: boolean }) {
  const isImage = isImageType(file.file.type);
  return (
    <div className="relative group inline-flex items-center gap-2 bg-muted rounded-lg p-2 pr-3 text-xs">
      {uploading && (
        <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 animate-spin text-secondary" />
        </div>
      )}
      {isImage && file.preview ? (
        <img src={file.preview} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
      ) : (
        <FileText className="w-5 h-5 text-secondary shrink-0" />
      )}
      <span className="max-w-[120px] truncate">{file.file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full hover:bg-muted-foreground/20 p-0.5"
        disabled={uploading}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function AttachmentBubble({ attachment }: { attachment: MessageAttachment }) {
  const url = getChatAttachmentUrl(attachment.storage_path);
  const isImage = isImageType(attachment.mime_type);

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        <img
          src={url}
          alt={attachment.file_name}
          className="max-w-[280px] max-h-[200px] rounded-lg object-cover border border-border/50"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 transition-colors"
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="text-xs truncate flex-1">{attachment.file_name}</span>
      <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(attachment.file_size)}</span>
    </a>
  );
}

export default function ChatBox({ conversationId, otherUserId, otherUserName, otherUserAvatar, onBack }: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [bubbleStyle, setBubbleStyle] = useState<ChatBubbleStyle>(DEFAULT_BUBBLE_STYLE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    getChatBubbleStyle().then(setBubbleStyle).catch(() => {});
  }, []);

  useEffect(() => {
    // Use a unique topic suffix to prevent supabase.channel() from returning
    // an already-subscribed channel during React 19 Strict Mode double-invocation
    const uid = crypto.randomUUID();
    const channel = supabase
      .channel(`messages:${conversationId}:${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const pf of pendingFiles) {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      }
    };
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 10 MB limit`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      const preview = isImageType(file.type) ? URL.createObjectURL(file) : undefined;
      newFiles.push({ file, uploading: false, preview });
    }

    setPendingFiles((prev) => [...prev, ...newFiles]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const pf = prev[index];
      if (pf?.preview) URL.revokeObjectURL(pf.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && pendingFiles.length === 0) return;

    setSending(true);

    try {
      // Upload files first
      let attachmentMetas: Array<{ storage_path: string; file_name: string; file_size: number; mime_type: string }> = [];
      if (pendingFiles.length > 0 && user) {
        setPendingFiles((prev) => prev.map((pf) => ({ ...pf, uploading: true })));
        const uploads = pendingFiles.map(async (pf) => {
          const meta = await uploadChatAttachment(pf.file, user.id);
          return meta;
        });
        attachmentMetas = await Promise.all(uploads);
      }

      // Send message with attachment metadata
      await sendMessage(conversationId, text, attachmentMetas.length > 0 ? attachmentMetas : undefined);
      setInput('');

      // Cleanup pending files
      for (const pf of pendingFiles) {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      }
      setPendingFiles([]);
    } catch (error) {
      setPendingFiles((prev) => prev.map((pf) => ({ ...pf, uploading: false })));
      const message = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="w-8 h-8">
          <AvatarImage src={otherUserAvatar || undefined} />
          <AvatarFallback>{(otherUserName || '?').charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-semibold text-sm truncate flex-1">{otherUserName}</span>
        <VideoCallWidget conversationId={conversationId} otherUserId={otherUserId} otherUserName={otherUserName} userName={user?.user_metadata?.full_name || user?.email || 'User'} compact />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-secondary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const hasText = msg.content && msg.content.trim().length > 0;
            const attachments = msg.message_attachments;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    isMine ? 'rounded-br-md' : 'rounded-bl-md'
                  } ${!hasText && attachments && attachments.length > 0 ? 'py-2' : ''}`}
                  style={{
                    backgroundColor: isMine ? bubbleStyle.my_bubble_bg : bubbleStyle.other_bubble_bg,
                    color: isMine ? bubbleStyle.my_bubble_text : bubbleStyle.other_bubble_text,
                  }}
                >
                  {hasText && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                  {attachments && attachments.length > 0 && (
                    <div className={hasText ? 'mt-1.5 space-y-1' : 'space-y-1'}>
                      {attachments.map((att) => (
                        <AttachmentBubble key={att.id} attachment={att} />
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 opacity-70`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t shrink-0 space-y-2">
        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((pf, i) => (
              <AttachmentPreview
                key={`${pf.file.name}-${i}`}
                file={pf}
                onRemove={() => removePendingFile(i)}
                uploading={pf.uploading}
              />
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <div className="flex items-center gap-1 flex-1 bg-background border rounded-lg px-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border-0 focus-visible:ring-0 px-0"
              disabled={sending}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </div>
          <Button type="submit" size="icon" disabled={sending || (!input.trim() && pendingFiles.length === 0)}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
