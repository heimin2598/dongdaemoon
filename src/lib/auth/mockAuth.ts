import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole, UserStatus } from '@/types';

/**
 * MVP 개발용 목(mock) 인증.
 * - 실제 출시 전 Firebase Authentication으로 교체 예정.
 * - 교체 지점: signIn/signUp/signOut/getCurrent 함수만 바꾸면 된다.
 */

const STORAGE_KEY = '@ddm_sherpa/user';
const USERS_KEY = '@ddm_sherpa/mock_users';

interface MockUserRecord {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
  status: UserStatus;
}

async function loadUsers(): Promise<MockUserRecord[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveUsers(users: MockUserRecord[]) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function recordToUser(record: MockUserRecord, provider: User['provider']): User {
  return {
    id: record.email,
    email: record.email,
    displayName: record.displayName,
    provider,
    role: record.role,
    status: record.status,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const users = await loadUsers();
  const found = users.find((u) => u.email === email && u.password === password);
  if (!found) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const user = recordToUser(found, 'email');
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
  role: UserRole = 'visitor',
): Promise<User> {
  const users = await loadUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error('이미 가입된 이메일입니다.');
  }
  if (password.length < 6) {
    throw new Error('비밀번호는 6자 이상이어야 합니다.');
  }
  const status: UserStatus = role === 'merchant' ? 'pending' : 'active';
  const record: MockUserRecord = { email, password, displayName, role, status };
  users.push(record);
  await saveUsers(users);
  const user = recordToUser(record, 'email');
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

async function ensureSocialUser(
  id: string,
  email: string,
  displayName: string,
  provider: User['provider'],
  role: UserRole,
): Promise<User> {
  const users = await loadUsers();
  let record = users.find((u) => u.email === email);
  if (!record) {
    const status: UserStatus = role === 'merchant' ? 'pending' : 'active';
    record = { email, password: '', displayName, role, status };
    users.push(record);
    await saveUsers(users);
  } else if (record.role !== role) {
    record.role = role;
    if (role === 'merchant' && record.status === 'active') {
      record.status = 'pending';
    }
    await saveUsers(users);
  }
  const user: User = {
    id,
    email,
    displayName,
    provider,
    role: record.role,
    status: record.status,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function signInWithGoogle(role: UserRole = 'visitor'): Promise<User> {
  const suffix = role === 'merchant' ? 'merchant' : 'visitor';
  return ensureSocialUser(
    `google_${suffix}_mock`,
    `${suffix}.google@ddm-sherpa.mock`,
    role === 'merchant' ? '구글 사장님' : '구글 게스트',
    'google',
    role,
  );
}

export async function signInWithApple(role: UserRole = 'visitor'): Promise<User> {
  const suffix = role === 'merchant' ? 'merchant' : 'visitor';
  return ensureSocialUser(
    `apple_${suffix}_mock`,
    `${suffix}.apple@ddm-sherpa.mock`,
    role === 'merchant' ? 'Apple 사장님' : 'Apple 게스트',
    'apple',
    role,
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  const users = await loadUsers();
  if (!users.some((u) => u.email === email)) {
    throw new Error('가입되지 않은 이메일입니다.');
  }
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const cached = JSON.parse(raw) as User;
  // 캐시된 user의 status가 그동안 변경됐을 수 있으므로 records에서 최신값 동기화
  const users = await loadUsers();
  const record = users.find((u) => u.email === cached.email);
  if (record) {
    const synced: User = {
      ...cached,
      role: record.role,
      status: record.status,
      displayName: record.displayName ?? cached.displayName,
    };
    if (synced.role !== cached.role || synced.status !== cached.status) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
    }
    return synced;
  }
  return cached;
}

/**
 * [개발 전용] 어드민이 매장 사장님 가입을 승인/거부할 때 사용.
 * 출시 후에는 Firebase Console / 어드민 페이지가 이 역할을 한다.
 */
export async function setUserStatus(email: string, status: UserStatus): Promise<void> {
  const users = await loadUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx < 0) throw new Error('해당 이메일의 사용자를 찾을 수 없습니다.');
  users[idx].status = status;
  await saveUsers(users);
  // 현재 로그인 사용자가 본인이라면 캐시도 갱신
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    const cached = JSON.parse(raw) as User;
    if (cached.email === email) {
      cached.status = status;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    }
  }
}

export async function listMerchants(): Promise<MockUserRecord[]> {
  const users = await loadUsers();
  return users.filter((u) => u.role === 'merchant');
}
