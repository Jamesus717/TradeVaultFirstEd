'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './auth';
import AuthModal from './auth/components/AuthModal';
import { useAuthForm } from './auth/hooks/useAuthForm';

const NAV_LINKS = [
  { href: '/', label: 'Matches' },
  { href: '/binder', label: 'Binder' },
  { href: '/trade', label: 'Trade Board' },
  { href: '/shops', label: 'Shops' },
  { href: '/collection', label: 'My Collection' },
  { href: '/wishlist', label: 'Wishlist' },
];

// Phones get the four places people go most; the menu holds the rest.
const BOTTOM_LINKS = [
  { href: '/', label: 'Matches', icon: 'M7 8h13l-3-3M17 16H4l3 3' },
  { href: '/binder', label: 'Binder', icon: 'M5 4h14v16H5zM9 4v16' },
  { href: '/trade', label: 'Trade', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/shops', label: 'Shops', icon: 'M4 10l1.5-5h13L20 10M5 10v9h14v-9M4 10h16M10 19v-5h4v5' },
];

export default function Navbar() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const authForm = useAuthForm();
  const { submitting, openAuthModal, handleLogout } = authForm;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadState, setUnreadState] = useState<{ userId: string; count: number }>({
    userId: '',
    count: 0,
  });

  const inboxActive = pathname.startsWith('/inbox');
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

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
  const resolvedProfileHref = '/profile';
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/u/');
  const unreadBadgeText = useMemo(() => {
    if (unreadCount <= 0) {
      return '';
    }
    return unreadCount > 9 ? '9+' : String(unreadCount);
  }, [unreadCount]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-stone-950/75 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            TradeBinder
          </Link>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`relative pb-1 text-sm font-medium transition-colors ${
                isActive(href) ? 'text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
              {isActive(href) ? (
                <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-primary-400" />
              ) : null}
            </Link>
          ))}
          {user ? (
            <Link
              href={resolvedProfileHref}
              className={`relative pb-1 text-sm font-medium transition-colors ${
                profileActive
                  ? 'text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Profile
              {profileActive ? (
                <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-primary-400" />
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
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-400 px-1 text-[10px] font-bold text-primary-950">
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
                  onClick={() => openAuthModal('signin')}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-stone-100 hover:bg-white/[0.06]"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300"
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
                    ? 'bg-primary-400 text-primary-950'
                    : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                Inbox
              </Link>
            ) : null}
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                  isActive(href)
                    ? 'bg-primary-400 text-primary-950'
                    : 'bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </Link>
            ))}
            {user ? (
              <Link
                href={resolvedProfileHref}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl border border-white/10 px-4 py-3 text-sm font-medium ${
                  profileActive
                    ? 'bg-primary-400 text-primary-950'
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
                    openAuthModal('signin');
                  }}
                  className="w-full rounded-xl bg-primary-400 px-4 py-3 text-left text-sm font-medium text-primary-950 hover:bg-primary-300"
                >
                  Login / Sign Up
                </button>
              </div>
            )}
            </div>
          </div>
        ) : null}
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-stone-950 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {BOTTOM_LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium ${
              isActive(href) ? 'text-primary-300' : 'text-stone-400'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d={icon} />
            </svg>
            {label}
          </Link>
        ))}
      </nav>

      <AuthModal form={authForm} />
    </>
  );
}
