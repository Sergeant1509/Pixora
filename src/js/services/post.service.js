import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { cleanText } from './firebase.helpers.js';

export function listenToPosts(callback) {
  const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(120));

  return onSnapshot(postsQuery, (snapshot) => {
    const posts = snapshot.docs.map((row) => normalizePost({ id: row.id, ...row.data() }));
    callback(posts);
  }, (error) => {
    console.error('Post listener failed:', error);
    callback([]);
  });
}

export async function createPost(profile, content, media = null) {
  const safeContent = cleanText(content, 800);
  if (!safeContent && !media?.url) throw new Error('Write something or add a photo before publishing.');

  await addDoc(collection(db, 'posts'), {
    authorId: profile.uid,
    authorName: profile.displayName,
    authorUsername: profile.username,
    authorAvatarUrl: profile.avatarUrl || '',
    content: safeContent,
    mediaUrl: media?.url || '',
    mediaType: media?.type || '',
    mediaPath: media?.path || '',
    imageUrl: media?.type === 'image' ? media.url : '',
    likedBy: [],
    savedBy: [],
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
}

export async function toggleLike(post, uid) {
  if (!post?.id || !uid) return;
  const liked = post.likedBy.includes(uid);
  await updateDoc(doc(db, 'posts', post.id), {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likeCount: increment(liked ? -1 : 1),
    updatedAt: serverTimestamp()
  });
}

export async function toggleSave(post, uid) {
  if (!post?.id || !uid) return;
  const saved = post.savedBy.includes(uid);
  await updateDoc(doc(db, 'posts', post.id), {
    savedBy: saved ? arrayRemove(uid) : arrayUnion(uid),
    updatedAt: serverTimestamp()
  });
}

export async function increaseShareCount(postId) {
  if (!postId) return;
  await updateDoc(doc(db, 'posts', postId), {
    shareCount: increment(1),
    updatedAt: serverTimestamp()
  });
}

export function listenToComments(postId, callback) {
  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(80)
  );

  return onSnapshot(commentsQuery, (snapshot) => {
    callback(snapshot.docs.map((row) => normalizeComment({ id: row.id, ...row.data() })));
  }, () => callback([]));
}

export async function addComment(postId, profile, text) {
  const safeText = cleanText(text, 300);
  if (!safeText) throw new Error('Comment cannot be empty.');

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    authorId: profile.uid,
    authorName: profile.displayName,
    authorUsername: profile.username,
    authorAvatarUrl: profile.avatarUrl || '',
    text: safeText,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'posts', postId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp()
  });
}

function normalizePost(post = {}) {
  return {
    ...post,
    id: String(post.id || ''),
    authorId: String(post.authorId || ''),
    authorName: post.authorName || 'User',
    authorUsername: post.authorUsername || 'user',
    authorAvatarUrl: post.authorAvatarUrl || '',
    content: post.content || '',
    mediaUrl: post.mediaUrl || post.imageUrl || '',
    mediaType: post.mediaType || (post.imageUrl ? 'image' : ''),
    mediaPath: post.mediaPath || '',
    likedBy: Array.isArray(post.likedBy) ? post.likedBy.map(String) : [],
    savedBy: Array.isArray(post.savedBy) ? post.savedBy.map(String) : [],
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    shareCount: Number(post.shareCount || 0),
    createdAt: post.createdAt || new Date().toISOString(),
    updatedAt: post.updatedAt || post.createdAt || new Date().toISOString()
  };
}

function normalizeComment(comment = {}) {
  return {
    ...comment,
    id: String(comment.id || ''),
    authorId: String(comment.authorId || ''),
    authorName: comment.authorName || 'User',
    authorUsername: comment.authorUsername || 'user',
    authorAvatarUrl: comment.authorAvatarUrl || '',
    text: comment.text || '',
    createdAt: comment.createdAt || new Date().toISOString()
  };
}
