import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  deleteUser,
  updateProfile
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
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

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });

  const profile = normalizeUser({
    uid: credential.user.uid,
    displayName,
    username,
    email,
    bio: '',
    avatarUrl: ''
  });

  await upsertUserProfile(credential.user.uid, profile, 'password');
  return profile;
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
    return normalizeUser({ uid: snap.id, ...snap.data() });
  }

  const emailName = firebaseUser.email?.split('@')[0] || 'user';
  const fallback = normalizeUser({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || emailName || 'User',
    username: `${normalizeUsername(emailName).slice(0, 14) || 'user'}${firebaseUser.uid.slice(0, 5).toLowerCase()}`,
    avatarUrl: firebaseUser.photoURL || '',
    bio: ''
  });

  await upsertUserProfile(firebaseUser.uid, fallback, provider || 'firebase');
  return fallback;
}

async function upsertUserProfile(uid, profile, provider) {
  await setDoc(doc(db, 'users', uid), {
    ...profile,
    provider,
    postCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
