import { auth } from '../config/firebase.js';

export function normalizeUsername(username = '') {
  return String(username)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export function normalizeUser(user = {}) {
  const uid = String(user.uid || user.id || user._id || user.userId || '');
  const username = normalizeUsername(user.username || user.handle || user.email?.split('@')[0] || 'user');
  const displayName = String(user.displayName || user.name || user.fullName || username || 'User').trim();

  return {
    ...user,
    uid,
    id: uid,
    displayName,
    username,
    usernameLower: username,
    email: user.email || '',
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || user.avatar || user.photoURL || '',
    coverUrl: user.coverUrl || user.cover || '',
    hideActivity: Boolean(user.hideActivity),
    lastActiveAt: user.lastActiveAt || null,
    theme: user.theme || 'day',
    followersCount: Number(user.followersCount || user.followerCount || 0),
    followingCount: Number(user.followingCount || 0)
  };
}

// Firebase Auth issues a secure ID token, which is a JWT.
// Use this if you later add a Node/Express backend and want to verify Firebase users server-side.
export async function getAccessToken() {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export function getSessionUser() {
  const current = auth.currentUser;
  if (!current) return null;

  return normalizeUser({
    uid: current.uid,
    email: current.email,
    displayName: current.displayName,
    avatarUrl: current.photoURL
  });
}

export function isLoggedIn() {
  return Boolean(auth.currentUser);
}

export function clearSession() {
  // Firebase Auth handles persisted session state.
}

export function setSession() {
  // Kept for compatibility with older backend/JWT service files.
}

export function updateSessionUser() {
  // Firestore user documents are now the source of truth.
}

export async function getAuthHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
