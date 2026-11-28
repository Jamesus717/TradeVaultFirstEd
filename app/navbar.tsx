'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { demoMode } from '../lib/demo';
import { useAuth } from './auth';
import AuthModal from './auth/components/AuthModal';
import { useAuthForm } from './auth/hooks/useAuthForm';
import {
  isActive,
  MORE_LINKS,
  NavIcon,
  RAIL_ITEMS,
  TAB_KEYS,
  UnreadBadge,
  unreadLabel,
  type NavItem,
} from './components/nav/items';
import { useUnreadMessages } from './components/nav/useUnreadMessages';

// Desktop (1024 px and up): an icon rail on the left that widens on hover or
// keyboard focus to show labels, drawn over the page so nothing reflows.
// Tablet (768 to 1023 px): the same rail, icons only.
// Phones: a slim top bar and a five-tab bar at the bottom.
// Messages is always a first-class item with its own unread badge.

function Logo({ withWord }: { withWord: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-400 font-display text-base font-bold text-primary-950"
      >
        TB
      </span>
      {withWord ? (
        <span className="rail-label font-display text-lg font-semibold tracking-tight text-white">TradeBinder</span>
      ) : null}
    </>
  );
}

function RailLink({ item, pathname, unread }: { item: NavItem; pathname: string; unread: number }) {
  const active = isActive(item.key, item.href, pathname);
  const count = item.key === 'messages' ? unread : 0;

  return (
    <li>
      <Link
        href={item.href}
        aria-label={unreadLabel(item.label, count)}
        aria-current={active ? 'page' : undefined}
        className={`rail-item ${active ? 'is-active' : ''}`}
      >
        <span className="relative shrink-0">
          <NavIcon name={item.key} />
          <UnreadBadge count={count} className="absolute -right-2.5 -top-2" />
        </span>
        <span aria-hidden="true" className="rail-label">
          {item.label}
        </span>
      </Link>
    </li>
  );
}

export default function Navbar() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const authForm = useAuthForm();
  const { submitting, openAuthModal, handleLogout } = authForm;
  const pathname = usePathname();
  const unread = useUnreadMessages();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const moreRef = useRef<HTMLDivElement>(null);

  const canSignIn = !demoMode && !supabaseDisabled && !authLoading && !user;

  // Back and forward don't go through the menu's links, so close it on any route change.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [moreOpen]);

  const tabs = TAB_KEYS.map((key) => RAIL_ITEMS.find((item) => item.key === key)!);

  return (
    <>
      {/* ── Phone top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-stone-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-h-11 items-center gap-2" aria-label="TradeBinder home">
            <Logo withWord={false} />
            <span className="font-display text-lg font-semibold tracking-tight text-white">TradeBinder</span>
          </Link>
          {canSignIn ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-stone-100"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="min-h-11 rounded-xl bg-primary-400 px-3 text-sm font-semibold text-primary-950"
              >
                Sign up
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Desktop and tablet rail ───────────────────────────── */}
      <nav aria-label="Main" className="side-rail group/rail">
        <Link href="/" className="rail-item rail-logo" aria-label="TradeBinder home">
          <Logo withWord />
        </Link>

        <ul className="flex flex-1 flex-col gap-1">
          {RAIL_ITEMS.map((item) => (
            <RailLink key={item.key} item={item} pathname={pathname} unread={unread} />
          ))}
        </ul>

        <div ref={moreRef} className="relative">
          {canSignIn ? (
            <button type="button" onClick={() => openAuthModal('signin')} className="rail-item w-full" aria-label="Log in or sign up">
              <span className="shrink-0">
                <NavIcon name="profile" />
              </span>
              <span aria-hidden="true" className="rail-label">
                Log in / Sign up
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="rail-more"
            aria-label="More: collection, wishlist and settings"
            className={`rail-item w-full ${moreOpen ? 'is-active' : ''}`}
          >
            <span className="shrink-0">
              <NavIcon name="more" />
            </span>
            <span aria-hidden="true" className="rail-label">
              More
            </span>
          </button>

          {moreOpen ? (
            <div
              id="rail-more"
              className="absolute bottom-0 left-full ml-3 w-56 rounded-2xl border border-white/10 bg-stone-900 p-2 shadow-2xl shadow-black/50"
            >
              {MORE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm text-stone-200 hover:bg-white/[0.06] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              {user && !demoMode ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={submitting}
                  className="mt-1 flex min-h-11 w-full items-center rounded-xl border-t border-white/10 px-3 text-left text-sm text-stone-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
                >
                  Log out {user.email ? <span className="ml-1 truncate text-xs text-stone-500">({user.email})</span> : null}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      {/* ── Phone tab bar ─────────────────────────────────────── */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-stone-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {tabs.map((item) => {
          const active = isActive(item.key, item.href, pathname);
          const count = item.key === 'messages' ? unread : 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={unreadLabel(item.short ?? item.label, count)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? 'text-primary-300' : 'text-stone-400'
              }`}
            >
              {active ? <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-primary-400" /> : null}
              <span className="relative">
                <NavIcon name={item.key} />
                <UnreadBadge count={count} className="absolute -right-3 -top-1.5" />
              </span>
              <span aria-hidden="true">{item.short ?? item.label}</span>
            </Link>
          );
        })}
      </nav>

      <AuthModal form={authForm} />
    </>
  );
}
