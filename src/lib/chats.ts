import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Chat, ChatMessage, ChatMessageType } from '@/types';

/**
 * 방문자 ↔ 사장님 1:1 채팅.
 *
 * 채팅방 ID 는 deterministic: `${visitorUid}__${shopId}` — visitor 가 같은 shop 으로 다시
 * 진입해도 동일 채팅방 재사용. ShopId 단위라 한 사장님이 여러 shop 을 운영해도 각 shop 별로
 * 분리된 채팅방을 가짐.
 */

interface ChatDoc {
  participants: string[];
  visitorUid: string;
  visitorDisplayName?: string;
  merchantUid: string;
  shopId: string;
  shopDisplayName: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  lastSenderUid?: string;
  unreadFor?: Record<string, number>;
  createdAt?: Timestamp;
}

interface MessageDoc {
  senderUid: string;
  type: ChatMessageType;
  text?: string;
  mediaUrl?: string;
  storagePath?: string;
  width?: number;
  height?: number;
  createdAt?: Timestamp;
}

function chatIdFor(visitorUid: string, shopId: string): string {
  return `${visitorUid}__${shopId}`;
}

function snapToChat(id: string, data: ChatDoc): Chat {
  return {
    id,
    participants: data.participants,
    visitorUid: data.visitorUid,
    visitorDisplayName: data.visitorDisplayName,
    merchantUid: data.merchantUid,
    shopId: data.shopId,
    shopDisplayName: data.shopDisplayName ?? '',
    lastMessage: data.lastMessage,
    lastMessageAt: data.lastMessageAt?.toMillis?.() ?? 0,
    lastSenderUid: data.lastSenderUid,
    unreadFor: data.unreadFor,
  };
}

function snapToMessage(id: string, data: MessageDoc): ChatMessage {
  return {
    id,
    senderUid: data.senderUid,
    type: data.type,
    text: data.text,
    mediaUrl: data.mediaUrl,
    storagePath: data.storagePath,
    width: data.width,
    height: data.height,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/**
 * 방문자가 특정 shop 채팅방을 보장 (있으면 그대로, 없으면 생성).
 */
export async function ensureChat(input: {
  visitorUid: string;
  visitorDisplayName?: string;
  merchantUid: string;
  shopId: string;
  shopDisplayName: string;
}): Promise<Chat> {
  // 입력 검증 — Firestore rules 통과 위해 모두 비어있지 않은 string 필요
  if (!input.visitorUid || !input.merchantUid || !input.shopId) {
    throw new Error(
      `채팅 생성 정보 부족 (visitorUid:${!!input.visitorUid}, merchantUid:${!!input.merchantUid}, shopId:${!!input.shopId})`,
    );
  }
  const id = chatIdFor(input.visitorUid, input.shopId);
  const ref = doc(db, 'chats', id);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e: any) {
    console.error('[chats] getDoc failed:', e?.code, e?.message, { chatId: id });
    throw new Error(`채팅 조회 실패 (${e?.code ?? 'unknown'}): ${e?.message ?? ''}`);
  }
  if (snap.exists()) {
    return snapToChat(snap.id, snap.data() as ChatDoc);
  }
  const payload: ChatDoc = {
    participants: [input.visitorUid, input.merchantUid],
    visitorUid: input.visitorUid,
    merchantUid: input.merchantUid,
    shopId: input.shopId,
    shopDisplayName: input.shopDisplayName,
    lastMessage: '',
    lastMessageAt: serverTimestamp() as unknown as Timestamp,
    createdAt: serverTimestamp() as unknown as Timestamp,
    unreadFor: {},
  };
  if (input.visitorDisplayName) payload.visitorDisplayName = input.visitorDisplayName;
  try {
    await setDoc(ref, payload);
  } catch (e: any) {
    console.error('[chats] setDoc failed:', e?.code, e?.message, {
      chatId: id,
      visitorUid: input.visitorUid,
      merchantUid: input.merchantUid,
      shopId: input.shopId,
    });
    throw new Error(`채팅 생성 실패 (${e?.code ?? 'unknown'}): ${e?.message ?? ''}`);
  }
  return {
    id,
    participants: payload.participants,
    visitorUid: payload.visitorUid,
    visitorDisplayName: input.visitorDisplayName,
    merchantUid: payload.merchantUid,
    shopId: payload.shopId,
    shopDisplayName: payload.shopDisplayName,
    lastMessage: '',
    lastMessageAt: Date.now(),
  };
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const snap = await getDoc(doc(db, 'chats', chatId));
  if (!snap.exists()) return null;
  return snapToChat(snap.id, snap.data() as ChatDoc);
}

export function subscribeChat(chatId: string, cb: (chat: Chat | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'chats', chatId), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snapToChat(snap.id, snap.data() as ChatDoc));
  });
}

/** 내가 참여한 채팅 목록 (방문자 / 사장님 양쪽 다) */
export function subscribeMyChats(uid: string, cb: (chats: Chat[]) => void): Unsubscribe {
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => snapToChat(d.id, d.data() as ChatDoc));
      list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      cb(list);
    },
    (err) => {
      console.error('[chats] subscribeMyChats error:', err);
      cb([]);
    },
  );
}

export function subscribeMessages(
  chatId: string,
  cb: (messages: ChatMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToMessage(d.id, d.data() as MessageDoc)));
    },
    (err) => {
      console.error('[chats] subscribeMessages error:', err);
      cb([]);
    },
  );
}

async function bumpChatLast(
  chatId: string,
  lastMessage: string,
  senderUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage,
    lastMessageAt: serverTimestamp(),
    lastSenderUid: senderUid,
  });
}

/**
 * 채팅 fan-out 푸시 알림 — 메시지 보낸 후 best-effort 로 상대에게 Expo Push 발송.
 * Cloud Functions 가 정석이지만 Spark plan 호환을 위해 클라이언트 fan-out.
 * 모든 에러는 silent (메시지 자체는 이미 저장됨).
 */
async function notifyRecipient(
  chatId: string,
  senderUid: string,
  messagePreview: string,
): Promise<void> {
  try {
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (!chatSnap.exists()) return;
    const chat = chatSnap.data() as ChatDoc;
    const recipientUid = chat.participants.find((p) => p !== senderUid);
    if (!recipientUid) return;
    const tokenSnap = await getDoc(doc(db, 'users', recipientUid, 'meta', 'pushToken'));
    if (!tokenSnap.exists()) return;
    const token = (tokenSnap.data() as { token?: string }).token;
    if (!token || !token.startsWith('ExponentPushToken[')) return;

    // 알림 제목 — 받는 쪽 시점에서 자연스러운 표시명
    //   recipient == visitor → 매장명
    //   recipient == merchant → 고객명
    const title =
      recipientUid === chat.visitorUid
        ? (chat.shopDisplayName || '매장')
        : (chat.visitorDisplayName || '고객');

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title,
        body: messagePreview,
        data: { route: `/chat/${chatId}` },
      }),
    });
  } catch (e) {
    console.warn('[chats] notifyRecipient failed:', e);
  }
}

export async function sendTextMessage(
  chatId: string,
  senderUid: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderUid,
    type: 'text',
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  await bumpChatLast(chatId, trimmed, senderUid);
  notifyRecipient(chatId, senderUid, trimmed.slice(0, 80));
}

/** 이미지 업로드 + 메시지 저장. uri 는 ImagePicker 로 얻은 로컬 uri. */
export async function sendImageMessage(
  chatId: string,
  senderUid: string,
  uri: string,
): Promise<void> {
  const blob = await uriToBlob(uri);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `chats/${chatId}/${filename}`;
  const sref = storageRef(storage, path);
  await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(sref);
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderUid,
    type: 'image',
    mediaUrl: url,
    storagePath: path,
    createdAt: serverTimestamp(),
  });
  await bumpChatLast(chatId, '[사진]', senderUid);
  notifyRecipient(chatId, senderUid, '사진을 보냈습니다');
}

/** 영상 업로드 + 메시지. mp4/quicktime/webm. */
export async function sendVideoMessage(
  chatId: string,
  senderUid: string,
  uri: string,
): Promise<void> {
  const blob = await uriToBlob(uri);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
  const path = `chats/${chatId}/${filename}`;
  const sref = storageRef(storage, path);
  await uploadBytes(sref, blob, { contentType: 'video/mp4' });
  const url = await getDownloadURL(sref);
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderUid,
    type: 'video',
    mediaUrl: url,
    storagePath: path,
    createdAt: serverTimestamp(),
  });
  await bumpChatLast(chatId, '[영상]', senderUid);
  notifyRecipient(chatId, senderUid, '영상을 보냈습니다');
}

async function uriToBlob(uri: string): Promise<Blob> {
  // RN / web 양쪽에서 fetch(uri) 로 blob 획득 가능
  const res = await fetch(uri);
  return await res.blob();
}
