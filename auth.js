import {
  validateEmailSignUpInput,
  validateEmailLoginInput,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  getCurrentSession,
  redirectToDashboard
} from './js/auth-service.js';

/**
 * auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone Auth Screen Controller
 *
 * Improvements:
 * - uses shared auth-service.js
 * - fixes wrong import structure
 * - adds working Google auth buttons
 * - keeps current UI mostly unchanged
 * - safely handles missing DOM elements
 * - redirects logged-in users away from auth page
 */

const authRoot = document.querySelector('.auth');
const toInButtons = document.querySelectorAll('.to-in');
const toUpButtons = document.querySelectorAll('.to-up');
const eyeButtons = document.querySelectorAll('.eye');

const signUpForm = document.getElementById('s-form');
const loginForm = document.getElementById('l-form');

const signUpBtn = document.getElementById('signUpBtn');
const loginBtn = document.getElementById('loginBtn');

const signUpError = document.getElementById('signUpError');
const loginError = document.getElementById('loginError');

const googleButtons = document.querySelectorAll('.btn-g');

/* ──────────────────────────────────────────────────────────────────────────
 * Init
 * ────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAuthScreen().catch(error => {
    console.error('Auth screen init failed:', error);
  });
});

async function initAuthScreen() {
  wirePanelToggle();
  wirePasswordVisibility();
  wireGoogleButtons();
  wireSignUpForm();
  wireLoginForm();
  await redirectIfAlreadyLoggedIn();
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panel Toggle
 * ────────────────────────────────────────────────────────────────────────── */
function wirePanelToggle() {
  toUpButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      authRoot?.classList.add('toggled');
      clearAllMessages();
      focusSignUpName();
    });
  });

  toInButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      authRoot?.classList.remove('toggled');
      clearAllMessages();
      focusLoginEmail();
    });
  });
}

function focusLoginEmail() {
  const input = document.getElementById('l-email');
  if (input) {
    window.setTimeout(() => input.focus(), 30);
  }
}

function focusSignUpName() {
  const input = document.getElementById('s-name');
  if (input) {
    window.setTimeout(() => input.focus(), 30);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Password Visibility
 * ────────────────────────────────────────────────────────────────────────── */
function wirePasswordVisibility() {
  eyeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const input = button.parentElement?.querySelector('input');
      const icon = button.querySelector('.material-symbols-outlined');

      if (!input || !icon) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      button.setAttribute(
        'aria-label',
        isPassword ? 'Hide password' : 'Show password'
      );
    });
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Google Auth
 * ────────────────────────────────────────────────────────────────────────── */
function wireGoogleButtons() {
  googleButtons.forEach(button => {
    button.addEventListener('click', async () => {
      clearAllMessages();
      const previousHtml = button.innerHTML;

      setButtonLoading(button, 'Redirecting...', false);

      const result = await signInWithGoogle();

      if (!result.ok) {
        showAuthError(getVisibleErrorBox(), result.message);
        button.disabled = false;
        button.innerHTML = previousHtml;
      }
      // On success Supabase usually redirects away automatically.
    });
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sign Up
 * ────────────────────────────────────────────────────────────────────────── */
function wireSignUpForm() {
  if (!signUpForm) return;

  signUpForm.addEventListener('submit', async event => {
    event.preventDefault();
    clearAllMessages();

    const name = document.getElementById('s-name')?.value ?? '';
    const email = document.getElementById('s-email')?.value ?? '';
    const password = document.getElementById('s-pass')?.value ?? '';
    const acceptedTerms = !!document.getElementById('acc-in')?.checked;

    const validation = validateEmailSignUpInput({
      name,
      email,
      password,
      acceptedTerms
    });

    if (!validation.ok) {
      showAuthError(signUpError, validation.message);
      return;
    }

    const oldHtml = signUpBtn?.innerHTML ?? '';
    if (signUpBtn) {
      setButtonLoading(signUpBtn, 'Processing...', true);
    }

    const result = await signUpWithEmail(validation.values);

    if (!result.ok) {
      showAuthError(signUpError, result.message);
      restoreButton(signUpBtn, oldHtml);
      return;
    }

    signUpForm.reset();
    
    // Show Toast
    if (window.showFeedbackStatus) {
      window.showFeedbackStatus({
        type: 'success',
        message: 'Account created! Welcome to the hub.',
        duration: 5000
      });
    }

    // Show Global Banner (Critical Instructions)
    if (window.updateGlobalFeedback) {
      window.updateGlobalFeedback({
        type: 'success',
        message: 'Registration successful! Please check your email to confirm your account before signing in.',
        duration: 15000
      });
    }

    authRoot?.classList.remove('toggled');
    restoreButton(signUpBtn, oldHtml);
    focusLoginEmail();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Login
 * ────────────────────────────────────────────────────────────────────────── */
function wireLoginForm() {
  if (!loginForm) return;

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    clearAllMessages();

    const email = document.getElementById('l-email')?.value ?? '';
    const password = document.getElementById('l-pass')?.value ?? '';

    const validation = validateEmailLoginInput({ email, password });

    if (!validation.ok) {
      showAuthError(loginError, validation.message);
      return;
    }

    const oldHtml = loginBtn?.innerHTML ?? '';
    if (loginBtn) {
      setButtonLoading(loginBtn, 'Logging in...', true);
    }

    const result = await signInWithEmail(validation.values);

    if (!result.ok) {
      showAuthError(loginError, result.message);
      restoreButton(loginBtn, oldHtml);
      return;
    }

    restoreButton(loginBtn, oldHtml);
    redirectToDashboard();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Existing Session Guard
 * ────────────────────────────────────────────────────────────────────────── */
async function redirectIfAlreadyLoggedIn() {
  const result = await getCurrentSession();

  if (!result.ok) return;
  if (!result.session) return;

  redirectToDashboard();
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */
function setButtonLoading(button, label, withSpinner = true) {
  if (!button) return;

  button.disabled = true;
  button.innerHTML = withSpinner
    ? `
      <span class="flex items-center justify-center gap-2">
        <span class="animate-spin">⟳</span>
        <span>${label}</span>
      </span>
    `
    : `
      <span class="flex items-center justify-center gap-2">
        <span>${label}</span>
      </span>
    `;
}

function restoreButton(button, html) {
  if (!button) return;
  button.disabled = false;
  button.innerHTML = html;
}

function showAuthError(target, message) {
  if (!target) return;

  target.textContent = message;
  target.style.display = 'block';
  target.setAttribute('aria-hidden', 'false');
  target.setAttribute('tabindex', '-1');

  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (window.updateGlobalFeedback) {
    window.updateGlobalFeedback({
      type: 'error',
      message,
      duration: 6000
    });
  }
}

function clearAllMessages() {
  [signUpError, loginError].forEach(box => {
    if (!box) return;

    box.textContent = '';
    box.style.display = 'none';
    box.setAttribute('aria-hidden', 'true');
    box.removeAttribute('tabindex');
  });
}

function getVisibleErrorBox() {
  const isSignupVisible = authRoot?.classList.contains('toggled');
  return isSignupVisible ? signUpError : loginError;
}
