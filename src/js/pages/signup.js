import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { isUsernameAvailable, loginWithGoogle, registerUser, suggestUsernames } from '../services/auth.service.js';
import { $, setButtonLoading } from '../utils/dom.js';
import { friendlyError, showToast } from '../ui/toast.js';

if (window.location.search) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

let isCreatingAccount = false;

onAuthStateChanged(auth, (user) => {
  if (user && !isCreatingAccount) {
    window.location.replace('/index.html');
  }
});

const usernameInput = $('#username-input');
const usernameStatus = $('#username-status');
const usernameSuggestions = $('#username-suggestions');
let usernameTimer;

usernameInput?.addEventListener('input', () => {
  clearTimeout(usernameTimer);
  const rawValue = usernameInput.value;
  const value = rawValue.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
  if (rawValue !== value) usernameInput.value = value;

  usernameTimer = setTimeout(() => checkUsername(value), 350);
});

async function checkUsername(username) {
  if (!usernameStatus || !usernameSuggestions) return;

  usernameSuggestions.innerHTML = '';

  if (!username || username.length < 3) {
    usernameStatus.textContent = 'Username must be at least 3 characters.';
    usernameStatus.dataset.state = 'neutral';
    return;
  }

  usernameStatus.textContent = 'Checking username...';
  usernameStatus.dataset.state = 'neutral';

  try {
    const available = await isUsernameAvailable(username);

    if (available) {
      usernameStatus.textContent = `@${username} is available.`;
      usernameStatus.dataset.state = 'available';
      return;
    }

    usernameStatus.textContent = `@${username} is already taken.`;
    usernameStatus.dataset.state = 'taken';

    const suggestions = await suggestUsernames(username, 4);
    usernameSuggestions.innerHTML = suggestions.map((item) => `<button type="button" data-username-suggestion="${item}">@${item}</button>`).join('');

    usernameSuggestions.querySelectorAll('[data-username-suggestion]').forEach((button) => {
      button.addEventListener('click', () => {
        usernameInput.value = button.dataset.usernameSuggestion;
        checkUsername(usernameInput.value);
        usernameInput.focus();
      });
    });
  } catch (error) {
    usernameStatus.textContent = 'Could not check username right now.';
    usernameStatus.dataset.state = 'taken';
  }
}

$('#signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));

  setButtonLoading(button, true, 'Creating account...');

  try {
    isCreatingAccount = true;
    await registerUser(data);
    showToast('Account created.');
    window.location.href = '/index.html';
  } catch (error) {
    isCreatingAccount = false;
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

$('#google-signup')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setButtonLoading(button, true, 'Opening Google...');

  try {
    isCreatingAccount = true;
    await loginWithGoogle();
    showToast('Signed in with Google.');
    window.location.href = '/index.html';
  } catch (error) {
    isCreatingAccount = false;
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
});
