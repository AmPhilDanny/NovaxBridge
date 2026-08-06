import { useRef, useEffect } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  displayName: string;
}

export function VideoPlayer({ stream, muted = false, mirrored = false, displayName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-video">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="w-20 h-20 rounded-full bg-muted-foreground/20 flex items-center justify-center">
            <span className="text-3xl font-semibold text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-sm font-medium text-white truncate">{displayName}</span>
      </div>
    </div>
  );
}
