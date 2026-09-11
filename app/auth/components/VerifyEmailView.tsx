'use client';

import type { AuthFormState } from '../hooks/useAuthForm';

export default function VerifyEmailView({ form }: { form: AuthFormState }) {
  const { handleResend, resendDisabled, resetSuccess, authError, showView } = form;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-[1.5rem] border border-primary-300/20 bg-primary-400/10 p-5 text-sm text-stone-100">
        <p className="font-semibold text-white">Check your email!</p>
        <p className="mt-2 text-stone-200">
          We&apos;ve sent you a verification link. You must verify your email before you can log in.
        </p>
      </div>
      <div className="text-center text-sm">
        <span className="text-stone-400">Didn&apos;t receive it? </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Resend verification email
        </button>
        {resetSuccess ? <p className="mt-2 text-xs text-primary-400">{resetSuccess}</p> : null}
        {authError ? <p className="mt-2 text-xs text-rose-400">{authError}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => showView('signin')}
        className="w-full rounded-2xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300"
      >
        Back to Login
      </button>
    </div>
  );
}
