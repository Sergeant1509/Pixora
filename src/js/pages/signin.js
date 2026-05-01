import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { loginUser, loginWithGoogle } from '../services/auth.service.js';
import { $, setButtonLoading } from '../utils/dom.js';
import { friendlyError, showToast } from '../ui/toast.js';

if (window.location.search) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

onAuthStateChanged(auth, (user) => {
  if (user) window.location.replace('/index.html');
});

$('#signin-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));

  setButtonLoading(button, true, 'Signing in...');

  try {
    await loginUser(data.email, data.password);
    showToast('Signed in successfully.');
    window.location.href = '/index.html';
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

$('#google-signin')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setButtonLoading(button, true, 'Opening Google...');

  try {
    await loginWithGoogle();
    showToast('Signed in with Google.');
    window.location.href = '/index.html';
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    setButtonLoading(button, false);
  }
});
