export { SUPABASE_URL, SUPABASE_KEY, supabase, auth, escapeHtml } from './core.js';

// Save helper - call from any page: saveItem({title, type, subject, url, description})
export function saveItem(item) {
  let saved = JSON.parse(localStorage.getItem('comsats-saved') || '[]');
  // Prevent duplicates
  const exists = saved.some(s => s.url === item.url);
  if (!exists) {
    saved.unshift(item); // newest first
    localStorage.setItem('comsats-saved', JSON.stringify(saved));
    // Optional toast
    if (typeof showToast === 'function') {
      showToast('Item saved to Dashboard!', 'success');
    }
  }
}
