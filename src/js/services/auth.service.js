import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  deleteUser,
  updatePassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { normalizeUser, normalizeUsername } from './token.service.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function registerUser(formData) {
  const displayName = String(formData.displayName || '').trim();
  const username = normalizeUsername(formData.username);
  const email = String(formData.email || '').trim();
  const password = formData.password;

  if (!displayName) throw new Error('Display name is required.');
  if (!username || username.length < 3) throw new Error('Username must be at least 3 characters.');

  if (!(await isUsernameAvailable(username))) {
    const suggestions = await suggestUsernames(username, 3);
    throw new Error(`Username is already taken.${suggestions.length ? ` Try ${suggestions.join(', ')}.` : ''}`);
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    await reserveUsername(username, credential.user.uid);
    await updateProfile(credential.user, { displayName });

    const profile = normalizeUser({
      uid: credential.user.uid,
      displayName,
      username,
      email,
      bio: '',
      avatarUrl: '',
      coverUrl: '',
      hideActivity: false,
      theme: 'day'
    });

    await upsertUserProfile(credential.user.uid, profile, 'password');
    return profile;
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, String(email || '').trim(), password);
  return ensureUserProfile(credential.user);
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return ensureUserProfile(credential.user, 'google');
}

export async function logoutUser() {
  await signOut(auth);
}

export async function changeCurrentUserPassword(newPassword) {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in to change password.');
  await updatePassword(current, String(newPassword || ''));
}

export async function sendResetPasswordEmail(email) {
  const targetEmail = String(email || auth.currentUser?.email || '').trim();
  if (!targetEmail) throw new Error('No email found for password reset.');
  await sendPasswordResetEmail(auth, targetEmail);
}

export async function deleteCurrentUserAccount() {
  const current = auth.currentUser;
  if (!current) throw new Error("You must be signed in to delete your account.");
  await deleteDoc(doc(db, "users", current.uid));
  await deleteUser(current);
}

export function listenToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      callback(await ensureUserProfile(firebaseUser));
    } catch (error) {
      console.error('Unable to load Firestore profile:', error);
      callback(normalizeUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        avatarUrl: firebaseUser.photoURL
      }));
    }
  });
}

export async function getCurrentUser() {
  return auth.currentUser ? ensureUserProfile(auth.currentUser) : null;
}

async function ensureUserProfile(firebaseUser, provider = '') {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existingProfile = normalizeUser({ uid: snap.id, ...snap.data() });
    reserveUsername(existingProfile.username, existingProfile.uid).catch(() => {});
    return existingProfile;
  }

  const emailName = firebaseUser.email?.split('@')[0] || 'user';
  const fallbackUsername = await makeUniqueUsername(`${normalizeUsername(emailName).slice(0, 14) || 'user'}${firebaseUser.uid.slice(0, 5).toLowerCase()}`, firebaseUser.uid);
  const fallback = normalizeUser({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || emailName || 'User',
    username: fallbackUsername,
    avatarUrl: firebaseUser.photoURL || '',
    coverUrl: '',
    bio: '',
    hideActivity: false,
    theme: 'day'
  });

  await reserveUsername(fallback.username, firebaseUser.uid);
  await upsertUserProfile(firebaseUser.uid, fallback, provider || 'firebase');
  return fallback;
}

export async function isUsernameAvailable(username) {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3) return false;
  const snapshot = await getDoc(doc(db, 'usernames', normalized));
  return !snapshot.exists();
}

export async function suggestUsernames(username, count = 4) {
  const base = normalizeUsername(username).slice(0, 15) || 'pixora';
  const cleanedBase = base.length >= 3 ? base : `${base}user`.slice(0, 15);
  const suggestions = [];
  const tried = new Set();
  let attempt = 0;

  while (suggestions.length < count && attempt < 30) {
    attempt += 1;
    const suffix = attempt < 8 ? String(Math.floor(10 + Math.random() * 89)) : String(Math.floor(100 + Math.random() * 8999));
    const candidate = normalizeUsername(`${cleanedBase}${suffix}`).slice(0, 20);
    if (tried.has(candidate) || candidate.length < 3) continue;
    tried.add(candidate);
    if (await isUsernameAvailable(candidate)) suggestions.push(candidate);
  }

  return suggestions;
}

async function reserveUsername(username, uid) {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3) throw new Error('Choose a valid username.');

  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', normalized);
    const snapshot = await transaction.get(usernameRef);

    if (snapshot.exists() && snapshot.data()?.uid !== uid) {
      throw new Error('Username is already taken.');
    }

    transaction.set(usernameRef, {
      uid,
      username: normalized,
      updatedAt: serverTimestamp(),
      createdAt: snapshot.exists() ? snapshot.data()?.createdAt || serverTimestamp() : serverTimestamp()
    }, { merge: true });
  });
}

async function makeUniqueUsername(seed, uid) {
  const base = normalizeUsername(seed).slice(0, 14) || 'user';
  const candidates = [base, `${base}${uid.slice(0, 4).toLowerCase()}`, `${base}${uid.slice(0, 6).toLowerCase()}`];

  for (const candidate of candidates) {
    if (await isUsernameAvailable(candidate)) return candidate;
  }

  const suggestions = await suggestUsernames(base, 1);
  return suggestions[0] || `${base}${Date.now().toString().slice(-4)}`.slice(0, 20);
}

async function upsertUserProfile(uid, profile, provider) {
  await setDoc(doc(db, 'users', uid), {
    ...profile,
    provider,
    postCount: 0,
    hideActivity: Boolean(profile.hideActivity),
    theme: profile.theme || 'day',
    lastActiveAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
