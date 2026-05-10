'use client';

import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

type AuthContextValue = {
  user: User | null;
  authLoading: boolean;
  supabaseDisabled: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseDisabled = !supabase;
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(!supabaseDisabled);

  useEffect(() => {
    if (supabaseDisabled || !supabase) {
      return;
    }

    const client = supabase;
    let mounted = true;
    const loadingFallback = window.setTimeout(() => {
      if (mounted) {
        setAuthLoading(false);
      }
    }, 3000);

    async function loadUser() {
      const { data, error } = await client.auth.getUser();

      if (!mounted) {
        return;
      }

      if (error) {
        setUser(null);
      } else {
        setUser(data.user);
      }

      setAuthLoading(false);
      window.clearTimeout(loadingFallback);
    }

    loadUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, [supabaseDisabled]);

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(email: string, password: string) {
      if (!supabase) {
        return 'Supabase environment variables are missing.';
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    }

    async function signUp(email: string, password: string) {
      if (!supabase) {
        return 'Supabase environment variables are missing.';
      }

      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      return error ? error.message : null;
    }

    async function signOut() {
      if (!supabase) {
        return null;
      }

      const { error } = await supabase.auth.signOut();
      return error ? error.message : null;
    }

    return {
      user,
      authLoading,
      supabaseDisabled,
      signIn,
      signUp,
      signOut,
    };
  }, [authLoading, supabaseDisabled, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

