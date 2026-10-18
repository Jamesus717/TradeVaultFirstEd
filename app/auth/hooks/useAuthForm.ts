'use client';

import { useState } from 'react';
import { useAuth } from '../../auth';
import type { AuthView } from '../types';
import { isUnverifiedEmailError } from '../utils';

export function useAuthForm() {
  const {
    user,
    supabaseDisabled,
    signIn,
    signOut,
    signInWithGoogle,
    signUpWithUsername,
    resetPassword,
    resendVerification,
  } = useAuth();

  const [authView, setAuthView] = useState<AuthView>('signin');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  function openAuthModal(mode: AuthView) {
    if (supabaseDisabled) {
      return;
    }
    setAuthView(mode);
    setAuthError('');
    setResetSuccess('');
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
    setAuthError('');
    setResetSuccess('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setAuthView('signin');
  }

  // Every in-modal view switch clears the error and success banners as it moves.
  function showView(view: AuthView) {
    setAuthView(view);
    setAuthError('');
    setResetSuccess('');
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setAuthError('');
    const error = await signInWithGoogle();
    if (error) {
      setAuthError(error);
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setAuthError('Please enter your email address');
      return;
    }
    setSubmitting(true);
    setAuthError('');
    const error = await resetPassword(email);
    if (error) {
      setAuthError(error);
    } else {
      setResetSuccess('Check your inbox for a reset link');
    }
    setSubmitting(false);
  }

  async function handleResend() {
    if (resendDisabled || !email) return;
    setResendDisabled(true);
    setResetSuccess('');
    const error = await resendVerification(email);
    if (error) {
      setAuthError(error);
    } else {
      setResetSuccess('Email resent!');
    }
    setTimeout(() => {
      setResendDisabled(false);
      setResetSuccess('');
    }, 30000);
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setAuthError('');

    if (authView === 'signup') {
      const error = await signUpWithUsername(email, password, username);
      if (error === 'USERNAME_TAKEN') {
        setAuthError('Username already taken, please choose another');
        setSubmitting(false);
        return;
      }
      if (error) {
        setAuthError(error);
        setSubmitting(false);
        return;
      }
      setAuthView('verify');
      setPassword('');
      setConfirmPassword('');
      setSubmitting(false);
      return;
    }

    const error = await signIn(email, password);

    if (error) {
      if (authView === 'signin' && isUnverifiedEmailError(error)) {
        setAuthError(
          'Please verify your email before logging in. Check your inbox for the verification link.'
        );
      } else {
        setAuthError(error);
      }
      setSubmitting(false);
      return;
    }

    setAuthModalOpen(false);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
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

  return {
    user,
    supabaseDisabled,
    authView,
    authModalOpen,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    username,
    setUsername,
    authError,
    submitting,
    resendDisabled,
    resetSuccess,
    openAuthModal,
    closeAuthModal,
    showView,
    handleGoogleSignIn,
    handleResetPassword,
    handleResend,
    handleSubmit,
    handleLogout,
  };
}

export type AuthFormState = ReturnType<typeof useAuthForm>;
