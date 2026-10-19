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
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  resendVerification: (email: string) => Promise<string | null>;
  signUpWithUsername: (email: string, password: string, username: string) => Promise<string | null>;
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

    async function signInWithGoogle() {
      if (!supabase) return 'Supabase not configured';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
        },
      });
      return error ? error.message : null;
    }

    async function resetPassword(email: string) {
      if (!supabase) return 'Supabase not configured';
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?type=recovery`
            : undefined,
        }
      );
      return error ? error.message : null;
    }

    async function resendVerification(email: string) {
      if (!supabase) return 'Supabase not configured';
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      return error ? error.message : null;
    }

    async function signUpWithUsername(
      email: string,
      password: string,
      username: string
    ) {
      if (!supabase) return 'Supabase not configured';

      const desired = username.toLowerCase().trim();

      // Check first: once auth.signUp succeeds the account exists, so a taken
      // name has to be caught before it.
      const { data: existing } = await supabase
        .from('public_profiles')
        .select('user_id')
        .eq('username', desired)
        .maybeSingle();
      if (existing) return 'USERNAME_TAKEN';

      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

      // The username travels as user metadata and the new-user trigger
      // (migration 017) creates the profile with it. Updating the profile from
      // here did not work: with email confirmation on there is no session yet,
      // so RLS silently matched zero rows and everyone kept `user_xxxxxxxx`.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: { username: desired, display_name: username.trim() },
        },
      });

      if (error) return error.message;
      if (!data.user) return 'Sign up failed';

      return null;
    }

    return {
      user,
      authLoading,
      supabaseDisabled,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      resetPassword,
      resendVerification,
      signUpWithUsername,
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

