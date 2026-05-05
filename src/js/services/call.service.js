import { addDoc, collection, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

export async function createCallInvite({ conversationId, caller, receiver, mode }) {
  if (!conversationId || !caller?.uid || !receiver?.uid) return null;
  const callRef = await addDoc(collection(db, 'conversations', conversationId, 'calls'), {
    conversationId,
    mode,
    status: 'ringing',
    callerId: caller.uid,
    callerName: caller.displayName,
    callerUsername: caller.username,
    receiverId: receiver.uid,
    receiverName: receiver.displayName,
    receiverUsername: receiver.username,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, 'users', receiver.uid, 'notifications', `call_${callRef.id}`), {
    type: 'call_invite',
    callId: callRef.id,
    conversationId,
    recipientId: receiver.uid,
    latestActorId: caller.uid,
    latestActorName: caller.displayName || caller.username || 'Someone',
    latestActorUsername: caller.username || 'user',
    latestActorAvatarUrl: caller.avatarUrl || '',
    postPreview: mode === 'video' ? 'started a video call' : 'started an audio call',
    actorIds: [caller.uid],
    actorCount: 1,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return callRef.id;
}
