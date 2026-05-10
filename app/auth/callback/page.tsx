'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type CallbackState =
  | { status: 'working'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type OtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change';

function isOtpType(value: string): value is OtpType {
  return (
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change'
  );
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>({
    status: 'working',
    message: 'Finishing sign-in…',
  });

  useEffect(() => {
    let active = true;

    async function run() {
      if (!supabase) {
        if (active) {
          setState({ status: 'error', message: 'Supabase is not configured for this app.' });
        }
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type');

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw new Error(error.message);
          }
        } else if (tokenHash && type) {
          if (!isOtpType(type)) {
            throw new Error('Invalid verification link.');
          }
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) {
            throw new Error(error.message);
          }
        }

        if (!active) {
          return;
        }

        setState({ status: 'success', message: 'Email verified. Redirecting…' });
        window.setTimeout(() => {
          router.replace('/');
        }, 700);
      } catch (cause) {
        if (!active) {
          return;
        }

        const message = cause instanceof Error ? cause.message : 'Verification failed.';
        setState({ status: 'error', message });
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <h1 className="text-2xl font-semibold text-white">Authentication</h1>
            <p className="mt-2 text-sm text-stone-300">{state.message}</p>
            <div
              className={classNames(
                'mt-5 inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em]',
                state.status === 'working'
                  ? 'border-white/10 bg-white/[0.03] text-stone-300'
                  : state.status === 'success'
                    ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
                    : 'border-rose-300/20 bg-rose-500/10 text-rose-200'
              )}
            >
              {state.status}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
