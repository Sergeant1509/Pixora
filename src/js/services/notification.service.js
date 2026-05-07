import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { cleanText } from './firebase.helpers.js';

export function listenToNotifications(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const notificationsQuery = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('updatedAt', 'desc'),
    limit(80)
  );

  return onSnapshot(notificationsQuery, (snapshot) => {
    callback(snapshot.docs.map((row) => normalizeNotification({ id: row.id, ...row.data() })));
  }, (error) => {
    console.error('Notification listener failed:', error);
    callback([]);
  });
}

export async function notifyPostLike(post, actor) {
  if (!post?.id || !post.authorId || !actor?.uid || post.authorId === actor.uid) return;

  const notificationRef = doc(db, 'users', post.authorId, 'notifications', `like_${post.id}`);
  const nextLikeCount = Array.isArray(post.likedBy) ? post.likedBy.length + 1 : Number(post.likeCount || 0) + 1;

  await setDoc(notificationRef, {
    type: 'post_like',
    postId: post.id,
    recipientId: post.authorId,
    actorIds: arrayUnion(actor.uid),
    actorCount: Math.max(1, nextLikeCount),
    latestActorId: actor.uid,
    latestActorName: cleanText(actor.displayName || actor.username || 'Someone', 50),
    latestActorUsername: cleanText(actor.username || 'user', 30),
    latestActorAvatarUrl: cleanText(actor.avatarUrl || '', 420000),
    postPreview: cleanText(post.content || 'your post', 140),
    postAuthorId: post.authorId,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function notifyPostComment(post, actor, commentText = '') {
  if (!post?.id || !post.authorId || !actor?.uid || post.authorId === actor.uid) return;

  const notificationRef = doc(collection(db, 'users', post.authorId, 'notifications'));

  await setDoc(notificationRef, {
    type: 'post_comment',
    postId: post.id,
    recipientId: post.authorId,
    actorIds: [actor.uid],
    actorCount: 1,
    latestActorId: actor.uid,
    latestActorName: cleanText(actor.displayName || actor.username || 'Someone', 50),
    latestActorUsername: cleanText(actor.username || 'user', 30),
    latestActorAvatarUrl: cleanText(actor.avatarUrl || '', 420000),
    postPreview: cleanText(post.content || 'your post', 140),
    commentText: cleanText(commentText, 140),
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function notifyCommentMention(post, actor, mentionedUser, commentText = '') {
  if (!post?.id || !mentionedUser?.uid || !actor?.uid || mentionedUser.uid === actor.uid) return;

  const notificationRef = doc(collection(db, 'users', mentionedUser.uid, 'notifications'));

  await setDoc(notificationRef, {
    type: 'comment_mention',
    postId: post.id,
    recipientId: mentionedUser.uid,
    actorIds: [actor.uid],
    actorCount: 1,
    latestActorId: actor.uid,
    latestActorName: cleanText(actor.displayName || actor.username || 'Someone', 50),
    latestActorUsername: cleanText(actor.username || 'user', 30),
    latestActorAvatarUrl: cleanText(actor.avatarUrl || '', 420000),
    postPreview: cleanText(post.content || 'your post', 140),
    commentText: cleanText(commentText, 140),
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


export async function notifyCommentLike(post, comment, actor) {
  if (!post?.id || !comment?.id || !comment.authorId || !actor?.uid || comment.authorId === actor.uid) return;

  const notificationRef = doc(db, 'users', comment.authorId, 'notifications', `comment_like_${post.id}_${comment.id}`);
  const nextLikeCount = Array.isArray(comment.likedBy) ? comment.likedBy.length + 1 : Number(comment.likeCount || 0) + 1;

  await setDoc(notificationRef, {
    type: 'comment_like',
    postId: post.id,
    commentId: comment.id,
    recipientId: comment.authorId,
    actorIds: arrayUnion(actor.uid),
    actorCount: Math.max(1, nextLikeCount),
    latestActorId: actor.uid,
    latestActorName: cleanText(actor.displayName || actor.username || 'Someone', 50),
    latestActorUsername: cleanText(actor.username || 'user', 30),
    latestActorAvatarUrl: cleanText(actor.avatarUrl || '', 420000),
    postPreview: cleanText(post.content || 'your post', 140),
    commentText: cleanText(comment.text || 'your comment', 140),
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function markNotificationsRead(uid) {
  if (!uid) return;

  const unreadQuery = query(collection(db, 'users', uid, 'notifications'), where('read', '==', false), limit(80));
  const snapshot = await getDocs(unreadQuery);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((row) => {
    batch.update(row.ref, {
      read: true,
      readAt: serverTimestamp()
    });
  });
  await batch.commit();
}


export async function deleteNotification(uid, notificationId) {
  if (!uid || !notificationId) return;
  await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId));
}

export async function deleteAllNotifications(uid) {
  if (!uid) return 0;

  let deletedCount = 0;

  while (true) {
    const notificationsQuery = query(collection(db, 'users', uid, 'notifications'), limit(250));
    const snapshot = await getDocs(notificationsQuery);
    if (snapshot.empty) break;

    const batch = writeBatch(db);
    snapshot.docs.forEach((row) => {
      batch.delete(row.ref);
      deletedCount += 1;
    });
    await batch.commit();
  }

  return deletedCount;
}

export async function markNotificationRead(uid, notificationId) {
  if (!uid || !notificationId) return;
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp()
  });
}

function normalizeNotification(notification = {}) {
  return {
    ...notification,
    id: String(notification.id || ''),
    type: notification.type || 'general',
    postId: String(notification.postId || ''),
    commentId: String(notification.commentId || ''),
    recipientId: String(notification.recipientId || ''),
    actorIds: Array.isArray(notification.actorIds) ? notification.actorIds.map(String) : [],
    actorCount: Number(notification.actorCount || (Array.isArray(notification.actorIds) ? notification.actorIds.length : 0)),
    latestActorId: String(notification.latestActorId || ''),
    latestActorName: notification.latestActorName || 'Someone',
    latestActorUsername: notification.latestActorUsername || 'user',
    latestActorAvatarUrl: notification.latestActorAvatarUrl || '',
    postPreview: notification.postPreview || 'your post',
    commentText: notification.commentText || '',
    read: Boolean(notification.read),
    createdAt: notification.createdAt || new Date().toISOString(),
    updatedAt: notification.updatedAt || notification.createdAt || new Date().toISOString()
  };
}
