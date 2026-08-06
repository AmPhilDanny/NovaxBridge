import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { callAIAssist, AIMode } from '@/lib/ai';

interface AIAssistButtonProps {
  mode: AIMode;
  label: string;
  /** Builds the payload sent to the AI at the moment the button is clicked */
  buildPayload: () => Record<string, unknown>;
  /** Called with the AI's suggested text when the user accepts it */
  onAccept: (result: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

/**
 * A small "Draft with AI" button that opens an inline suggestion box.
 * The suggestion is always editable and requires an explicit "Use this"
 * click before it touches the real form — AI drafts, the human decides.
 */
export function AIAssistButton({
  mode,
  label,
  buildPayload,
  onAccept,
  disabled,
  size = 'sm',
}: AIAssistButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const result = await callAIAssist({ mode, ...buildPayload() } as never);
      if (!result) {
        toast.error('AI returned an empty response. Try again.');
      } else {
        setSuggestion(result);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleGenerate}
        disabled={disabled || isLoading}
        className="gap-2"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-secondary" />}
        {isLoading ? 'Drafting...' : label}
      </Button>

      {suggestion !== null && (
        <div className="rounded-lg border border-dashed border-secondary/50 bg-secondary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-secondary">
            <Sparkles className="w-3 h-3" />
            AI draft — edit freely before using it
          </div>
          <Textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            className="min-h-[100px] text-sm bg-background"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAccept(suggestion);
                setSuggestion(null);
                toast.success('Applied AI draft — feel free to keep editing.');
              }}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Use this
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
