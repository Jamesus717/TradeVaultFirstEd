'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

// Password reset emails land here via /auth/callback?type=recovery, which has
// already exchanged the code for a session. A link that comes straight here
// with ?code= is exchanged on arrival instead.
export default function ResetPasswordPage() {
  const { user, authLoading } = useAuth();
  const [exchanging, setExchanging] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    const exchange =
      code && supabase
        ? supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
            if (exchangeError) {
              setError('This reset link has expired or was already used. Request a new one.');
            }
            window.history.replaceState(null, '', '/reset-password');
          })
        : Promise.resolve();

    exchange.then(() => setExchanging(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || saving) {
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
  }

  const loading = authLoading || exchanging;

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <h1 className="mb-2 text-2xl font-semibold text-white">Set a new password</h1>

          {loading ? (
            <p className="text-sm text-stone-400">Checking your reset link…</p>
          ) : done ? (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">Your password has been updated.</p>
              <Link
                href="/"
                className="inline-block rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300"
              >
                Continue
              </Link>
            </div>
          ) : !user ? (
            <p className="text-sm text-stone-400">
              {error || 'This reset link has expired or was already used. Request a new one from the sign-in screen.'}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
              />

              {error ? (
                <div className="rounded-[1.5rem] border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving || !password || !confirmPassword}
                className="w-full rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
