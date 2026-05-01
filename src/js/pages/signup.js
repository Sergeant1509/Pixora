import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { loginWithGoogle, registerUser } from '../services/auth.service.js';
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
