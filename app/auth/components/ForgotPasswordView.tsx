'use client';

import type { AuthFormState } from '../hooks/useAuthForm';
import { classNames } from '../utils';

export default function ForgotPasswordView({ form }: { form: AuthFormState }) {
  const { showView, email, setEmail, authError, resetSuccess, submitting, handleResetPassword } =
    form;

  return (
    <div className="mt-6 space-y-4">
      <button
        type="button"
        onClick={() => showView('signin')}
        className="text-xs text-stone-400 hover:text-primary-400 transition-colors"
      >
        ← Back to sign in
      </button>

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      {authError ? (
        <div className="rounded-[1.5rem] border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100 backdrop-blur">
          {authError}
        </div>
      ) : null}

      {resetSuccess ? (
        <div className="rounded-[1.5rem] border border-primary-300/20 bg-primary-500/10 p-4 text-sm text-primary-100 backdrop-blur">
          {resetSuccess}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleResetPassword}
        disabled={submitting || !email}
        className={classNames(
          'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
          submitting || !email
            ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
            : 'bg-primary-400 text-primary-950 hover:bg-primary-300'
        )}
      >
        {submitting ? '...' : 'Send reset link'}
      </button>
    </div>
  );
}
