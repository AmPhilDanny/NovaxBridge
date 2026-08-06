import { useEffect, useRef, useState, useCallback } from 'react';

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

interface JitsiParticipant {
  peerId: string;
  displayName: string;
}

interface UseJitsiRoomOptions {
  jwt?: string | null;
  domain?: string;
  roomPrefix?: string;
  scriptSrc?: string;
}

interface UseJitsiRoomReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  connectionState: ConnectionState;
  participants: JitsiParticipant[];
  toggleMic: () => void;
  toggleCamera: () => void;
  endCall: () => void;
  screenShare: () => void;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

const DEFAULT_DOMAIN = 'meet.jit.si';

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: Record<string, unknown>) => {
      executeCommand: (command: string, ...args: unknown[]) => void;
      addListener: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
      dispose: () => void;
      isAudioMuted: () => boolean;
      isVideoMuted: () => boolean;
    };
  }
}

function loadJitsiScript(domain: string, scriptSrc?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = scriptSrc || `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi script'));
    document.head.appendChild(script);
  });
}

export function useJitsiRoom(
  roomId: string,
  displayName: string,
  options?: UseJitsiRoomOptions,
): UseJitsiRoomReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<ReturnType<Window['JitsiMeetExternalAPI']> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('new');
  const [participants, setParticipants] = useState<JitsiParticipant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const { jwt, domain = DEFAULT_DOMAIN, roomPrefix, scriptSrc } = options || {};

  useEffect(() => {
    if (!roomId || !displayName || !containerRef.current) return;

    let disposed = false;

    async function initJitsi() {
      try {
        setConnectionState('connecting');
        await loadJitsiScript(domain, scriptSrc);
        if (disposed) return;

        const qualifiedRoom = roomPrefix ? `${roomPrefix}/${roomId}` : roomId;

        const apiOptions: Record<string, unknown> = {
          roomName: qualifiedRoom,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName,
          },
          configOverwrite: {
            toolbarButtons: [],
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            disableReactions: true,
            doNotStoreRoom: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableCalendarIntegration: false,
            disableRemoteMute: true,
            enableTalkWhileMuted: false,
            enableNoAudioDetection: true,
            enableNoisyMicDetection: true,
            hideConferenceSubject: true,
            enableClosePage: false,
            disableInviteFunctions: true,
            disableProfile: true,
          },
          interfaceConfigOverwrite: {
            HIDE_DEEP_LINKING_LOGO: true,
            SHOW_CHROME_EXTENSION_BANNER: false,
            TOOLBAR_ALWAYS_VISIBLE: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            GENERATE_ROOMNAMES_ON_WILD_CARDS: false,
            DISPLAY_WELCOME_PAGE_CONTENT: false,
            DISPLAY_WELCOME_FOOTER: false,
            FILM_STRIP_MAX_HEIGHT: 0,
            DISABLE_PRESENCE_STATUS: true,
            DISABLE_TRANSCRIPTION_SUBTITLES: true,
            SETTINGS_SECTIONS: [],
          },
        };

        if (jwt) {
          apiOptions.jwt = jwt;
        }

        const api = new window.JitsiMeetExternalAPI(domain, apiOptions);

        if (disposed) {
          api.dispose();
          return;
        }

        apiRef.current = api;

        api.addListener('videoConferenceJoined', () => {
          if (!disposed) setConnectionState('connected');
        });

        api.addListener('participantJoined', ({ id, displayName: name }: { id: string; displayName?: string }) => {
          if (!disposed) {
            setParticipants((prev) => {
              if (prev.some((p) => p.peerId === id)) return prev;
              return [...prev, { peerId: id, displayName: name || id }];
            });
          }
        });

        api.addListener('participantLeft', ({ id }: { id: string }) => {
          if (!disposed) {
            setParticipants((prev) => prev.filter((p) => p.peerId !== id));
          }
        });

        api.addListener('audioMuteStatusChanged', ({ muted }: { muted: boolean }) => {
          if (!disposed) setIsMicOn(!muted);
        });

        api.addListener('videoMuteStatusChanged', ({ muted }: { muted: boolean }) => {
          if (!disposed) setIsCameraOn(!muted);
        });

        api.addListener('screenShareStatusChanged', ({ on }: { on: boolean }) => {
          if (!disposed) setIsScreenSharing(on);
        });

        api.addListener('readyToClose', () => {
          if (!disposed) setConnectionState('closed');
        });

        api.addListener('connectionFailed', () => {
          if (!disposed) setConnectionState('failed');
        });
      } catch (err) {
        console.error('Failed to initialize Jitsi:', err);
        if (!disposed) setConnectionState('failed');
      }
    }

    // Small delay to ensure container is mounted
    const timer = setTimeout(initJitsi, 0);

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch { /* ignore */ }
        apiRef.current = null;
      }
      setParticipants([]);
      setConnectionState('closed');
    };
  }, [roomId, displayName, jwt, domain, roomPrefix, scriptSrc]);

  const toggleMic = useCallback(() => {
    apiRef.current?.executeCommand('toggleAudio');
  }, []);

  const toggleCamera = useCallback(() => {
    apiRef.current?.executeCommand('toggleVideo');
  }, []);

  const endCall = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
      apiRef.current.dispose();
      apiRef.current = null;
    }
    setParticipants([]);
    setConnectionState('closed');
  }, []);

  const screenShare = useCallback(() => {
    apiRef.current?.executeCommand('toggleShareScreen');
  }, []);

  return {
    containerRef,
    connectionState,
    participants,
    toggleMic,
    toggleCamera,
    endCall,
    screenShare,
    isMicOn,
    isCameraOn,
    isScreenSharing,
  };
}
