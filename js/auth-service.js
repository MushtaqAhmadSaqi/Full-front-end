/**
 * js/auth-service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared authentication service for the whole project.
 *
 * Goal:
 * - one source of truth for login/signup/google auth
 * - one place for redirect URL logic
 * - one place for auth error normalization
 *
 * This file is safe to add first.
 * It does NOT break the current UI by itself.
 */

import { supabase } from './core.js';

/**
 * Build a same-folder absolute URL safely.
 * Example:
 * - on /index.html   -> /dashboard.html
 * - on /auth.html    -> /dashboard.html
 * - on nested pages  -> sibling dashboard.html in that folder
 */
function toAbsoluteUrl(fileName) {
  return new URL(fileName, window.location.href).href;
}

/**
 * Default destination after successful auth / email confirmation / OAuth return
 */
export function getDashboardUrl() {
  return toAbsoluteUrl('dashboard.html');
}

/**
 * Auth page URL helper if ever needed later
 */
export function getAuthPageUrl() {
  return toAbsoluteUrl('auth.html');
}

/**
 * Small helper to normalize strings
 */
function clean(value) {
  return String(value ?? '').trim();
}

/**
 * Convert Supabase / runtime errors into cleaner UI-friendly messages
 */
export function getReadableAuthError(error, mode = 'general') {
  const fallback =
    mode === 'signup'
      ? 'Could not create your account. Please try again.'
      : mode === 'login'
      ? 'Login failed. Please try again.'
      : 'Something went wrong. Please try again.';

  if (!error) return fallback;

  const raw = clean(error.message || error.toString());
  const lower = raw.toLowerCase();

  if (!raw) return fallback;

  if (lower.includes('invalid login credentials')) {
    return 'Wrong email or password. Please check and try again.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please verify your email first.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists.';
  }

  if (lower.includes('password should be at least')) {
    return 'Password must be at least 8 characters long.';
  }

  if (lower.includes('unable to validate email address')) {
    return 'Please enter a valid email address.';
  }

  if (lower.includes('signup is disabled')) {
    return 'Account registration is currently disabled.';
  }

  if (lower.includes('network')) {
    return 'Network issue detected. Please check your internet connection and try again.';
  }

  return raw;
}

/**
 * Optional frontend validation before hitting Supabase
 */
export function validateEmailSignUpInput({ name, email, password, acceptedTerms }) {
  const trimmedName = clean(name);
  const trimmedEmail = clean(email);

  if (!trimmedName) {
    return { ok: false, message: 'Please enter your full name.' };
  }

  if (!trimmedEmail) {
    return { ok: false, message: 'Please enter your email address.' };
  }

  if (!password) {
    return { ok: false, message: 'Please enter your password.' };
  }

  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }

  if (!acceptedTerms) {
    return { ok: false, message: 'Please accept the terms of service first.' };
  }

  return {
    ok: true,
    values: {
      name: trimmedName,
      email: trimmedEmail,
      password
    }
  };
}

export function validateEmailLoginInput({ email, password }) {
  const trimmedEmail = clean(email);

  if (!trimmedEmail) {
    return { ok: false, message: 'Please enter your email address.' };
  }

  if (!password) {
    return { ok: false, message: 'Please enter your password.' };
  }

  return {
    ok: true,
    values: {
      email: trimmedEmail,
      password
    }
  };
}

/**
 * Shared sign-up
 */
export async function signUpWithEmail({
  name,
  email,
  password,
  emailRedirectTo = getDashboardUrl()
}) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: clean(email),
      password,
      options: {
        data: {
          full_name: clean(name)
        },
        emailRedirectTo
      }
    });

    if (error) {
      return {
        ok: false,
        data: null,
        error,
        message: getReadableAuthError(error, 'signup')
      };
    }

    return {
      ok: true,
      data,
      error: null,
      message: 'Account created successfully. Please check your email to confirm your account.'
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
      message: getReadableAuthError(error, 'signup')
    };
  }
}

/**
 * Shared email/password login
 */
export async function signInWithEmail({ email, password }) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: clean(email),
      password
    });

    if (error) {
      return {
        ok: false,
        data: null,
        error,
        message: getReadableAuthError(error, 'login')
      };
    }

    return {
      ok: true,
      data,
      error: null,
      message: 'Login successful.'
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
      message: getReadableAuthError(error, 'login')
    };
  }
}

/**
 * Shared Google OAuth login
 * Note:
 * Supabase usually redirects immediately on success,
 * so caller mostly just needs to handle the error case.
 */
export async function signInWithGoogle({
  redirectTo = getPostAuthRedirectUrl()
} = {}) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    });

    if (error) {
      return {
        ok: false,
        data: null,
        error,
        message: getReadableAuthError(error, 'login')
      };
    }

    return {
      ok: true,
      data,
      error: null,
      message: 'Redirecting to Google...'
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error,
      message: getReadableAuthError(error, 'login')
    };
  }
}

/**
 * Shared logout
 */
export async function signOutUser({ reload = true } = {}) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        ok: false,
        error,
        message: getReadableAuthError(error, 'general')
      };
    }

    if (reload) {
      window.location.reload();
    }

    return {
      ok: true,
      error: null,
      message: 'Signed out successfully.'
    };
  } catch (error) {
    return {
      ok: false,
      error,
      message: getReadableAuthError(error, 'general')
    };
  }
}

/**
 * Current session helper
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return {
        ok: false,
        session: null,
        error,
        message: getReadableAuthError(error, 'general')
      };
    }

    return {
      ok: true,
      session: data?.session ?? null,
      error: null,
      message: ''
    };
  } catch (error) {
    return {
      ok: false,
      session: null,
      error,
      message: getReadableAuthError(error, 'general')
    };
  }
}

/**
 * Reads a stored post-auth redirect from sessionStorage or the ?redirect= query param.
 * Validates same-origin to prevent open-redirect attacks.
 */
function getSafePostAuthRedirect() {
  const storedRedirect = sessionStorage.getItem('postAuthRedirect');
  const params = new URLSearchParams(window.location.search);
  const queryRedirect = params.get('redirect');
  const target = storedRedirect || queryRedirect;

  if (!target) return null;

  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Returns the post-auth redirect URL, or falls back to the dashboard.
 */
export function getPostAuthRedirectUrl() {
  return getSafePostAuthRedirect() || getDashboardUrl();
}

/**
 * Small redirect helper for successful login flows.
 * Honors any stored postAuthRedirect (e.g. from the AI Quiz auth gate).
 */
export function redirectToDashboard() {
  const target = getPostAuthRedirectUrl();
  sessionStorage.removeItem('postAuthRedirect');
  window.location.href = target;
}
