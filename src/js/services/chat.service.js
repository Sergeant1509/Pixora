import {
  addDoc,
  collection,
  deleteDoc,
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ENCRYPTION_SALT = 'pixora-demo-chat-v1';

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
    encryption: 'demo-aes-gcm',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return id;
}

export function listenToMessages(conversationId, callback) {
  const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));

  return onSnapshot(messagesQuery, async (snapshot) => {
    const messages = await Promise.all(snapshot.docs.map(async (row) => normalizeMessage({ id: row.id, ...row.data() }, conversationId)));
    callback(messages.filter((message) => !message.deleted));
  }, () => callback([]));
}

export async function sendMessage(conversationId, profile, payload = {}) {
  const message = typeof payload === 'string' ? { text: payload } : payload;
  const type = message.type || (message.imageUrl ? 'image' : message.gifUrl ? 'gif' : message.postId ? 'post' : 'text');
  const safeText = cleanText(message.text || '', 1000);

  if (!safeText && !message.imageUrl && !message.gifUrl && !message.postId) return;

  const encrypted = safeText ? await encryptForConversation(conversationId, safeText) : null;

  const docData = {
    senderId: profile.uid,
    senderName: profile.displayName,
    senderUsername: profile.username,
    senderAvatarUrl: profile.avatarUrl || '',
    type,
    text: '',
    encryptedText: encrypted?.ciphertext || '',
    encryptionIv: encrypted?.iv || '',
    encryptionVersion: encrypted ? 'demo-aes-gcm-v1' : '',
    imageUrl: message.imageUrl || '',
    gifUrl: message.gifUrl || '',
    gifTitle: cleanText(message.gifTitle || '', 120),
    postId: message.postId || '',
    postPreview: message.postPreview || null,
    deleted: false,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), docData);

  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: conversationPreview({ ...docData, text: safeText }),
    lastType: type,
    updatedAt: serverTimestamp()
  });
}

export async function deleteMessageForEveryone(conversationId, messageId, profile) {
  if (!conversationId || !messageId || !profile?.uid) return;
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
    deleted: true,
    text: '',
    encryptedText: '',
    encryptionIv: '',
    imageUrl: '',
    gifUrl: '',
    postId: '',
    postPreview: null,
    deletedBy: profile.uid,
    deletedAt: serverTimestamp()
  });
}

export async function clearConversationForEveryone(conversationId) {
  if (!conversationId) return;
  await deleteDoc(doc(db, 'conversations', conversationId));
}

function conversationPreview(message) {
  if (message.type === 'image') return 'Sent a photo';
  if (message.type === 'gif') return 'Sent a GIF';
  if (message.type === 'post') return 'Shared a post';
  return message.text ? 'Encrypted message' : 'New message';
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
    avatarUrl: normalized.avatarUrl || '',
    hideActivity: Boolean(normalized.hideActivity),
    lastActiveAt: normalized.lastActiveAt || null
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

async function normalizeMessage(message = {}, conversationId = '') {
  let text = message.text || '';
  if (!text && message.encryptedText && message.encryptionIv && conversationId) {
    text = await decryptForConversation(conversationId, message.encryptedText, message.encryptionIv).catch(() => '[Encrypted message could not be opened]');
  }

  return {
    ...message,
    id: String(message.id || ''),
    senderId: String(message.senderId || ''),
    senderName: message.senderName || 'User',
    senderUsername: message.senderUsername || '',
    senderAvatarUrl: message.senderAvatarUrl || '',
    type: message.type || 'text',
    text,
    imageUrl: message.imageUrl || '',
    gifUrl: message.gifUrl || '',
    gifTitle: message.gifTitle || '',
    postId: message.postId || '',
    postPreview: message.postPreview || null,
    deleted: Boolean(message.deleted),
    createdAt: message.createdAt || new Date().toISOString()
  };
}

async function getConversationKey(conversationId) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${ENCRYPTION_SALT}:${conversationId}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ENCRYPTION_SALT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptForConversation(conversationId, text) {
  if (!crypto?.subtle) return null;
  const key = await getConversationKey(conversationId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptForConversation(conversationId, ciphertext, iv) {
  if (!crypto?.subtle) return '';
  const key = await getConversationKey(conversationId);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return decoder.decode(plain);
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}
