/**
 * js/auth-ui.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Auth Modal UI
 *
 * Improvements:
 * - now uses shared auth-service.js
 * - removes duplicated Supabase auth logic
 * - keeps modal UI and structure intact
 * - improves button loading handling
 * - keeps focus trapping + overlay close + escape close
 */

import {
  validateEmailSignUpInput,
  validateEmailLoginInput,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  redirectToDashboard
} from './auth-service.js';

let lastFocusedElement = null;
let removeFocusTrap = null;

/* ──────────────────────────────────────────────────────────────────────────
 * SweetAlert Loader
 * ────────────────────────────────────────────────────────────────────────── */
async function ensureSwal() {
  if (window.Swal) return window.Swal;

  const existing = document.getElementById('swal-script');
  if (!existing) {
    const script = document.createElement('script');
    script.id = 'swal-script';
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    script.defer = true;
    document.head.appendChild(script);
  }

  await new Promise(resolve => {
    const check = () => {
      if (window.Swal) return resolve();
      window.setTimeout(check, 50);
    };
    check();
  });

  return window.Swal;
}

async function notify(title, text, icon = 'info') {
  try {
    // We favor the non-blocking showFeedbackStatus system for standard notifications
    if (window.showFeedbackStatus) {
        window.showFeedbackStatus({
            type: icon,
            message: text || title,
            duration: icon === 'error' ? 6000 : 4000
        });
        return;
    }
    
    const Swal = await ensureSwal();
    return Swal.fire(title, text, icon);
  } catch (error) {
    console.warn('Notification fallback failed.', error);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Focus Management
 * ────────────────────────────────────────────────────────────────────────── */
function getFocusableElements(container) {
  return [
    ...container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ].filter(element => !element.hasAttribute('hidden') && element.offsetParent !== null);
}

function trapFocus(container) {
  const handler = event => {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

function focusActiveField(tab = 'login') {
  const selector = tab === 'signup' ? '#am-s-name' : '#am-l-email';
  const target = document.querySelector(selector);
  if (target) {
    window.setTimeout(() => target.focus(), 30);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Modal Public API
 * ────────────────────────────────────────────────────────────────────────── */
export function initAuthModal() {
  if (document.getElementById('auth-modal-overlay')) return;

  if (!document.querySelector('link[href*="auth-modal.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'auth-modal.css';
    document.head.appendChild(link);
  }

  injectModalHTML();
  attachListeners();
}

export function openModal(startTab = 'login') {
  const overlay = document.getElementById('auth-modal-overlay');
  const authCard = document.getElementById('am-auth');

  if (!overlay || !authCard) return;

  lastFocusedElement = document.activeElement;
  overlay.hidden = false;
  overlay.style.display = 'flex';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // [A11Y] Set inert on all siblings of the modal for focus trapping
  Array.from(document.body.children).forEach(child => {
    if (child !== overlay) child.setAttribute('inert', '');
  });

  authCard.classList.toggle('toggled', startTab === 'signup');

  removeFocusTrap?.();
  removeFocusTrap = trapFocus(overlay);

  focusActiveField(startTab);
}

export function closeModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('open');
  document.body.style.overflow = '';

  // [A11Y] Restore access to siblings
  Array.from(document.body.children).forEach(child => {
    if (child !== overlay) child.removeAttribute('inert');
  });

  removeFocusTrap?.();
  removeFocusTrap = null;

  window.setTimeout(() => {
    overlay.hidden = true;
    overlay.style.display = 'none';
  }, 200);

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * HTML Injection
 * ────────────────────────────────────────────────────────────────────────── */
function injectModalHTML() {
  const html = `
    <div class="auth-modal-overlay" id="auth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" hidden style="display:none;">
      <div class="auth-modal am-auth" id="am-auth">
        <button class="auth-modal-close" id="close-auth-modal" aria-label="Close authentication dialog" type="button">
          <span class="material-symbols-outlined" style="font-size:20px;" aria-hidden="true">close</span>
        </button>

        <div class="am-panel am-login">
          <section class="am-side am-l-side" aria-hidden="true">
            <div class="am-bg-wrap">
              <img class="am-bg-img" loading="lazy" decoding="async"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZDdNBglJeWrhi1y9jHIye7HIzCaIJI2VjDX-tqDH8dlDCtls8eTrLe8AHu-8QNhXA2j51OpnRpksHOCmzKaSTGRVocinZu_g6kcjHVO-KmmMDRgKY9A5bjPCbTd74_QZ_b4E0mEa3s57hV_8PV1qoIcW1W1-cvoW50XK5HDsQXs-rmyiJQ9-eKURVp0nLXuzjPsJYIuZhEC6Sd_s8ZFgrUF-tG8TeuVUml81zCmnoAmSoX-XdJWNxIPpPGlURk9DNtY--FBNPa9HA"
                alt="">
            </div>
            <div class="am-logo">COMSATS<span style="color: #0ea5e9;">PrepHub</span></div>
            <div class="am-hero">
              <span class="am-sub">Academic Excellence</span>
              <h2 class="am-h1">WELCOME BACK!</h2>
              <p class="am-p">Access your curated prep materials and continue your journey toward academic mastery at COMSATS.</p>
              <div class="am-dots" aria-hidden="true">
                <div class="am-dot active"></div>
                <div class="am-dot"></div>
                <div class="am-dot"></div>
              </div>
            </div>
          </section>

          <section class="am-form-panel">
            <div class="am-wrap">
              <div class="am-m-logo"><div class="am-m-name">COMSATS<span style="color: #0ea5e9;">PrepHub</span></div></div>
              <div class="am-head">
                <h3 class="am-h2" id="auth-modal-title">Login</h3>
                <p class="am-h2-sub">Welcome back to your academic curator.</p>
              </div>

              <form id="am-l-form" novalidate>
                <div class="am-item">
                  <label class="am-label" for="am-l-email">Email Address</label>
                  <div class="am-field">
                    <span class="material-symbols-outlined am-icon" aria-hidden="true">mail</span>
                    <input class="am-in" id="am-l-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
                  </div>
                </div>

                <div class="am-item">
                  <div class="am-label-row">
                    <label class="am-label" for="am-l-pass" style="margin-bottom:0;">Password</label>
                    <a class="am-label-link" href="#">Forgot Password?</a>
                  </div>
                  <div class="am-field">
                    <span class="material-symbols-outlined am-icon" aria-hidden="true">lock</span>
                    <input class="am-in" id="am-l-pass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                    <button class="am-eye" type="button" aria-label="Show or hide password">
                      <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">visibility</span>
                    </button>
                  </div>
                </div>

                <div class="am-check">
                  <input class="am-ck-in" type="checkbox" id="am-rem-in">
                  <label class="am-ck-lbl" for="am-rem-in">Keep me logged in</label>
                </div>

                <button class="am-btn am-b-login" type="submit">
                  <span>Login</span>
                  <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">arrow_forward</span>
                </button>

                <div class="am-sep"><span>or</span></div>

                <button class="am-btn-g" type="button" id="am-google-login" aria-label="Continue with Google">
                  <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" width="18" height="18" loading="lazy" decoding="async" alt="">
                  <span>Sign in with Google</span>
                </button>
              </form>

              <div class="am-swap">Don't have an account? <a href="#" class="am-to-up">Sign Up</a></div>
            </div>
          </section>
        </div>

        <div class="am-panel am-signup">
          <section class="am-side am-s-side" aria-hidden="true">
            <div class="am-bg-wrap">
              <img class="am-bg-img" loading="lazy" decoding="async"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCk3-sOvD_tJohcdxadxtZFJ10l6HyxAbSE4RauxdmJfHf2zs_u4P38ESTUhEgJwACMcTPz6pi5NSGYVW9uobohnmF9gZ2L4ftwzuQ_IVi8C9i5F5nZgsq-49YwZihRSNuU7xyqpNU7wTUnjp265IAJ1xC08Fkzj6pMEq1juhdk208VCUWDAvkIVlKiUvZALMeyoFUi9xXkGA82r8dJkKDLwCujzX1EtT1wGN0dijfpNbSMh1cay34o_4cztvQ85r3FGObPL80zGWU9"
                alt="">
            </div>

            <div class="am-hero">
              <div class="am-line"></div>
              <div class="am-stack">
                <span class="am-sub">Academic Excellence</span>
                <h2 class="am-h1">WELCOME!</h2>
                <p class="am-p">Join the community of scholars at COMSATSPrepHub. Your curated journey to academic mastery starts here.</p>
              </div>
            </div>

            <div class="am-foot-l"><div class="am-logo-n">COMSATS<span style="color: #0ea5e9;">PrepHub</span></div></div>
          </section>

          <section class="am-form-panel">
            <div class="am-wrap">
              <div class="am-m-logo">
                <div style="width:36px;height:3px;background:#006f1d;margin:0 auto 12px;border-radius:999px;"></div>
                <div class="am-m-name" style="color:#5f5e5e;">COMSATS<span style="color: #0ea5e9;">PrepHub</span></div>
              </div>

              <div class="am-head">
                <h3 class="am-h2">Create your account</h3>
                <p class="am-h2-sub">Sign up to access curated study materials and tracking.</p>
              </div>

              <button class="am-btn-g am-btn-g-up" type="button" id="am-google-signup" aria-label="Sign up with Google">
                <img src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" width="18" height="18" loading="lazy" decoding="async" alt="">
                <span>Continue with Google</span>
              </button>

              <div class="am-sep"><span>or email</span></div>

              <form id="am-s-form" novalidate>
                <div class="am-item">
                  <label class="am-label" for="am-s-name">Full Name</label>
                  <div class="am-field">
                    <input class="am-in no-icon" id="am-s-name" name="name" type="text" autocomplete="name" placeholder="John Doe" required>
                  </div>
                </div>

                <div class="am-item">
                  <label class="am-label" for="am-s-email">Email Address</label>
                  <div class="am-field">
                    <input class="am-in no-icon" id="am-s-email" name="email" type="email" autocomplete="email" placeholder="student@university.edu" required>
                  </div>
                </div>

                <div class="am-item">
                  <label class="am-label" for="am-s-pass">Password</label>
                  <div class="am-field">
                    <input class="am-in no-icon" id="am-s-pass" name="password" type="password" autocomplete="new-password" placeholder="••••••••" required>
                    <button class="am-eye" type="button" aria-label="Show or hide password">
                      <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">visibility</span>
                    </button>
                  </div>
                </div>

                <div class="am-check">
                  <input class="am-ck-in" type="checkbox" id="am-acc-in">
                  <label class="am-ck-lbl" for="am-acc-in">I agree to the <a href="terms.html">Terms of Service</a> and <a href="terms.html">Privacy Policy</a>.</label>
                </div>

                <button class="am-btn am-b-signup" type="submit">Create Account</button>
              </form>

              <div class="am-swap">Already have an account? <a href="#" class="am-to-in">Sign In</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Event Wiring
 * ────────────────────────────────────────────────────────────────────────── */
function attachListeners() {
  const overlay = document.getElementById('auth-modal-overlay');
  const authCard = document.getElementById('am-auth');

  const closeButton = document.getElementById('close-auth-modal');
  const loginForm = document.getElementById('am-l-form');
  const signUpForm = document.getElementById('am-s-form');

  closeButton?.addEventListener('click', closeModal);

  overlay?.addEventListener('click', event => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay && !overlay.hidden) {
      closeModal();
    }
  });

  document.querySelectorAll('.am-to-up').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      authCard?.classList.add('toggled');
      focusActiveField('signup');
    });
  });

  document.querySelectorAll('.am-to-in').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      authCard?.classList.remove('toggled');
      focusActiveField('login');
    });
  });

  document.querySelectorAll('.am-eye').forEach(button => {
    button.addEventListener('click', () => {
      const input = button.parentElement?.querySelector('input');
      const icon = button.querySelector('.material-symbols-outlined');
      if (!input || !icon) return;

      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      icon.textContent = show ? 'visibility_off' : 'visibility';
    });
  });

  loginForm?.addEventListener('submit', handleLoginSubmit);
  signUpForm?.addEventListener('submit', handleSignUpSubmit);

  document.getElementById('am-google-login')?.addEventListener('click', handleGoogleAuth);
  document.getElementById('am-google-signup')?.addEventListener('click', handleGoogleAuth);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Auth Handlers
 * ────────────────────────────────────────────────────────────────────────── */
async function handleSignUpSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');

  const name = document.getElementById('am-s-name')?.value ?? '';
  const email = document.getElementById('am-s-email')?.value ?? '';
  const password = document.getElementById('am-s-pass')?.value ?? '';
  const acceptedTerms = !!document.getElementById('am-acc-in')?.checked;

  const validation = validateEmailSignUpInput({
    name,
    email,
    password,
    acceptedTerms
  });

  if (!validation.ok) {
    await notify('Notice', validation.message, 'warning');
    return;
  }

  const originalHtml = submitButton?.innerHTML ?? '';
  setButtonLoading(submitButton, 'Processing...', true);

  try {
    const result = await signUpWithEmail(validation.values);

    if (!result.ok) {
      await notify('Error', result.message, 'error');
      return;
    }

    form.reset();
    await notify('Success!', 'Account created successfully. Please check your email to confirm your account.', 'success');
    closeModal();
  } catch (error) {
    console.error('Sign up unexpected error:', error);
    await notify('Error', 'An unexpected error occurred during sign up.', 'error');
  } finally {
    restoreButton(submitButton, originalHtml);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');

  const email = document.getElementById('am-l-email')?.value ?? '';
  const password = document.getElementById('am-l-pass')?.value ?? '';

  const validation = validateEmailLoginInput({ email, password });

  if (!validation.ok) {
    await notify('Notice', validation.message, 'warning');
    return;
  }

  const originalHtml = submitButton?.innerHTML ?? '';
  setButtonLoading(submitButton, 'Entering...', true);

  try {
    const result = await signInWithEmail(validation.values);

    if (!result.ok) {
      await notify('Error', result.message, 'error');
      return;
    }

    form.reset();
    closeModal();
    redirectToDashboard();
  } catch (error) {
    console.error('Login unexpected error:', error);
    await notify('Error', 'An unexpected error occurred during login.', 'error');
  } finally {
    restoreButton(submitButton, originalHtml);
  }
}

async function handleGoogleAuth(event) {
  event.preventDefault();

  const button = event.currentTarget;
  const originalHtml = button?.innerHTML ?? '';

  setButtonLoading(button, 'Redirecting...', true);

  try {
    const result = await signInWithGoogle();

    if (!result.ok) {
      await notify('Error', result.message, 'error');
    }
    // On success, Supabase normally redirects away automatically.
  } catch (error) {
    console.error('Google Auth unexpected error:', error);
    await notify('Error', 'Could not initiate Google Authentication.', 'error');
  } finally {
    restoreButton(button, originalHtml);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Button Helpers
 * ────────────────────────────────────────────────────────────────────────── */
function setButtonLoading(button, label, withSpinner = true) {
  if (!button) return;

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  
  const span = document.createElement('span');
  span.className = 'flex items-center justify-center gap-2';

  if (withSpinner) {
    const spinner = document.createElement('span');
    spinner.className = 'animate-spin inline-block';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.textContent = '⟳';
    span.appendChild(spinner);
  }

  const text = document.createElement('span');
  text.textContent = label;
  span.appendChild(text);

  button.innerHTML = '';
  button.appendChild(span);
}

function restoreButton(button, html) {
  if (!button) return;
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.innerHTML = html;
}
