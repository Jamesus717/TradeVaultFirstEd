'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from '../app/auth';

export type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_slug: string;
  created_at?: string;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = useMemo(() => Boolean(user && supabase), [user]);

  useEffect(() => {
    if (!enabled) {
      const timer = setTimeout(() => {
        setProfile(null);
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let active = true;
    const loadingTimer = setTimeout(() => {
      if (active) {
        setLoading(true);
      }
    }, 0);

    supabase!
      .from('public_profiles')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setProfile(null);
        } else {
          setError(null);
          setProfile((data ?? null) as Profile | null);
        }
        setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(loadingTimer);
    };
  }, [enabled, user]);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'bio'>>) => {
      if (!user || !supabase) {
        return { error: 'Not authenticated' };
      }

      setSaving(true);
      setError(null);

      const payload: Record<string, unknown> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (updates.username) {
        payload.profile_slug = updates.username.toLowerCase().trim();
      }

      const { data, error: err } = await supabase
        .from('public_profiles')
        .update(payload)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (err) {
        setSaving(false);
        if (err.code === '23505') {
          setError('Username already taken');
          return { error: 'Username already taken' };
        }
        setError(err.message);
        return { error: err.message };
      }

      setProfile(data as Profile);
      setSaving(false);
      return { error: null };
    },
    [user]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!user || !supabase) {
        return { error: 'Not authenticated' };
      }

      setSaving(true);
      setError(null);

      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
      });

      if (uploadError) {
        setSaving(false);
        setError(uploadError.message);
        return { error: uploadError.message };
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return updateProfile({ avatar_url: data.publicUrl });
    },
    [updateProfile, user]
  );

  return {
    profile,
    loading,
    saving,
    error,
    updateProfile,
    uploadAvatar,
  };
}
