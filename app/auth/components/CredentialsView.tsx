'use client';

import type { AuthFormState } from '../hooks/useAuthForm';
import { classNames, isCredentialsSubmitDisabled } from '../utils';
import GoogleSignInButton from './GoogleSignInButton';
import UsernameField from './UsernameField';

export default function CredentialsView({ form }: { form: AuthFormState }) {
  const {
    authView,
    showView,
    handleGoogleSignIn,
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    authError,
    submitting,
    handleSubmit,
  } = form;

  const submitDisabled = isCredentialsSubmitDisabled({
    authView,
    submitting,
    email,
    password,
    confirmPassword,
    username,
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => showView('signin')}
          className={classNames(
            'rounded-xl px-3 py-2 text-sm',
            authView === 'signin'
              ? 'bg-primary-400 text-primary-950'
              : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
          )}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => showView('signup')}
          className={classNames(
            'rounded-xl px-3 py-2 text-sm',
            authView === 'signup'
              ? 'bg-primary-400 text-primary-950'
              : 'border border-white/10 bg-white/[0.03] text-stone-200 hover:bg-white/[0.06]'
          )}
        >
          Sign Up
        </button>
      </div>

      <GoogleSignInButton onClick={handleGoogleSignIn} />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-stone-900 px-3 text-stone-500">or continue with email</span>
        </div>
      </div>

      <div className="space-y-3">
        {authView === 'signup' ? (
          <UsernameField value={username} onChange={setUsername} />
        ) : null}
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
        {authView === 'signup' ? (
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
            />
            {confirmPassword.length > 0 && password !== confirmPassword ? (
              <p className="mt-1 pl-2 text-xs text-rose-400">Passwords do not match</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {authView === 'signin' ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => showView('forgot')}
            className="text-xs text-stone-400 hover:text-primary-400 transition-colors"
          >
            Forgot password?
          </button>
        </div>
      ) : null}

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
        disabled={submitDisabled}
        className={classNames(
          'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
          submitDisabled
            ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
            : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
        )}
      >
        {submitting ? '...' : authView === 'signup' ? 'Create account' : 'Login'}
      </button>
    </div>
  );
}
