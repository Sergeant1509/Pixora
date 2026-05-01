export function firebaseErrorMessage(error) {
  const code = error?.code || '';

  const messages = {
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account was found with this email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/api-key-not-valid': 'Firebase API key is invalid. Check your .env values, then run npm run build and firebase deploy again.',
    'auth/invalid-api-key': 'Firebase API key is invalid. Check your .env values, then run npm run build and firebase deploy again.',
    'auth/operation-not-allowed': 'Email/password login is disabled in Firebase Authentication. Enable it in Sign-in method.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase Authentication settings.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'permission-denied': 'Firebase rejected this request. Check your Firestore security rules.',
    'unavailable': 'Firebase is temporarily unavailable. Try again.'
  };

  return messages[code] || error?.message || 'Something went wrong.';
}

export function cleanText(value = '', max = 1000) {
  return String(value).trim().slice(0, max);
}

export function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate();
  return value;
}
