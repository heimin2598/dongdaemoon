import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
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
  createdAt?: unknown;
  approvedAt?: unknown;
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
  const profile: UserDoc = {
    email: fbUser.email ?? '',
    displayName: displayName ?? fbUser.displayName ?? null,
    role,
    status,
    createdAt: serverTimestamp(),
    approvedAt: null,
  };
  await setDoc(doc(db, 'users', fbUser.uid), profile);
  return profile;
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
  return buildUser(credUser, profile);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

export async function getCurrentUser(): Promise<User | null> {
  // Firebase Auth는 AsyncStorage에서 비동기로 hydrate됨 — 완료 대기
  await auth.authStateReady();
  const fbUser = auth.currentUser;
  if (!fbUser) return null;
  const profile = await fetchProfile(fbUser.uid);
  if (!profile) return null;
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
  cb: (user: { role: UserRole; status: UserStatus; email: string } | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data() as UserDoc;
    cb({ role: data.role, status: data.status, email: data.email });
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
