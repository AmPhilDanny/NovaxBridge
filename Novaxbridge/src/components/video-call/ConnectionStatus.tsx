type ConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  displayName: string;
}

const stateConfig: Record<ConnectionState, { dot: string; label: string }> = {
  new: { dot: "bg-gray-500", label: "Connecting..." },
  connecting: { dot: "bg-yellow-400", label: "Connecting..." },
  connected: { dot: "bg-green-400", label: "Connected" },
  disconnected: { dot: "bg-yellow-400", label: "Reconnecting" },
  failed: { dot: "bg-red-400", label: "Failed" },
  closed: { dot: "bg-gray-400", label: "Closed" },
};

export function ConnectionStatus({ connectionState, displayName }: ConnectionStatusProps) {
  const config = stateConfig[connectionState];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="truncate max-w-[120px] text-foreground">{displayName}</span>
      <span className={`inline-block w-2 h-2 rounded-full ${config.dot}`} />
      <span className="text-muted-foreground text-xs">{config.label}</span>
    </div>
  );
}
