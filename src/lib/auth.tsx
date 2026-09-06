import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export type Role =
  | 'super_admin' | 'admin' | 'moderator'
  | 'full_stack_developer' | 'backend_developer' | 'frontend_developer'
  | 'graphics_video_editor' | 'marketing_specialist' | 'hr' | 'employee';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  full_stack_developer: 'Full-Stack Developer',
  backend_developer: 'Backend Developer',
  frontend_developer: 'Frontend Developer',
  graphics_video_editor: 'Graphics & Video Editor',
  marketing_specialist: 'Marketing Specialist',
  hr: 'HR',
  employee: 'Employee',
};

export type Organization = {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  organization: Organization | null;
};

const ADMIN_EMAILS = ['ahmedforkan26@gmail.com', 'forkanahmmod@gmail.com', 'admin@sysmobyte.com'];

function getAuthErrorMessage(message: string): string {
  if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
    return 'Cannot connect to the account server. Please check your internet connection, then try again.';
  }
  return message;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  offlineAccess: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string, userEmail: string | undefined): Promise<UserProfile> {
  if (!supabase) {
    return { id: userId, email: userEmail || '', fullName: 'Guest', avatarUrl: null, role: 'employee', organization: null };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, cover_url, role, organization_id, organizations(id, name, subdomain, status)')
    .eq('id', userId)
    .maybeSingle();

  const meta = (await supabase.auth.getUser()).data.user?.user_metadata || {};
  const orgData = (profile as Record<string, unknown> | null)?.organizations as Organization | null | undefined;

  return {
    id: userId,
    email: profile?.email || userEmail || '',
    fullName: profile?.full_name || meta.full_name || meta.name || (userEmail ? userEmail.split('@')[0] : 'User'),
    avatarUrl: profile?.avatar_url || meta.avatar_url || meta.picture || null,
    role: (profile?.role as Role) || (userEmail && isAdminEmail(userEmail) ? 'super_admin' : 'employee'),
    organization: orgData || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [offlineAccess, setOfflineAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const p = await loadProfile(user.id, user.email);
    setProfile(p);
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          const p = await loadProfile(newSession.user.id, newSession.user.email);
          setProfile(p);
        } else {
          setProfile(null);
        }
        if (!settled) { settled = true; setLoading(false); }
      })();
    });

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.session.user);
        const p = await loadProfile(data.session.user.id, data.session.user.email);
        setProfile(p);
      }
      if (!settled) { settled = true; setLoading(false); }
    })();

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: 'The workspace connection is not configured.' };
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) return { error: getAuthErrorMessage(signInError.message) };
      if (data.user) {
        const p = await loadProfile(data.user.id, data.user.email);
        setProfile(p);
      }
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the workspace service.';
      return { error: getAuthErrorMessage(message) };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: 'The workspace connection is not configured.' };
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: normalizedEmail.split('@')[0] } },
      });
      if (signUpError) return { error: getAuthErrorMessage(signUpError.message) };
      if (data.user) {
        const p = await loadProfile(data.user.id, data.user.email);
        setProfile(p);
      }
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the workspace service.';
      return { error: getAuthErrorMessage(message) };
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setOfflineAccess(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signInWithEmail, signUpWithEmail, signInWithGoogle, offlineAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
