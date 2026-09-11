import type { AuthView } from './types';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export const USERNAME_MIN_LENGTH = 3;

export const USERNAME_MAX_LENGTH = 30;

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function isUnverifiedEmailError(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes('email not confirmed') ||
    value.includes('not confirmed') ||
    value.includes('confirm your email') ||
    value.includes('email confirmation') ||
    value.includes('user not confirmed')
  );
}

export function usernameValidationMessage(username: string) {
  if (username.length > 0 && username.length < USERNAME_MIN_LENGTH) {
    return 'Username too short';
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return 'Username too long';
  }
  if (username.length > 0 && !USERNAME_PATTERN.test(username)) {
    return 'Only letters, numbers and underscores allowed';
  }
  return '';
}

export function isCredentialsSubmitDisabled(params: {
  authView: AuthView;
  submitting: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}) {
  const { authView, submitting, email, password, confirmPassword, username } = params;

  return (
    submitting ||
    !email ||
    !password ||
    (authView === 'signup' &&
      (!username ||
        username.length < USERNAME_MIN_LENGTH ||
        username.length > USERNAME_MAX_LENGTH ||
        !USERNAME_PATTERN.test(username) ||
        !confirmPassword ||
        password !== confirmPassword))
  );
}
