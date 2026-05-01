import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { cleanText } from './firebase.helpers.js';

const EXPLICIT_PATTERNS = [
  /\bnude(s|ity)?\b/i,
  /\bsex(ual)?\b/i,
  /\bporn\b/i,
  /\bxxx\b/i,
  /\bonlyfans\b/i,
  /\b18\+\b/i,
  /\bnaked\b/i,
  /\bboobs?\b/i,
  /\bdick\b/i,
  /\bpussy\b/i,
  /\bfuck\b/i,
  /\bblowjob\b/i,
  /\bhentai\b/i,
  /\bnsfw\b/i,
  /\bsend\s+nudes?\b/i,
  /\bhot\s+pic(s)?\b/i
];

export const REPORT_GROUPS = [
  'Sexual content or nudity',
  'Harassment or bullying',
  'Hate or abusive behavior',
  'Spam or scam',
  'Impersonation',
  'Violence or threats',
  'Other'
];

export function scanContent(text = '') {
  const source = String(text || '');
  const matched = EXPLICIT_PATTERNS.find((pattern) => pattern.test(source));
  return {
    flagged: Boolean(matched),
    group: matched ? 'Sexual content or nudity' : '',
    matchedTerm: matched ? String(matched) : ''
  };
}

export function getBanInfo(profile = {}) {
  const raw = profile.bannedUntil;
  let bannedUntil = null;
  if (raw?.toDate) bannedUntil = raw.toDate();
  else if (raw) bannedUntil = new Date(raw);

  const isBanned = bannedUntil instanceof Date && !Number.isNaN(bannedUntil.valueOf()) && bannedUntil.getTime() > Date.now();
  return {
    isBanned,
    bannedUntil,
    reason: profile.banReason || 'Community rules violation'
  };
}

export function banMessage(profile = {}) {
  const info = getBanInfo(profile);
  if (!info.isBanned) return '';
  return `Your account is temporarily limited until ${info.bannedUntil.toLocaleString()} for ${info.reason}.`;
}

function banMinutesForViolationCount(count = 0) {
  if (count < 5) return 0;
  const level = Math.floor((count - 5) / 3);
  return Math.min(24 * 60, 5 * Math.pow(2, level));
}

export async function registerContentViolation(profile, payload = {}) {
  if (!profile?.uid) return { banned: false, minutes: 0 };

  const userRef = doc(db, 'users', profile.uid);
  const snapshot = await getDoc(userRef);
  const currentCount = Number(snapshot.data()?.moderationViolationCount || 0) + 1;
  const minutes = banMinutesForViolationCount(currentCount);
  const bannedUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : '';
  const reason = payload.group || 'Community rules violation';

  await addDoc(collection(db, 'moderationEvents'), {
    userId: profile.uid,
    username: profile.username || '',
    displayName: profile.displayName || '',
    type: payload.type || 'content_blocked',
    group: reason,
    source: payload.source || 'content',
    textPreview: cleanText(payload.text || '', 180),
    matchedTerm: cleanText(payload.matchedTerm || '', 80),
    violationCount: currentCount,
    bannedForMinutes: minutes,
    createdAt: serverTimestamp()
  });

  await updateDoc(userRef, {
    moderationViolationCount: currentCount,
    lastModerationViolationAt: serverTimestamp(),
    banReason: reason,
    ...(bannedUntil ? { bannedUntil } : {})
  });

  if (minutes) await notifyUserBan(profile.uid, reason, bannedUntil, minutes);
  return { banned: Boolean(minutes), minutes, count: currentCount, bannedUntil };
}

export async function notifyUserBan(uid, reason, bannedUntil, minutes) {
  if (!uid) return;
  const id = `ban_${Date.now()}`;
  await setDoc(doc(db, 'users', uid, 'notifications', id), {
    type: 'account_ban',
    recipientId: uid,
    actorIds: [],
    actorCount: 0,
    latestActorId: '',
    latestActorName: 'Pixora Safety',
    latestActorUsername: 'safety',
    latestActorAvatarUrl: '',
    postId: '',
    postPreview: `Your account is limited for ${minutes >= 60 ? Math.round(minutes / 60) + ' hours' : minutes + ' minutes'}.`,
    commentText: `Reason: ${reason}. The limit ends at ${new Date(bannedUntil).toLocaleString()}.`,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function listenToBlocked(uid, callback) {
  if (!uid) {
    callback(new Set());
    return () => {};
  }

  return onSnapshot(collection(db, 'users', uid, 'blocked'), (snapshot) => {
    callback(new Set(snapshot.docs.map((row) => row.id)));
  }, () => callback(new Set()));
}

export async function blockUser(profile, targetUser) {
  if (!profile?.uid || !targetUser?.uid || profile.uid === targetUser.uid) return;

  await setDoc(doc(db, 'users', profile.uid, 'blocked', targetUser.uid), {
    uid: targetUser.uid,
    targetUserId: targetUser.uid,
    displayName: targetUser.displayName || '',
    username: targetUser.username || '',
    avatarUrl: targetUser.avatarUrl || '',
    createdAt: serverTimestamp()
  }, { merge: true });
}

export async function unblockUser(profile, targetUser) {
  if (!profile?.uid || !targetUser?.uid) return;
  await deleteDoc(doc(db, 'users', profile.uid, 'blocked', targetUser.uid));
}

export async function submitReport({ reporter, targetUser, targetComment, post, group, details }) {
  if (!reporter?.uid || !targetUser?.uid) throw new Error('Report could not be created.');

  const safeGroup = REPORT_GROUPS.includes(group) ? group : 'Other';
  const reportRef = await addDoc(collection(db, 'reports'), {
    reporterId: reporter.uid,
    reporterUsername: reporter.username || '',
    targetUserId: targetUser.uid,
    targetUsername: targetUser.username || '',
    targetDisplayName: targetUser.displayName || '',
    targetType: targetComment ? 'comment' : 'user',
    postId: post?.id || '',
    commentId: targetComment?.id || '',
    reasonGroup: safeGroup,
    details: cleanText(details || '', 500),
    status: 'open',
    createdAt: serverTimestamp()
  });

  const userRef = doc(db, 'users', targetUser.uid);
  const snap = await getDoc(userRef);
  const key = reportGroupKey(safeGroup);
  const current = Number(snap.data()?.reportGroups?.[key] || 0) + 1;

  await updateDoc(userRef, {
    [`reportGroups.${key}`]: increment(1),
    reportCount: increment(1),
    lastReportedAt: serverTimestamp()
  });

  if (current >= 5) {
    const bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await updateDoc(userRef, {
      bannedUntil,
      banReason: `Multiple reports for ${safeGroup}`,
      lastBanAt: serverTimestamp()
    });
    await notifyUserBan(targetUser.uid, `Multiple reports for ${safeGroup}`, bannedUntil, 24 * 60);
  }

  return reportRef.id;
}

function reportGroupKey(group = '') {
  return String(group || 'Other')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'other';
}
