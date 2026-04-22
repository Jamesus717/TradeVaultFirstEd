'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './auth';

type AuthMode = 'login' | 'signup';

export default function Navbar() {
  const { user, authLoading, supabaseDisabled, signIn, signOut, signUp } = useAuth();
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAuthOpen, setMobileAuthOpen] = useState(false);
  const [profileHref, setProfileHref] = useState<string | null>(null);

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

  const resolvedProfileHref = user ? (profileHref ?? `/profile/${user.id}`) : null;
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/u/');

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setAuthError('');

    const action = authMode === 'signup' ? signUp : signIn;
    const error = await action(email, password);

    if (error) {
      setAuthError(error);
      setSubmitting(false);
      return;
    }

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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-stone-950/75 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            TradeVault
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
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      authMode === 'login'
                        ? 'bg-emerald-400 text-emerald-950'
                        : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      authMode === 'signup'
                        ? 'bg-emerald-400 text-emerald-950'
                        : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    className="hidden w-48 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none sm:block"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="hidden w-40 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none sm:block"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !email || !password}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      submitting || !email || !password
                        ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                        : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                    }`}
                  >
                    {submitting ? '...' : authMode === 'signup' ? 'Create' : 'Login'}
                  </button>
                </div>
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
                  onClick={() => setMobileAuthOpen((current) => !current)}
                  className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-left text-sm font-medium text-emerald-950 hover:bg-emerald-300"
                >
                  Login / Sign Up
                </button>

                {mobileAuthOpen ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          authMode === 'login'
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                        }`}
                      >
                        Login
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signup')}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          authMode === 'signup'
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                        }`}
                      >
                        Sign Up
                      </button>
                    </div>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || !email || !password}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                        submitting || !email || !password
                          ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                          : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                      }`}
                    >
                      {submitting ? '...' : authMode === 'signup' ? 'Create' : 'Login'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {authError ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 text-sm text-rose-200 sm:px-6 lg:px-8">
          {authError}
        </div>
      ) : null}
    </header>
  );
}

