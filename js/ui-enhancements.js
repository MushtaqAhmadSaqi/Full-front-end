/**
 * js/ui-enhancements.js
 * Safe additive frontend enhancements for COMSATSPrepHub.
 * No backend logic. No Supabase writes. No quiz scoring changes.
 */

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

document.addEventListener('DOMContentLoaded', () => {
  markPageReady();
  enhanceCurrentNavigation();
  protectMobileBottomSpacing();
  enhanceTables();
  enhanceStatusRegions();
  enhanceExternalSafety();
  enhanceFormValidationHints();
  enhanceEmptyStates();
  enhanceGeneratedCards();
});

window.addEventListener('resize', debounce(protectMobileBottomSpacing, 160));

function markPageReady() {
  document.documentElement.classList.add('ui-enhancements-ready');
}

function enhanceCurrentNavigation() {
  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const linkPath = normalizePath(new URL(href, window.location.href).pathname);

    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
      link.classList.add('is-current-page');
    }
  });
}

function protectMobileBottomSpacing() {
  const mobileNav =
    document.getElementById('app-mobile-nav') ||
    document.querySelector('.mobile-bottom-nav, .bottom-nav, [data-mobile-nav]');

  if (!mobileNav) return;

  const navHeight = Math.ceil(mobileNav.getBoundingClientRect().height || 0);

  if (navHeight > 0) {
    document.documentElement.style.setProperty('--mobile-nav-safe-space', `${navHeight + 24}px`);
    document.body.classList.add('has-mobile-bottom-nav');
  }
}

function enhanceTables() {
  document.querySelectorAll('table').forEach(table => {
    if (table.closest('.responsive-table-wrap')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'responsive-table-wrap';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function enhanceStatusRegions() {
  const statusSelectors = [
    '#feedbackMessage',
    '#subjectsCount',
    '#currentQuestion',
    '#questionCounter',
    '#progressText',
    '#keyStatus',
    '#terminalOutput',
    '.terminal-output',
    '.admin-terminal-output'
  ];

  statusSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
      if (!el.hasAttribute('aria-atomic')) el.setAttribute('aria-atomic', 'true');
    });
  });

  document.querySelectorAll('.error, .error-message, .alert-error, [data-error]').forEach(el => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'alert');
  });
}

function enhanceExternalSafety() {
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  });
}

function enhanceFormValidationHints() {
  document.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('invalid', () => {
      field.classList.add('is-invalid');

      const group = field.closest('.form-group, .field, .admin-field-group');
      group?.classList.add('has-invalid-field');
    });

    field.addEventListener('input', () => {
      if (field.checkValidity()) {
        field.classList.remove('is-invalid');

        const group = field.closest('.form-group, .field, .admin-field-group');
        group?.classList.remove('has-invalid-field');
      }
    });
  });
}

function enhanceEmptyStates() {
  document.querySelectorAll('.empty-state, .no-results, .no-data').forEach(emptyState => {
    emptyState.classList.add('ui-empty-state-enhanced');

    const hasAction = emptyState.querySelector('a, button');
    if (hasAction) return;

    const page = getPageName();

    if (page === 'subjects.html') {
      emptyState.appendChild(createActions([
        { href: 'upload.html', label: 'Upload Past Paper', variant: 'primary', icon: 'cloud_upload' },
        { href: 'quiz.html', label: 'Practice Quiz', variant: 'secondary' }
      ]));
    }

    if (page === 'subject-papers.html') {
      emptyState.appendChild(createActions([
        { href: 'upload.html', label: 'Upload Paper', variant: 'primary', icon: 'cloud_upload' },
        { href: 'subjects.html', label: 'Browse Subjects', variant: 'secondary' }
      ]));
    }

    if (page === 'dashboard.html') {
      emptyState.appendChild(createActions([
        { href: 'quiz.html', label: 'Take Quiz', variant: 'primary', icon: 'play_arrow' },
        { href: 'subjects.html', label: 'Browse Subjects', variant: 'secondary' }
      ]));
    }
  });
}

function enhanceGeneratedCards() {
  const cardSelectors = [
    '.subject-card',
    '.paper-card',
    '.quiz-card',
    '.dashboard-card',
    '.stat-card',
    '.activity-item',
    '.weak-topic-item',
    '.mastery-item'
  ];

  document.querySelectorAll(cardSelectors.join(',')).forEach(card => {
    card.classList.add('ui-generated-card');

    if (card.matches('a, button')) return;

    const innerLink = card.querySelector('a[href]');
    if (innerLink) {
      card.classList.add('has-inner-link');
    }
  });
}

function createActions(actions) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state-actions';

  actions.forEach(action => {
    const link = document.createElement('a');
    link.href = action.href;
    link.className = action.variant === 'primary' ? 'btn-primary' : 'btn-secondary';

    if (action.icon) {
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = action.icon;
      link.appendChild(icon);
    }

    link.appendChild(document.createTextNode(action.label));
    wrap.appendChild(link);
  });

  return wrap;
}

function normalizePath(pathname) {
  const clean = pathname.split('/').pop() || 'index.html';
  return clean.toLowerCase();
}

function getPageName() {
  return normalizePath(window.location.pathname);
}

function debounce(callback, wait = 150) {
  let timeout;

  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}
