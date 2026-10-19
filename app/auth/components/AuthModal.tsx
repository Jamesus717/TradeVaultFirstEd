'use client';

import type { AuthFormState } from '../hooks/useAuthForm';
import CredentialsView from './CredentialsView';
import ForgotPasswordView from './ForgotPasswordView';
import VerifyEmailView from './VerifyEmailView';

export default function AuthModal({ form }: { form: AuthFormState }) {
  const { authModalOpen, user, supabaseDisabled, authView, closeAuthModal } = form;

  if (!authModalOpen || user || supabaseDisabled) {
    return null;
  }

  return (
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
              {authView === 'verify'
                ? 'Check your email'
                : authView === 'forgot'
                  ? 'Reset your password'
                  : authView === 'signup'
                    ? 'Create your account'
                    : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              {authView === 'verify'
                ? "We've sent you a verification link."
                : authView === 'forgot'
                  ? 'Enter your email to receive a reset link.'
                  : authView === 'signup'
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

        {authView === 'verify' ? (
          <VerifyEmailView form={form} />
        ) : authView === 'forgot' ? (
          <ForgotPasswordView form={form} />
        ) : (
          <CredentialsView form={form} />
        )}
      </div>
    </div>
  );
}
