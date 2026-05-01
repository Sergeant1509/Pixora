import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { normalizeUser, normalizeUsername } from './token.service.js';
import { cleanText } from './firebase.helpers.js';

export function listenToUser(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    callback(snapshot.exists() ? normalizeUser({ uid: snapshot.id, ...snapshot.data() }) : null);
  }, () => callback(null));
}

export async function getUserById(uid) {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? normalizeUser({ uid: snapshot.id, ...snapshot.data() }) : null;
  } catch (error) {
    console.error('Could not load user profile:', error);
    return null;
  }
}

export async function getUserByUsername(username) {
  const usernameLower = normalizeUsername(username);
  if (!usernameLower) return null;

  try {
    const usersQuery = query(collection(db, 'users'), where('usernameLower', '==', usernameLower), limit(1));
    const snapshot = await getDocs(usersQuery);
    if (snapshot.empty) return null;
    const row = snapshot.docs[0];
    return normalizeUser({ uid: row.id, ...row.data() });
  } catch (error) {
    console.error('Could not load username profile:', error);
    return null;
  }
}

export function listenToUsers(currentUid, callback) {
  const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(usersQuery, (snapshot) => {
    const users = snapshot.docs
      .map((row) => normalizeUser({ uid: row.id, ...row.data() }))
      .filter((user) => user.uid && user.uid !== currentUid && !user.setup);

    callback(users);
  }, () => callback([]));
}

export async function updateUserProfile(uid, data) {
  const user = normalizeUser({
    uid,
    displayName: cleanText(data.displayName, 32),
    username: normalizeUsername(data.username),
    bio: cleanText(data.bio, 180),
    avatarUrl: cleanText(data.avatarUrl, 420000),
    coverUrl: cleanText(data.coverUrl, 540000)
  });

  await updateDoc(doc(db, 'users', uid), {
    displayName: user.displayName,
    username: user.username,
    usernameLower: user.usernameLower,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    updatedAt: serverTimestamp()
  });

  return user;
}


export async function updateUserMeta(uid, data = {}) {
  if (!uid) return;
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp()
  });
}
