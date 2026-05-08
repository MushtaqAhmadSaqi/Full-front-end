export { SUPABASE_URL, SUPABASE_KEY, supabase, auth, escapeHtml } from './core.js';

// Save helper - call from any page: saveItem({title, type, subject, url, description})
export function saveItem(item) {
  if (!item || !item.title) {
    console.warn('saveItem: invalid item — title required');
    return;
  }

  const normalized = {
    title: item.title,
    type: item.type || 'Resource',
    subject: item.subject || 'General',
    description: item.description || item.desc || '',
    url: item.url || '',
    savedAt: new Date().toISOString()
  };

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('comsats-saved') || '[]');
  } catch (_) {
    saved = [];
  }

  // Deduplicate by url or title
  const exists = saved.some(s => (s.url && s.url === normalized.url) || s.title === normalized.title);
  if (!exists) {
    saved.unshift(normalized); // newest first
    localStorage.setItem('comsats-saved', JSON.stringify(saved));

    // Same-tab update trigger (ensures dashboard reflects changes immediately)
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'comsats-saved' }));
    } catch (_) { /* StorageEvent constructor not supported in all envs */ }

    // Optional toast
    if (typeof window.showToast === 'function') {
      window.showToast('Saved to your COMSATS dashboard!', 'success');
    }
  }
}
