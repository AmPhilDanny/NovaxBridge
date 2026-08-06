import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useCall } from "@/hooks/useCall";

/** Synthesize a looping phone ring using the Web Audio API — no audio files needed */
function useRingTone(active: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active) {
      stopRef.current?.();
      stopRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      return;
    }

    let running = true;

    async function startRing() {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // One ring cycle: two short beeps followed by silence
      async function playOneCycle() {
        if (!running) return;

        for (let i = 0; i < 2; i++) {
          if (!running) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.value = i === 0 ? 480 : 440;
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
          await new Promise<void>((r) => setTimeout(r, 350));
        }
        // silence between rings
        await new Promise<void>((r) => setTimeout(r, 1500));

        if (running) playOneCycle();
      }

      playOneCycle();

      stopRef.current = () => {
        running = false;
        ctx.close().catch(() => {});
      };
    }

    startRing();

    return () => {
      running = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [active]);
}

export default function IncomingCallDialog() {
  const { callState, callDirection, callPeer, acceptCall, rejectCall } = useCall();
  const isRinging = callState === "ringing" && callDirection === "incoming" && !!callPeer;

  useRingTone(isRinging);

  if (!isRinging || !callPeer) return null;

  const initials = callPeer.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-sm mx-4 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl border-border/60">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
          {/* Pulsing ring animation around avatar */}
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-28 w-28 rounded-full bg-green-500/20 animate-ping" />
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-green-500/10 animate-pulse" />
            <Avatar className="h-20 w-20 ring-4 ring-green-500/60 relative z-10">
              <AvatarImage src={callPeer.avatar_url} alt={callPeer.displayName} />
              <AvatarFallback className="text-2xl bg-primary/10">{initials}</AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">{callPeer.displayName}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center mt-1">
              <Phone className="h-3.5 w-3.5 text-green-500 animate-bounce" />
              Incoming Video Call
            </p>
          </div>

          <div className="flex gap-6 mt-2">
            <div className="flex flex-col items-center gap-1.5">
              <Button
                variant="destructive"
                size="lg"
                className="h-14 w-14 rounded-full"
                onClick={rejectCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <span className="text-xs text-muted-foreground">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Button
                size="lg"
                className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
                onClick={acceptCall}
              >
                <Video className="h-6 w-6" />
              </Button>
              <span className="text-xs text-muted-foreground">Accept</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
