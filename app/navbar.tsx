'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './auth';

type AuthMode = 'login' | 'signup';
type AuthStage = 'form' | 'signup_done';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function isUnverifiedEmailError(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes('email not confirmed') ||
    value.includes('not confirmed') ||
    value.includes('confirm your email') ||
    value.includes('email confirmation') ||
    value.includes('user not confirmed')
  );
}

export default function Navbar() {
  const { user, authLoading, supabaseDisabled, signIn, signOut, signUp } = useAuth();
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authStage, setAuthStage] = useState<AuthStage>('form');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileHref, setProfileHref] = useState<string | null>(null);
  const [unreadState, setUnreadState] = useState<{ userId: string; count: number }>({
    userId: '',
    count: 0,
  });

  const inboxActive = pathname.startsWith('/inbox');

  useEffect(() => {
    async function loadProfileHref() {
      if (!user) {
        setProfileHref(null);
        return;
      }

      if (supabaseDisabled || !supabase) {
        setProfileHref(`/profile/${user.id}`);
        return;
      }

      const { data, error } = await supabase
        .from('public_profiles')
        .select('profile_slug')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data?.profile_slug) {
        setProfileHref(`/profile/${user.id}`);
        return;
      }

      setProfileHref(`/u/${data.profile_slug}`);
    }

    loadProfileHref();
  }, [supabaseDisabled, user]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function refreshCount() {
      if (!user || supabaseDisabled || !supabase) {
        return;
      }

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (active) {
        setUnreadState({ userId: user.id, count: count ?? 0 });
      }
    }

    function scheduleRefresh() {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(refreshCount, 250);
    }

    if (!user || supabaseDisabled || !supabase) {
      return () => {
        active = false;
      };
    }

    refreshCount();

    channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabaseDisabled, user]);

  const unreadCount = user && unreadState.userId === user.id ? unreadState.count : 0;
  const resolvedProfileHref = user ? (profileHref ?? `/profile/${user.id}`) : null;
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/u/');
  const unreadBadgeText = useMemo(() => {
    if (unreadCount <= 0) {
      return '';
    }
    return unreadCount > 9 ? '9+' : String(unreadCount);
  }, [unreadCount]);

  function openAuthModal(mode: AuthMode) {
    if (supabaseDisabled) {
      return;
    }
    setAuthMode(mode);
    setAuthStage('form');
    setAuthError('');
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
    setAuthError('');
    setPassword('');
    setAuthStage('form');
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setAuthError('');

    const action = authMode === 'signup' ? signUp : signIn;
    const error = await action(email, password);

    if (error) {
      if (authMode === 'login' && isUnverifiedEmailError(error)) {
        setAuthError(
          'Please verify your email before logging in. Check your inbox for the verification link.'
        );
      } else {
        setAuthError(error);
      }
      setSubmitting(false);
      return;
    }

    if (authMode === 'signup') {
      setAuthStage('signup_done');
      setPassword('');
      setSubmitting(false);
      return;
    }

    setAuthModalOpen(false);
    setEmail('');
    setPassword('');
    setSubmitting(false);
  }

  async function handleLogout() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setAuthError('');
    const error = await signOut();

    if (error) {
      setAuthError(error);
    }

    setSubmitting(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-stone-950/75 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            TradeBinder
          </Link>
        </div>

        <div className="hidden items-center gap-8 sm:flex">
          <Link
            href="/"
            className={`relative pb-1 text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Binder
            {pathname === '/' ? (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-emerald-400" />
            ) : null}
          </Link>
          <Link
            href="/trade"
            className={`relative pb-1 text-sm font-medium transition-colors ${
              pathname === '/trade'
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Trade Board
            {pathname === '/trade' ? (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-emerald-400" />
            ) : null}
          </Link>
          <Link
            href="/collection"
            className={`relative pb-1 text-sm font-medium transition-colors ${
              pathname === '/collection'
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            My Collection
            {pathname === '/collection' ? (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-emerald-400" />
            ) : null}
          </Link>
          <Link
            href="/wishlist"
            className={`relative pb-1 text-sm font-medium transition-colors ${
              pathname === '/wishlist'
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Wishlist
            {pathname === '/wishlist' ? (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-emerald-400" />
            ) : null}
          </Link>
          {user ? (
            <Link
              href={resolvedProfileHref ?? `/profile/${user.id}`}
              className={`relative pb-1 text-sm font-medium transition-colors ${
                profileActive
                  ? 'text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Profile
              {profileActive ? (
                <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-emerald-400" />
              ) : null}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {user && !supabaseDisabled ? (
            <Link
              href="/inbox"
              className="relative inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2 text-stone-300 hover:bg-white/[0.06] hover:text-white"
              aria-label="Inbox"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadBadgeText ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-bold text-emerald-950">
                  {unreadBadgeText}
                </span>
              ) : null}
            </Link>
          ) : null}

          <div className="hidden items-center gap-3 sm:flex">
            {authLoading ? (
              <p className="text-sm text-stone-300">Checking session...</p>
            ) : supabaseDisabled ? (
              <p className="hidden text-sm text-stone-300 lg:block">
                Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable login.
              </p>
            ) : user ? (
              <>
                <p className="hidden text-sm text-stone-200 sm:block">{user.email}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={submitting}
                  className={`rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-stone-100 hover:bg-white/[0.06] ${
                    submitting ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-stone-100 hover:bg-white/[0.06]"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2 text-stone-200 hover:bg-white/[0.06] sm:hidden"
            aria-label="Toggle menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
        </nav>

        {mobileOpen ? (
          <div className="border-t border-white/10 bg-stone-950/85 px-4 py-4 backdrop-blur-md sm:hidden">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
            {user && !supabaseDisabled ? (
              <Link
                href="/inbox"
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                  inboxActive
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                Inbox
              </Link>
            ) : null}
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                pathname === '/'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
              }`}
            >
              Binder
            </Link>
            <Link
              href="/trade"
              onClick={() => setMobileOpen(false)}
              className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                pathname === '/trade'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
              }`}
            >
              Trade Board
            </Link>
            <Link
              href="/collection"
              onClick={() => setMobileOpen(false)}
              className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                pathname === '/collection'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
              }`}
            >
              My Collection
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setMobileOpen(false)}
              className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                pathname === '/wishlist'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
              }`}
            >
              Wishlist
            </Link>
            {user ? (
              <Link
                href={resolvedProfileHref ?? `/profile/${user.id}`}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                  profileActive
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                Profile
              </Link>
            ) : null}

            {authLoading ? (
              <p className="pt-2 text-sm text-stone-300">Checking session...</p>
            ) : supabaseDisabled ? (
              <p className="pt-2 text-sm text-stone-300">
                Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable login.
              </p>
            ) : user ? (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-stone-200">{user.email}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={submitting}
                  className={`w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-stone-100 hover:bg-white/[0.06] ${
                    submitting ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthModal('login');
                  }}
                  className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-left text-sm font-medium text-emerald-950 hover:bg-emerald-300"
                >
                  Login / Sign Up
                </button>
              </div>
            )}
            </div>
          </div>
        ) : null}
      </header>

      {authModalOpen && !user && !supabaseDisabled ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAuthModal();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] border border-white/10 bg-stone-900 p-8 shadow-2xl shadow-black/30"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {authStage === 'signup_done'
                    ? 'Check your email'
                    : authMode === 'signup'
                      ? 'Create your account'
                      : 'Welcome back'}
                </h2>
                <p className="mt-1 text-sm text-stone-400">
                  {authStage === 'signup_done'
                    ? "We've sent you a verification link."
                    : authMode === 'signup'
                      ? 'Sign up to start tracking and trading.'
                      : 'Log in to your TradeBinder account.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {authStage === 'signup_done' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-stone-100">
                  <p className="font-semibold text-white">Check your email!</p>
                  <p className="mt-2 text-stone-200">
                    We&apos;ve sent you a verification link. You must verify your email before you can log in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthStage('form');
                    setAuthError('');
                  }}
                  className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-300"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthStage('form');
                      setAuthError('');
                    }}
                    className={classNames(
                      'rounded-xl px-3 py-2 text-sm',
                      authMode === 'login'
                        ? 'bg-emerald-400 text-emerald-950'
                        : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                    )}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthStage('form');
                      setAuthError('');
                    }}
                    className={classNames(
                      'rounded-xl px-3 py-2 text-sm',
                      authMode === 'signup'
                        ? 'bg-emerald-400 text-emerald-950'
                        : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                    )}
                  >
                    Sign Up
                  </button>
                </div>

                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                {authError ? (
                  <div
                    className={classNames(
                      'rounded-[1.5rem] border p-4 text-sm backdrop-blur',
                      authError.toLowerCase().includes('verify your email')
                        ? 'border-amber-300/15 bg-amber-400/5 text-amber-200/80'
                        : 'border-rose-300/20 bg-rose-500/10 text-rose-100'
                    )}
                  >
                    {authError}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !email || !password}
                  className={classNames(
                    'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                    submitting || !email || !password
                      ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                      : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                  )}
                >
                  {submitting ? '...' : authMode === 'signup' ? 'Create account' : 'Login'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

