/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { User, Session } from '@supabase/supabase-js';
import { setTokenProvider } from '@/lib/api-client';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let cachedProfile: Profile | null = null;

// Module scope: must be ready before the first component effect fires, or the
// first API call after a full-page redirect (GitHub OAuth callback) sends no
// Authorization header and gets 401.
setTokenProvider(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  // Forces supabase to refresh the token if expired.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return session.access_token;
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  useEffect(() => {
    // Set token provider for API client
    setTokenProvider(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    });

    // Check URL hash for cross-domain session transfer (e.g. from admin panel)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data: { session } }) => {
          if (session) {
            setSession(session);
            fetchProfile(session.user.id);
          } else {
            setFetchedOnce(true);
          }
        });
        // Clean the URL hash so tokens aren't visible after use
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      } else {
        setFetchedOnce(true);
      }
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else setFetchedOnce(true);
      });
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        cachedProfile = null;
        setProfile(null);
        setFetchedOnce(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      cachedProfile = data;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setFetchedOnce(true);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    cachedProfile = null;
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
