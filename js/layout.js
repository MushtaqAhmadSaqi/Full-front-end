/**
 * js/layout.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Injects the shared Header, Footer, and Mobile Bottom Nav into every page.
 * Handles: premium glassmorphism pill, session-aware buttons,
 * dark mode sync, and scroll transitions.
 */

import { auth } from './core.js';
import { initAuthModal, openModal } from './auth-ui.js';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const shouldSaveData = () => !!connection?.saveData;
const isSlowConnection = () => /(^|-)2g$/.test(connection?.effectiveType || '');
const canUseTilt = () => {
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const enoughPower = (navigator.hardwareConcurrency || 4) >= 4;
  return hasFinePointer && enoughPower && !prefersReducedMotion() && !shouldSaveData() && !isSlowConnection();
};

const runIdle = (callback, timeout = 1200) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    window.setTimeout(callback, 220);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  let session = null;
  let userName = null;

  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  try {
    session = await auth.getSession();
    userName = session ? auth.getUserName(session.user) : null;
  } catch (error) {
    console.warn('Auth failed, layout will still load:', error);
  }

  _hydrateLayout(currentPage, session, userName);

  try {
    initAuthModal();
  } catch (error) {
    console.warn('Auth modal failed:', error);
  }

  _bindThemeLogoSync();
  _initAOS();
  _initImagePreview();

  // Safety net: if AOS.js never loads (slow/offline), force all elements
  // visible after 3 seconds so the page never looks broken.
  setTimeout(() => {
    if (typeof window.AOS === 'undefined') {
      document.body.classList.add('aos-fallback-active');
    }
  }, 3000);

  runIdle(() => {
    _initVanillaTilt();
    _initSwipeNav(currentPage);
    _initScrollHideNav();
  });
});

async function _hydrateLayout(currentPage, session, userName) {
  _ensureMainTarget();
  _injectSkipLink();
  _injectHeaderCriticalCSS();
  _injectHeader(currentPage, session, userName);
  _injectGlobalFeedbackBox();
  _injectFooter();
  _injectMobileNav(currentPage);
  _injectFeedbackContainer();
  _wireNavButton(session);

  if (window.refreshThemeIcons) window.refreshThemeIcons();
}

function _loadScript(src, { id, defer = true } = {}) {
  if (id && document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    if (id) script.id = id;
    script.src = src;
    script.defer = defer;
    script.onload = () => resolve(script);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function _revealAosElements() {
  document.querySelectorAll('[data-aos]').forEach(el => el.classList.add('aos-animate'));
}

function _initAOS() {
  if (!document.querySelector('[data-aos]')) return;
  if (prefersReducedMotion() || shouldSaveData() || isSlowConnection()) {
    _revealAosElements();
    return;
  }
  if (typeof window.AOS !== 'undefined') {
    window.AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 42, disable: false });
    return;
  }

  // Load AOS if not already present
  _loadScript('https://unpkg.com/aos@next/dist/aos.js', { id: 'aos-script' })
    .then(() => {
      if (typeof window.AOS !== 'undefined') {
        window.AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 42, disable: false });
      }
    })
    .catch(error => {
      console.warn('AOS failed to load. Revealing elements.', error);
      _revealAosElements();
    });
}

function _initImagePreview() {
  const images = document.querySelectorAll('.ghost-card img, .founder-card-tw img, .contributor-card img');
  if (images.length === 0) return;

  let overlay = document.getElementById('image-preview-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'image-preview-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="image-preview-content">
        <button class="image-preview-close" aria-label="Close preview">
          <span class="material-symbols-outlined">close</span>
        </button>
        <img src="" alt="" class="image-preview-img">
        <div class="image-preview-caption"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeHandler = () => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.image-preview-close')) {
        closeHandler();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeHandler();
      }
    });
  }

  const previewImg = overlay.querySelector('.image-preview-img');
  const caption = overlay.querySelector('.image-preview-caption');

  images.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.title = 'Click to view full image';

    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      previewImg.src = img.src;
      previewImg.alt = img.alt;

      const parentCard = img.closest('.ghost-card, .founder-card-tw, .contributor-card');
      const nameElement = parentCard?.querySelector('p.font-bold, h3');
      caption.textContent = nameElement ? nameElement.textContent : img.alt;

      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });
}

function _ensureMainTarget() {
  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main-content';
  }
}

function _injectSkipLink() {
  if (document.getElementById('skip-to-content')) return;

  const main = document.querySelector('main');
  if (!main) return;
  if (!main.id) main.id = 'main-content';

  document.body.insertAdjacentHTML(
    'afterbegin',
    `<a id="skip-to-content" href="#${main.id}" class="skip-link">Skip to content</a>`
  );
}

function _getBasePath() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/comsatsgpa') || path.includes('/campus-map') || path.includes('/campus-memories')) {
    return '../';
  }
  return '';
}

function _injectHeaderCriticalCSS() {
  if (document.getElementById('header-critical-css')) return;

  const style = document.createElement('style');
  style.id = 'header-critical-css';

  style.textContent = `
    .desktop-nav-force {
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: rgba(243, 244, 246, 0.65);
      border: 1px solid rgba(229, 231, 235, 0.75);
      border-radius: 999px;
      padding: 4px;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      white-space: nowrap;
    }

    .desktop-nav-force a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 20px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .desktop-nav-force a.nav-active {
      background: #ffffff;
      color: #2563eb;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
    }

    .desktop-nav-force a.nav-normal {
      color: #4b5563;
    }

    .desktop-nav-force a.nav-normal:hover {
      background: rgba(255, 255, 255, 0.75);
      color: #111827;
    }

    .dark .desktop-nav-force {
      background: rgba(0, 0, 0, 0.25);
      border-color: rgba(255, 255, 255, 0.08);
    }

    .dark .desktop-nav-force a.nav-active {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }

    .dark .desktop-nav-force a.nav-normal {
      color: #cbd5e1;
    }

    .dark .desktop-nav-force a.nav-normal:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    @media (max-width: 767px) {
      .desktop-nav-force {
        display: none !important;
      }
    }

    @media (max-width: 1024px) {
      .desktop-nav-force a {
        padding: 8px 14px;
        font-size: 13px;
      }
    }
  `;

  document.head.appendChild(style);
}

function _injectHeader(currentPage, session, userName) {
  const container = document.getElementById('app-header');

  const isLoggedIn = !!session;
  const initial = userName ? userName.charAt(0).toUpperCase() : '?';

  const isHomeActive = currentPage === 'index.html' || currentPage === '';
  const isSubjectsActive = ['subjects.html', 'subject-papers.html', 'paper-view.html'].includes(currentPage);
  const isQuizActive = currentPage === 'quiz.html';
  const isTeamActive = ['about-us.html', 'team.html'].includes(currentPage);

  const base = _getBasePath();
  const isDark = document.documentElement.classList.contains('dark');

  const activeClass = 'nav-active';
  const normalClass = 'nav-normal';

  const html = `
    <header id="site-header" class="sticky top-0 z-50 transition-all duration-300 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-gray-200/50 dark:border-white/10 rounded-[1.5rem] shadow-xl px-3 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-300">

          <a href="${base}index.html" class="logo-box no-underline flex-shrink-0" aria-label="Go to home page">
            <img src="${base}${isDark ? 'Dlogo.png' : 'logo.png'}" alt="Website Logo" class="site-logo">
          </a>

            <div class="hidden sm:flex items-baseline">
              <span class="font-black text-xl tracking-tighter text-[#1a1a2e] dark:text-white">COMSATS</span>
              <span class="font-bold text-xl tracking-tighter text-blue-600 dark:text-blue-400">PrepHub</span>
            </div>

            <div class="sm:hidden flex items-baseline">
              <span class="font-black text-lg tracking-tighter text-[#1a1a2e] dark:text-white">COMSATS</span>
            </div>
          </a>

          <nav class="desktop-nav-force" aria-label="Primary">

            <a href="${base}index.html"
               class="${isHomeActive ? activeClass : normalClass}">
              Home
            </a>

            <a href="${base}subjects.html"
               class="${isSubjectsActive ? activeClass : normalClass}">
              Subjects
            </a>

            <a href="${base}quiz.html"
               class="${isQuizActive ? activeClass : normalClass}">
              Quiz
            </a>

            <a href="${base}about-us.html"
               class="${isTeamActive ? activeClass : normalClass}">
              Team
            </a>

          </nav>

          <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
            <button id="dark-mode-toggle"
                    class="flex items-center justify-center w-11 h-11 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-gray-600 dark:text-gray-300"
                    type="button"
                    aria-label="Toggle dark mode">
              <span class="dark-mode-icon block w-5 h-5 flex items-center justify-center" aria-hidden="true"></span>
            </button>

            ${isLoggedIn ? `
              <div class="relative">
                <button id="open-auth-modal"
                        class="flex items-center justify-center w-11 h-11 rounded-full bg-blue-600 dark:bg-white hover:bg-blue-700 dark:hover:bg-gray-100 text-white dark:text-[#1e1e2e] transition-all active:scale-95 shadow-md"
                        type="button"
                        aria-label="Dashboard menu"
                        aria-haspopup="true"
                        aria-expanded="false">
                  <span class="text-sm font-black">${initial}</span>
                </button>

                <div id="dashboard-dropdown"
                     class="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-white/10 py-2 z-50">
                  
                  <a href="${base}dashboard.html"
                     class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 no-underline">
                    <span class="material-symbols-outlined text-[18px]">dashboard</span>
                    Dashboard
                  </a>

                  <button id="logout-btn"
                          class="w-full text-left px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>

                </div>
              </div>
            ` : `
              <button id="open-auth-modal"
                      class="flex items-center gap-2 bg-blue-600 dark:bg-white hover:bg-blue-700 dark:hover:bg-gray-100 text-white dark:text-[#1e1e2e] px-3 sm:px-5 py-2.5 sm:py-3 rounded-full text-xs font-bold transition-all active:scale-95 shadow-md"
                      type="button"
                      aria-label="Open sign in dialog">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">person</span>
                <span class="hidden sm:inline">Sign In</span>
              </button>
            `}
          </div>

        </div>
      </div>
    </header>
  `;

  if (container) {
    container.innerHTML = html;
  } else {
    const oldHeader = document.getElementById('site-header');

    if (oldHeader) {
      oldHeader.outerHTML = html;
    } else {
      document.body.insertAdjacentHTML('afterbegin', html);
    }
  }
}

function _injectMobileNav(currentPage) {
  const container = document.getElementById('app-mobile-nav');
  if (!container && document.getElementById('mobileBottomNav')) return;

  const isHomeActive = currentPage === 'index.html' || currentPage === '';
  const isSubjectsActive = ['subjects.html', 'subject-papers.html', 'paper-view.html'].includes(currentPage);
  const isQuizActive = currentPage === 'quiz.html';
  const isTeamActive = ['about-us.html', 'team.html'].includes(currentPage);

  const base = _getBasePath();
  const isDark = document.documentElement.classList.contains('dark');

  const html = `
    <nav id="mobileBottomNav" aria-label="Mobile navigation" class="mobile-nav-shell">
      <div class="mobile-nav-grid">

        <a href="${base}index.html" class="mobile-nav-item ${isHomeActive ? 'active' : ''}">
          <span class="material-symbols-outlined">home</span>
          <span class="label">Home</span>
        </a>

        <a href="${base}subjects.html" class="mobile-nav-item ${isSubjectsActive ? 'active' : ''}">
          <span class="material-symbols-outlined">menu_book</span>
          <span class="label">Subjects</span>
        </a>

        <a href="${base}quiz.html" class="mobile-nav-item ${isQuizActive ? 'active' : ''}">
          <span class="material-symbols-outlined">quiz</span>
          <span class="label">Quiz</span>
        </a>

        <a href="${base}about-us.html" class="mobile-nav-item ${isTeamActive ? 'active' : ''}">
          <span class="material-symbols-outlined">groups</span>
          <span class="label">Team</span>
        </a>

      </div>
    </nav>
  `;

  if (container) {
    container.innerHTML = html;
  } else {
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const nav = document.getElementById('mobileBottomNav');

  if (nav) {
    nav.style.display = '';
    nav.classList.remove('nav-hidden');
    nav.style.transform = '';
  }
}

function _injectGlobalFeedbackBox() {
  if (document.getElementById('globalFeedbackBox')) return;
  const box = document.createElement('div');
  box.id = 'globalFeedbackBox';
  box.className = 'hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sticky top-[72px] z-40 transition-all duration-300';
  box.innerHTML = `
    <div id="globalFeedbackInner" class="rounded-2xl border px-6 py-4 text-sm font-medium leading-relaxed shadow-lg flex items-center justify-between gap-4 transition-all duration-300">
      <div id="globalFeedbackContent" class="flex items-center gap-3"></div>
      <button onclick="window.updateGlobalFeedback({ hidden: true })" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
        <span class="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  `;
  // Insert after header
  const header = document.querySelector('header');
  if (header) {
    header.insertAdjacentElement('afterend', box);
  } else {
    document.body.prepend(box);
  }
}

/**
 * Updates the global feedback banner.
 * @param {Object} options { type, message, hidden, duration }
 */
window.updateGlobalFeedback = function ({ type = 'info', message = '', hidden = false, duration = 0 }) {
  const box = document.getElementById('globalFeedbackBox');
  const inner = document.getElementById('globalFeedbackInner');
  const content = document.getElementById('globalFeedbackContent');
  if (!box || !inner || !content) return;

  if (hidden) {
    box.classList.add('hidden');
    return;
  }

  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400'
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  inner.className = `rounded-2xl border px-6 py-4 text-sm font-medium leading-relaxed shadow-lg flex items-center justify-between gap-4 transition-all duration-300 ${styles[type] || styles.info}`;
  content.innerHTML = `
    <span class="material-symbols-outlined">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;

  box.classList.remove('hidden');

  if (duration > 0) {
    setTimeout(() => {
      box.classList.add('hidden');
    }, duration);
  }
};

function _injectFeedbackContainer() {
  if (document.getElementById('feedback-container')) return;
  const container = document.createElement('div');
  container.id = 'feedback-container';
  container.className = 'fixed top-6 right-6 z-[100] flex flex-col items-end pointer-events-none w-full sm:w-auto px-6 overflow-hidden';
  document.body.appendChild(container);
}

function _injectFooter() {
  const container = document.getElementById('app-footer');
  if (!container && document.querySelector('footer')) return;

  const base = _getBasePath();
  const isDark = document.documentElement.classList.contains('dark');

  const html = `
    <footer class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/5 py-6 px-4 sm:px-6 transition-colors duration-300 rounded-t-[1.5rem]">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div class="space-y-0">
          <div class="flex items-center gap-2">
            <a href="${base}index.html" class="logo-box">
               <img src="${base}${isDark ? 'Dlogo.png' : 'logo.png'}" alt="" class="site-logo" style="width: 70px;">
            </a>
            <div class="font-black text-sm tracking-tight text-[#1a1a2e] dark:text-white">COMSATS<span class="text-blue-600 dark:text-blue-400">PrepHub</span></div>
          </div>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Verified academic resources.</p>
        </div>
        <div class="flex items-center justify-center gap-4">
          <a href="${base}about-us.html" class="nav-link-premium text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors">About</a>
          <a href="${base}terms.html" class="nav-link-premium text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors">Terms</a>
          <a href="https://github.com/MushtaqAhmadSaqi" target="_blank" rel="noopener noreferrer" class="nav-link-premium text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors">Github</a>
        </div>
        <div class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest opacity-60">
          © 2026
        </div>
      </div>
    </footer>
  `;

  if (container) {
    container.innerHTML = html;
  } else {
    document.body.insertAdjacentHTML('beforeend', html);
  }
}

function _wireNavButton(session) {
  const button = document.getElementById('open-auth-modal');
  if (!button) return;

  if (session) {
    // Toggle dropdown on click
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = document.getElementById('dashboard-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('hidden');
        button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('dashboard-dropdown');
      if (dropdown && !dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
        dropdown.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    // Handle logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await auth.signOut();
          window.location.href = 'index.html';
        } catch (error) {
          console.error('Logout failed:', error);
          window.location.href = 'index.html';
        }
      });
    }
  } else {
    button.addEventListener('click', event => {
      event.preventDefault();
      openModal();
    });
  }
}

function _getSwipeRoutes() {
  return ['index.html', 'subjects.html', 'quiz.html', 'about-us.html'];
}

function _isTouchDevice() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

function _isModalOpen() {
  const overlay = document.getElementById('auth-modal-overlay');
  return !!overlay && !overlay.hidden;
}

function _isQuizInteractiveState() {
  const step2 = document.getElementById('step2-question');
  const step3 = document.getElementById('step3-results');
  return (
    (step2 && !step2.classList.contains('hidden')) ||
    (step3 && !step3.classList.contains('hidden')) ||
    document.body.classList.contains('quiz-active')
  );
}

function _hasHorizontalScrollableAncestor(target, root) {
  let node = target instanceof Element ? target : null;

  while (node && node !== root && node !== document.body) {
    if (node.id === 'statsRow') return true;

    const style = window.getComputedStyle(node);
    const canScrollX = /(auto|scroll)/.test(style.overflowX);

    if (canScrollX && node.scrollWidth > node.clientWidth + 8) {
      return true;
    }

    node = node.parentElement;
  }

  return false;
}

function _shouldIgnoreSwipeStart(target, root) {
  if (!(target instanceof Element)) return false;

  if (
    target.closest(
      'a,button,input,textarea,select,label,[role="button"],[contenteditable="true"],summary,[data-disable-swipe-nav]'
    )
  ) {
    return true;
  }

  if (_hasHorizontalScrollableAncestor(target, root)) {
    return true;
  }

  return false;
}

function _initSwipeNav(currentPage) {
  if (!_isTouchDevice()) return;
  if (window.innerWidth > 1024) return;

  // Disable completely on pages where swipe navigation is too risky
  if (currentPage === 'paper-view.html' || currentPage === 'subject-papers.html') return;

  const routes = _getSwipeRoutes();
  const currentIndex = routes.findIndex(route => route === currentPage);
  if (currentIndex === -1) return;

  const main = document.querySelector('main');
  if (!main) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let ignoreGesture = false;
  let tracking = false;

  main.addEventListener('touchstart', event => {
    if (!event.changedTouches || event.changedTouches.length !== 1) {
      ignoreGesture = true;
      tracking = false;
      return;
    }

    if (_isModalOpen()) {
      ignoreGesture = true;
      tracking = false;
      return;
    }

    if (currentPage === 'quiz.html' && _isQuizInteractiveState()) {
      ignoreGesture = true;
      tracking = false;
      return;
    }

    const target = event.target;
    ignoreGesture = _shouldIgnoreSwipeStart(target, main);
    tracking = !ignoreGesture;

    if (!tracking) return;

    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });

  main.addEventListener('touchend', event => {
    if (!tracking || ignoreGesture) return;
    if (!event.changedTouches || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Require a strong horizontal gesture
    if (Math.abs(dx) <= Math.abs(dy) * 1.35) return;
    if (Math.abs(dx) < 90) return;

    const direction = dx < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(currentIndex + direction, routes.length - 1));

    if (nextIndex !== currentIndex) {
      window.location.href = routes[nextIndex];
    }
  }, { passive: true });
}

function _initScrollHideNav() {
  const header = document.querySelector('header');
  const bottomNav = document.getElementById('mobileBottomNav');

  if (!header && !bottomNav) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const showChrome = () => {
    if (header) header.classList.remove('header-hidden');
    if (bottomNav) bottomNav.classList.remove('nav-hidden');
  };

  const hideChrome = () => {
    if (header) header.classList.add('header-hidden');
    if (bottomNav) bottomNav.classList.add('nav-hidden');
  };

  showChrome();

  window.addEventListener('scroll', () => {
    if (ticking) return;

    ticking = true;

    window.requestAnimationFrame(() => {
      const current = window.scrollY;
      const delta = current - lastScrollY;

      if (current < 24 || _isModalOpen()) {
        showChrome();
        lastScrollY = current;
        ticking = false;
        return;
      }

      if (Math.abs(delta) < 10) {
        ticking = false;
        return;
      }

      if (delta > 0 && current > 120) {
        hideChrome();
      } else {
        showChrome();
      }

      lastScrollY = current;
      ticking = false;
    });
  }, { passive: true });
}

function _initVanillaTilt() {
  if (!canUseTilt()) return;
  if (!document.querySelector('.card-hover')) return;

  const applyTilt = () => {
    if (typeof window.VanillaTilt === 'undefined') return;
    window.VanillaTilt.init(document.querySelectorAll('.card-hover'), {
      max: 8,
      speed: 600,
      glare: true,
      'max-glare': 0.12,
      scale: 1.02
    });
  };

  if (typeof window.VanillaTilt !== 'undefined') {
    runIdle(applyTilt);
    return;
  }

  runIdle(async () => {
    try {
      await _loadScript('https://cdn.jsdelivr.net/npm/vanilla-tilt@1.7.2/dist/vanilla-tilt.min.js', {
        id: 'vanilla-tilt-script'
      });
      applyTilt();
    } catch (error) {
      console.warn('VanillaTilt failed to load.', error);
    }
  });
}

window.reinitVanillaTilt = () => {
  if (!canUseTilt() || typeof window.VanillaTilt === 'undefined') return;
  window.VanillaTilt.init(document.querySelectorAll('.card-hover'), {
    max: 8,
    speed: 600,
    glare: true,
    'max-glare': 0.12,
    scale: 1.02
  });
};

function _bindThemeLogoSync() {
  document.addEventListener('comsatsprephub:themechange', (e) => {
    const isDark = e.detail.theme === 'dark';
    document.querySelectorAll('.site-logo').forEach(img => {
      const currentSrc = img.getAttribute('src') || '';
      const base = currentSrc.includes('../') ? '../' : '';
      img.src = isDark ? `${base}Dlogo.png` : `${base}logo.png`;
    });
  });
}
