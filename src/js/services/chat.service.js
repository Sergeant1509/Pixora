import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { cleanText } from './firebase.helpers.js';
import { normalizeUser } from './token.service.js';

export function listenToConversations(uid, callback) {
  const conversationsQuery = query(collection(db, 'conversations'), where('members', 'array-contains', uid));

  return onSnapshot(conversationsQuery, (snapshot) => {
    const conversations = snapshot.docs
      .map((row) => normalizeConversation({ id: row.id, ...row.data() }))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
    callback(conversations);
  }, () => callback([]));
}

export async function openConversation(profile, targetUser) {
  const id = getConversationId(profile.uid, targetUser.uid);
  const members = [profile.uid, targetUser.uid].sort();

  await setDoc(doc(db, 'conversations', id), {
    members,
    memberInfo: {
      [profile.uid]: publicUser(profile),
      [targetUser.uid]: publicUser(targetUser)
    },
    lastMessage: '',
    lastType: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return id;
}

export function listenToMessages(conversationId, callback) {
  const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));

  return onSnapshot(messagesQuery, (snapshot) => {
    callback(snapshot.docs.map((row) => normalizeMessage({ id: row.id, ...row.data() })));
  }, () => callback([]));
}

export async function sendMessage(conversationId, profile, payload = {}) {
  const message = typeof payload === 'string' ? { text: payload } : payload;
  const type = message.type || (message.imageUrl ? 'image' : message.gifUrl ? 'gif' : message.postId ? 'post' : 'text');
  const safeText = cleanText(message.text || '', 1000);

  if (!safeText && !message.imageUrl && !message.gifUrl && !message.postId) return;

  const docData = {
    senderId: profile.uid,
    senderName: profile.displayName,
    senderUsername: profile.username,
    senderAvatarUrl: profile.avatarUrl || '',
    type,
    text: safeText,
    imageUrl: message.imageUrl || '',
    gifUrl: message.gifUrl || '',
    gifTitle: cleanText(message.gifTitle || '', 120),
    postId: message.postId || '',
    postPreview: message.postPreview || null,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), docData);

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: conversationPreview(docData),
    lastType: type,
    updatedAt: serverTimestamp()
  });
}

function conversationPreview(message) {
  if (message.type === 'image') return 'Sent a photo';
  if (message.type === 'gif') return 'Sent a GIF';
  if (message.type === 'post') return 'Shared a post';
  return message.text || 'New message';
}

function getConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function publicUser(user = {}) {
  const normalized = normalizeUser(user);
  return {
    uid: normalized.uid,
    displayName: normalized.displayName,
    username: normalized.username,
    avatarUrl: normalized.avatarUrl || ''
  };
}

function normalizeConversation(conversation = {}) {
  return {
    ...conversation,
    id: String(conversation.id || ''),
    members: (conversation.members || []).map(String),
    memberInfo: conversation.memberInfo || {},
    lastMessage: conversation.lastMessage || '',
    lastType: conversation.lastType || '',
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: conversation.updatedAt || conversation.createdAt || new Date().toISOString()
  };
}

function normalizeMessage(message = {}) {
  return {
    ...message,
    id: String(message.id || ''),
    senderId: String(message.senderId || ''),
    senderName: message.senderName || 'User',
    senderUsername: message.senderUsername || '',
    senderAvatarUrl: message.senderAvatarUrl || '',
    type: message.type || 'text',
    text: message.text || '',
    imageUrl: message.imageUrl || '',
    gifUrl: message.gifUrl || '',
    gifTitle: message.gifTitle || '',
    postId: message.postId || '',
    postPreview: message.postPreview || null,
    createdAt: message.createdAt || new Date().toISOString()
  };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}
