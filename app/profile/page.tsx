'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { useAuth } from '../auth';

function formatMemberSince(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

function getInitials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return '?';

  const parts = cleaned.split(/\s+/g).filter(Boolean);
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  }

  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function validateUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Username is required.';
  if (trimmed.length < 3 || trimmed.length > 30) return 'Username must be 3–30 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Only letters, numbers, and underscore.';
  return null;
}

export default function ProfileEditorPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const { profile, loading, saving, error, updateProfile, uploadAvatar } = useProfile();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const timer = setTimeout(() => {
      setDisplayNameDraft(profile.display_name ?? '');
      setUsernameDraft(profile.username ?? '');
      setBioDraft(profile.bio ?? '');
    }, 0);

    return () => clearTimeout(timer);
  }, [profile]);

  const memberSince = useMemo(() => {
    const dateValue = profile?.created_at ?? user?.created_at ?? null;
    return dateValue ? formatMemberSince(dateValue) : null;
  }, [profile?.created_at, user?.created_at]);

  const avatarLabel = useMemo(() => {
    const basis = profile?.display_name || profile?.username || user?.email || 'Collector';
    return getInitials(basis);
  }, [profile?.display_name, profile?.username, user?.email]);

  const usernameValidationError = useMemo(() => {
    if (!profile) return null;
    if (usernameDraft.trim() === profile.username) return null;
    return validateUsername(usernameDraft);
  }, [profile, usernameDraft]);

  const displayNameChanged = Boolean(profile && (displayNameDraft ?? '') !== (profile.display_name ?? ''));
  const usernameChanged = Boolean(profile && usernameDraft.trim() !== profile.username);
  const bioChanged = Boolean(profile && (bioDraft ?? '') !== (profile.bio ?? ''));

  const publicHref = profile?.profile_slug ? `/u/${profile.profile_slug}` : null;

  async function onPickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAvatarError(null);

    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAvatarError('Only JPG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > 524288) {
      setAvatarError('Image must be under 512KB');
      return;
    }

    const result = await uploadAvatar(file);
    if (result.error) {
      setAvatarError(result.error);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email || !supabase) {
      return;
    }

    setResetMessage(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });

    if (err) {
      setResetMessage(err.message);
      return;
    }

    setResetMessage('Reset email sent! Check your inbox.');
    window.setTimeout(() => setResetMessage(null), 5000);
  }

  const [currentTheme, setCurrentTheme] = useState('emerald');

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const theme = localStorage.getItem('tradevault-theme') || 'emerald';
        setCurrentTheme(theme);
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    try {
      localStorage.setItem('tradevault-theme', theme);
      if (theme === 'emerald') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch {
      // ignore
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <main className="min-h-screen bg-transparent text-stone-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-stone-300">
            Loading...
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary-300/80">
                My Account
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Profile</h1>
              <p className="text-sm text-stone-300">Edit your public profile details.</p>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Appearance</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-stone-300">Choose your accent colour theme.</p>
                <div className="flex items-center gap-3">
                  {(
                    [
                      { id: 'emerald', bg: 'bg-[#10b981]' },
                      { id: 'blue', bg: 'bg-[#3b82f6]' },
                      { id: 'rose', bg: 'bg-[#f43f5e]' },
                      { id: 'amber', bg: 'bg-[#f59e0b]' },
                    ] as const
                  ).map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleThemeChange(theme.id)}
                      className={`h-8 w-8 rounded-full ${theme.bg} ring-offset-stone-900 transition-all ${
                        currentTheme === theme.id ? 'ring-2 ring-white ring-offset-2' : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`${theme.id} theme`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Avatar</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-primary-300/20 bg-primary-400/10 text-2xl font-semibold text-primary-200"
                    disabled={saving}
                  >
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      avatarLabel
                    )}
                  </button>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">Profile photo</p>
                    <p className="text-xs text-stone-500">JPG, PNG, WebP · 512KB max</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPickAvatar}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className={`inline-flex items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-stone-200 transition-colors hover:bg-white/[0.06] ${
                      saving ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    {saving ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : null}
                    Change photo
                  </button>
                  {avatarError ? <p className="text-xs text-rose-200">{avatarError}</p> : null}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Profile Details</p>

              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-400">Display Name</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value.slice(0, 50))}
                    className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                    placeholder="Your public name"
                  />
                  {displayNameChanged ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => updateProfile({ display_name: displayNameDraft.trim() || null })}
                      className={`rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 ${
                        saving ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-400">Username</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">@</span>
                    <input
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-stone-900 pl-7 pr-3 py-2 text-sm text-white outline-none"
                      placeholder="username"
                    />
                  </div>
                  {usernameChanged ? (
                    <button
                      type="button"
                      disabled={saving || Boolean(usernameValidationError)}
                      onClick={() => updateProfile({ username: usernameDraft.trim() })}
                      className={`rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 ${
                        saving || Boolean(usernameValidationError) ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      Save
                    </button>
                  ) : null}
                </div>
                {usernameValidationError ? (
                  <p className="text-xs text-amber-200">{usernameValidationError}</p>
                ) : null}
                {error === 'Username already taken' ? (
                  <p className="text-xs text-rose-200">Username already taken</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-400">Bio</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 200))}
                    className="min-h-[100px] w-full resize-none rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                    placeholder="A short bio (optional)"
                  />
                  {bioChanged ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => updateProfile({ bio: bioDraft.trim() || null })}
                      className={`rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-300 ${
                        saving ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              </div>

              {error && error !== 'Username already taken' ? (
                <p className="text-sm text-rose-200">{error}</p>
              ) : null}
            </section>

            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Account</p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-stone-950/30 px-4 py-3">
                  <p className="text-xs text-stone-500">Email</p>
                  <p className="mt-1 text-stone-200">{user?.email ?? ''}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-stone-950/30 px-4 py-3">
                  <p className="text-xs text-stone-500">Member since</p>
                  <p className="mt-1 text-stone-200">{memberSince ?? '—'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-stone-950/30 px-4 py-3">
                <div>
                  <p className="text-xs text-stone-500">Public profile</p>
                  <p className="mt-1 text-sm text-stone-200">{publicHref ?? '—'}</p>
                </div>
                {publicHref ? (
                  <Link
                    href={publicHref}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/[0.06]"
                  >
                    View public profile
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">Password</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-stone-300">Send a password reset email to your account address.</p>
                <button
                  type="button"
                  disabled={!supabase}
                  onClick={sendPasswordReset}
                  className={`rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-stone-200 hover:bg-white/[0.06] ${
                    !supabase ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  Send password reset email
                </button>
              </div>
              {resetMessage ? <p className="mt-3 text-sm text-primary-200">{resetMessage}</p> : null}
              {!supabase ? (
                <p className="mt-2 text-xs text-stone-500">Supabase environment variables are missing.</p>
              ) : null}
            </section>

            {loading ? (
              <p className="text-sm text-stone-400">Loading profile…</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
