import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  deleteUser as fbDeleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FbUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  FieldValue,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole, UserStatus } from '@/types';
import { generateShortId } from '@/utils/shortId';

/**
 * Firebase 기반 인증 라이브러리.
 * mockAuth와 동일한 함수 시그니처를 유지해 authStore가 import만 바꿔서 사용할 수 있게 한다.
 *
 * 데이터 모델:
 *   users/{uid} = { email, displayName, role, status, createdAt, approvedAt }
 *   사장님은 status: 'pending'으로 생성되고, 어드민이 'active'로 바꿔야 앱 사용 가능.
 */

interface UserDoc {
  email: string;
  displayName?: string | null;
  role: UserRole;
  status: UserStatus;
  shortId?: string;
  createdAt?: unknown;
  approvedAt?: unknown;
  disabled?: boolean;
  deletedAt?: unknown;
}

function inferProvider(fbUser: FbUser): User['provider'] {
  const pid = fbUser.providerData[0]?.providerId;
  if (pid === 'google.com') return 'google';
  if (pid === 'apple.com') return 'apple';
  return 'email';
}

function buildUser(fbUser: FbUser, profile: UserDoc): User {
  return {
    id: fbUser.uid,
    email: profile.email || fbUser.email || '',
    displayName: profile.displayName ?? fbUser.displayName ?? undefined,
    provider: inferProvider(fbUser),
    role: profile.role,
    status: profile.status,
    shortId: profile.shortId,
    disabled: !!profile.disabled,
    deletedAt: (profile.deletedAt as { toMillis?: () => number })?.toMillis?.() ?? null,
  };
}

async function fetchProfile(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

async function createProfile(
  fbUser: FbUser,
  role: UserRole,
  displayName?: string,
): Promise<UserDoc> {
  const status: UserStatus = role === 'merchant' ? 'pending' : 'active';
  const shortId = generateShortId();
  const profile: UserDoc = {
    email: fbUser.email ?? '',
    displayName: displayName ?? fbUser.displayName ?? null,
    role,
    status,
    shortId,
    createdAt: serverTimestamp(),
    approvedAt: null,
  };
  await setDoc(doc(db, 'users', fbUser.uid), profile);
  await writeUserLookup(fbUser.uid, shortId, profile.displayName ?? null);
  return profile;
}

/** 외부에서 호출 가능 — 이미 로그인된 user 도 lookup 강제 보장 (idempotent). */
export async function ensureUserLookup(
  uid: string,
  shortId: string | undefined,
  displayName: string | null | undefined,
): Promise<void> {
  if (!shortId) return;
  await writeUserLookup(uid, shortId, displayName ?? null);
}

/** userLookup/{shortId} — shortId → uid 공개 매핑. 사장님이 ID 로 고객 검색용. */
async function writeUserLookup(uid: string, shortId: string, displayName: string | null): Promise<void> {
  try {
    await setDoc(doc(db, 'userLookup', shortId), {
      uid,
      shortId,
      displayName,
    });
  } catch {
    // best-effort — 검색 lookup 없어도 본 기능에는 영향 없음
  }
}

/** 기존 회원이 shortId 가 없으면 lazy backfill. 로그인 직후 호출. */
async function ensureShortId(uid: string, profile: UserDoc): Promise<UserDoc> {
  if (profile.shortId) {
    // 이미 shortId 있으면 lookup 도 보장 (이전 가입자 마이그레이션)
    await writeUserLookup(uid, profile.shortId, profile.displayName ?? null);
    return profile;
  }
  const shortId = generateShortId();
  try {
    await updateDoc(doc(db, 'users', uid), { shortId });
    await writeUserLookup(uid, shortId, profile.displayName ?? null);
  } catch {
    // 권한/네트워크 이슈는 silent — 다음 기회에 다시 시도
    return profile;
  }
  return { ...profile, shortId };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
  role: UserRole = 'visitor',
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  const profile = await createProfile(cred.user, role, displayName);
  return buildUser(cred.user, profile);
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  let profile = await fetchProfile(cred.user.uid);
  // Auth는 됐는데 Firestore 문서가 없는 케이스 → visitor로 보충
  if (!profile) {
    profile = await createProfile(cred.user, 'visitor');
  }
  profile = await ensureShortId(cred.user.uid, profile);
  return buildUser(cred.user, profile);
}

/**
 * Google 로그인.
 *  - 웹: signInWithPopup (Firebase가 OAuth 흐름 자체 처리)
 *  - 네이티브(Expo Go / 빌드): expo-auth-session에서 받아온 idToken을 전달
 * 둘 다 Firebase Auth 사용자 → Firestore users/{uid} 프로필 자동 생성/조회 → User 반환
 */
export async function signInWithGoogle(
  role: UserRole = 'visitor',
  idToken?: string,
): Promise<User> {
  let credUser: FbUser;
  if (idToken) {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    credUser = cred.user;
  } else if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    // 항상 계정 선택 화면을 띄움 — 브라우저에 Google 세션이 캐시되어 있어도 사용자에게 명시적 선택을 요구
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    credUser = cred.user;
  } else {
    throw new Error('네이티브에서는 idToken이 필요합니다 (useGoogleAuth 훅 사용).');
  }

  let profile = await fetchProfile(credUser.uid);
  if (!profile) {
    profile = await createProfile(credUser, role, credUser.displayName ?? undefined);
  }
  profile = await ensureShortId(credUser.uid, profile);
  return buildUser(credUser, profile);
}

/**
 * Apple 로그인.
 *  - iOS: expo-apple-authentication에서 받아온 identityToken + rawNonce 전달
 *  - 웹: signInWithPopup (Firebase Console에 Apple Service ID 등록 필요)
 *  - Android: 미지원 (Apple 정책)
 *
 * Apple Developer Program 가입 + Firebase Console에서 Apple provider 활성화 + .p8 키 업로드 후에만 동작.
 */
export async function signInWithApple(
  role: UserRole = 'visitor',
  idToken?: string,
  rawNonce?: string,
): Promise<User> {
  let credUser: FbUser;
  if (idToken) {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken, rawNonce });
    const cred = await signInWithCredential(auth, credential);
    credUser = cred.user;
  } else if (Platform.OS === 'web') {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const cred = await signInWithPopup(auth, provider);
    credUser = cred.user;
  } else {
    throw new Error('Apple 로그인은 iOS 또는 웹에서만 지원됩니다.');
  }

  let profile = await fetchProfile(credUser.uid);
  if (!profile) {
    profile = await createProfile(credUser, role, credUser.displayName ?? undefined);
  }
  profile = await ensureShortId(credUser.uid, profile);
  return buildUser(credUser, profile);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * 회원 탈퇴 — Apple 정책 5.1.1(v) 필수 요구.
 * 1) Firestore 의 users/{uid} doc + 하위 메타 (entitlement, pushToken) 삭제
 * 2) userLookup doc (shortId 매핑) 삭제
 * 3) Firebase Auth 계정 삭제 (영구)
 *
 * 주의: 재인증이 만료된 상태에서는 deleteUser 가 'auth/requires-recent-login' 으로 실패할 수 있다.
 * 호출 측은 그 경우 사용자에게 다시 로그인 안내 후 재시도하도록 한다.
 *
 * 다음 데이터는 본 함수에서 자동 정리되지 않음 (별도 정책 또는 background job 처리):
 *  - 차단 목록 하위 컬렉션, 메모/포토메모, 리뷰, 신고/문의 (운영자 모니터링 목적)
 */
export async function deleteAccount(): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error('로그인 상태가 아닙니다.');
  const uid = fbUser.uid;
  // Firestore 메타 doc 삭제 (실패해도 다음 단계 진행)
  await deleteDoc(doc(db, 'users', uid, 'meta', 'entitlement')).catch(() => {});
  await deleteDoc(doc(db, 'users', uid, 'meta', 'pushToken')).catch(() => {});
  // userLookup (shortId 매핑) 정리
  try {
    const profile = await fetchProfile(uid);
    if (profile?.shortId) {
      await deleteDoc(doc(db, 'userLookups', profile.shortId)).catch(() => {});
    }
  } catch {
    // ignore
  }
  // users/{uid} 메인 doc 삭제
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
  // Firebase Auth 계정 삭제 — 마지막 단계
  await fbDeleteUser(fbUser);
}

export async function getCurrentUser(): Promise<User | null> {
  // Firebase Auth는 AsyncStorage에서 비동기로 hydrate됨 — 완료 대기
  await auth.authStateReady();
  const fbUser = auth.currentUser;
  if (!fbUser) return null;
  let profile = await fetchProfile(fbUser.uid);
  if (!profile) return null;
  profile = await ensureShortId(fbUser.uid, profile);
  return buildUser(fbUser, profile);
}

/**
 * [개발 전용] 어드민이 가입자 status를 변경할 때 사용.
 * 출시 후에는 Firebase Console에서 직접 처리한다.
 *
 * 주의: 이 함수는 클라이언트에서 호출되므로, 보안 규칙(Step 8)이 본인의 status 변경을 막아야 한다.
 * 즉 실제 운영에서 setUserStatus를 클라이언트로 호출하면 권한 거부됨 — 의도된 동작이다.
 */
export async function setUserStatus(email: string, status: UserStatus): Promise<void> {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('해당 이메일의 사용자를 찾을 수 없습니다.');
  const update: { status: UserStatus; approvedAt?: FieldValue } = { status };
  if (status === 'active') update.approvedAt = serverTimestamp();
  await updateDoc(snap.docs[0].ref, update);
}

export interface MerchantSummary {
  uid: string;
  email: string;
  displayName?: string | null;
  status: UserStatus;
  createdAt?: Timestamp | null;
  approvedAt?: Timestamp | null;
}

export async function listMerchants(filter?: UserStatus): Promise<MerchantSummary[]> {
  // role 단일 where만 사용 — composite index 없이 동작. status 필터는 클라이언트에서 처리.
  const q = query(collection(db, 'users'), where('role', '==', 'merchant'));
  const snap = await getDocs(q);
  const all: MerchantSummary[] = snap.docs.map((d) => {
    const data = d.data() as UserDoc & {
      createdAt?: Timestamp;
      approvedAt?: Timestamp;
    };
    return {
      uid: d.id,
      email: data.email,
      displayName: data.displayName ?? null,
      status: data.status,
      createdAt: data.createdAt ?? null,
      approvedAt: data.approvedAt ?? null,
    };
  });
  const filtered = filter ? all.filter((m) => m.status === filter) : all;
  // 최신순(createdAt desc)
  filtered.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  return filtered;
}

/** 특정 사용자 프로필을 실시간 구독. 반환값을 호출하면 구독 해제. */
export function subscribeToProfile(
  uid: string,
  cb: (
    user: { role: UserRole; status: UserStatus; email: string; disabled?: boolean } | null,
  ) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data() as UserDoc;
    cb({
      role: data.role,
      status: data.status,
      email: data.email,
      disabled: !!data.disabled,
    });
  });
}

export async function approveMerchant(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    status: 'active',
    approvedAt: serverTimestamp(),
  });
}

export async function rejectMerchant(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    status: 'rejected',
    approvedAt: null,
  });
}

export async function resetMerchantToPending(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    status: 'pending',
    approvedAt: null,
  });
}
