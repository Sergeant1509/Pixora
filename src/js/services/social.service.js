import {
  collection,
  doc,
  getCountFromServer,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

export function listenToFollowing(uid, callback) {
  return onSnapshot(collection(db, 'users', uid, 'following'), (snapshot) => {
    callback(new Set(snapshot.docs.map((row) => row.id)));
  }, () => callback(new Set()));
}

export function listenToFollowers(uid, callback) {
  return onSnapshot(collection(db, 'users', uid, 'followers'), (snapshot) => {
    callback(new Set(snapshot.docs.map((row) => row.id)));
  }, () => callback(new Set()));
}


export function listenToFollowList(uid, type = 'followers', callback) {
  if (!uid || !['followers', 'following'].includes(type)) {
    callback([]);
    return () => {};
  }

  return onSnapshot(collection(db, 'users', uid, type), (snapshot) => {
    const rows = snapshot.docs
      .map((row) => ({ uid: row.id, ...row.data() }))
      .filter((user) => user.uid)
      .sort((a, b) => String(a.displayName || a.username || '').localeCompare(String(b.displayName || b.username || '')));

    callback(rows);
  }, () => callback([]));
}


export function listenToFollowStats(uid, callback) {
  if (!uid) {
    callback({ uid: '', followers: 0, following: 0 });
    return () => {};
  }

  let followers = 0;
  let following = 0;

  const emit = () => callback({ uid, followers, following });

  const unsubscribeFollowers = onSnapshot(collection(db, 'users', uid, 'followers'), (snapshot) => {
    followers = snapshot.size;
    emit();
  }, () => {
    followers = 0;
    emit();
  });

  const unsubscribeFollowing = onSnapshot(collection(db, 'users', uid, 'following'), (snapshot) => {
    following = snapshot.size;
    emit();
  }, () => {
    following = 0;
    emit();
  });

  return () => {
    unsubscribeFollowers?.();
    unsubscribeFollowing?.();
  };
}

export async function getFollowStats(uid) {
  if (!uid) return { followers: 0, following: 0 };
  try {
    const [followers, following] = await Promise.all([
      getCountFromServer(collection(db, 'users', uid, 'followers')),
      getCountFromServer(collection(db, 'users', uid, 'following'))
    ]);
    return {
      followers: followers.data().count || 0,
      following: following.data().count || 0
    };
  } catch {
    return { followers: 0, following: 0 };
  }
}

export async function followUser(profile, targetUser) {
  if (!profile?.uid || !targetUser?.uid || profile.uid === targetUser.uid) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(doc(db, 'users', profile.uid, 'following', targetUser.uid), {
    uid: targetUser.uid,
    targetUserId: targetUser.uid,
    displayName: targetUser.displayName || '',
    username: targetUser.username || '',
    avatarUrl: targetUser.avatarUrl || '',
    createdAt: now
  });

  batch.set(doc(db, 'users', targetUser.uid, 'followers', profile.uid), {
    uid: profile.uid,
    followerId: profile.uid,
    displayName: profile.displayName || '',
    username: profile.username || '',
    avatarUrl: profile.avatarUrl || '',
    createdAt: now
  });

  batch.update(doc(db, 'users', profile.uid), {
    followingCount: increment(1),
    updatedAt: now
  });

  batch.update(doc(db, 'users', targetUser.uid), {
    followersCount: increment(1),
    updatedAt: now
  });

  await batch.commit();
}

export async function unfollowUser(profile, targetUser) {
  if (!profile?.uid || !targetUser?.uid) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', profile.uid, 'following', targetUser.uid));
  batch.delete(doc(db, 'users', targetUser.uid, 'followers', profile.uid));
  batch.update(doc(db, 'users', profile.uid), {
    followingCount: increment(-1),
    updatedAt: serverTimestamp()
  });
  batch.update(doc(db, 'users', targetUser.uid), {
    followersCount: increment(-1),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
}


export async function removeFollower(profile, followerUser) {
  if (!profile?.uid || !followerUser?.uid || profile.uid === followerUser.uid) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', profile.uid, 'followers', followerUser.uid));
  batch.delete(doc(db, 'users', followerUser.uid, 'following', profile.uid));
  batch.update(doc(db, 'users', profile.uid), {
    followersCount: increment(-1),
    updatedAt: serverTimestamp()
  });
  batch.update(doc(db, 'users', followerUser.uid), {
    followingCount: increment(-1),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
}
