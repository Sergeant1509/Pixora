import { $ } from '../utils/dom.js';
import { firebaseErrorMessage } from '../services/firebase.helpers.js';

export function showToast(message, type = 'success') {
  const root = $('#toast-root');
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  window.setTimeout(() => toast.classList.add('show'), 10);
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 220);
  }, 3200);
}

export function friendlyError(error) {
  return firebaseErrorMessage(error);
}
