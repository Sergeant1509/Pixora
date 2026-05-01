export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function setButtonLoading(button, isLoading, label = 'Loading...') {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

export function avatarTemplate(user = {}, sizeClass = '') {
  const name = user.displayName || user.username || user.email || 'U';
  const initial = escapeHTML(name.trim().charAt(0).toUpperCase() || 'U');
  const avatarUrl = user.avatarUrl ? escapeHTML(user.avatarUrl) : '';

  if (avatarUrl) {
    return `<div class="avatar ${sizeClass}" data-initial="${initial}"><img src="${avatarUrl}" alt="${escapeHTML(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove(); this.parentElement.textContent=this.parentElement.dataset.initial || 'U';" /></div>`;
  }

  return `<div class="avatar ${sizeClass}" aria-hidden="true">${initial}</div>`;
}

export function emptyState(title, body) {
  return `
    <div class="empty-state">
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(body)}</span>
    </div>
  `;
}
