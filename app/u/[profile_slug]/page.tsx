'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import ProfileView from '../../profile/ProfileView';

type Props = {
  params: Promise<{ profile_slug: string }>;
};

export default function PublicProfilePage({ params }: Props) {
  const supabaseDisabled = !supabase;
  const [slug, setSlug] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setSlug(resolved.profile_slug);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    async function resolveSlug() {
      if (!slug) {
        return;
      }

      if (supabaseDisabled || !supabase) {
        setError('Supabase environment variables are missing.');
        return;
      }

      setError('');
      const { data, error: queryError } = await supabase
        .from('public_profiles')
        .select('user_id')
        .eq('profile_slug', slug)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
        return;
      }

      if (!data?.user_id) {
        setError('Profile not found.');
        return;
      }

      setUserId(String(data.user_id));
    }

    resolveSlug();
  }, [slug, supabaseDisabled]);

  if (error) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-12 text-center backdrop-blur">
            <div className="mb-6 text-5xl">🧭</div>
            <h1 className="mb-3 text-3xl font-semibold text-white">Profile</h1>
            <p className="text-sm leading-6 text-rose-100">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return <ProfileView userId={userId} />;
}

