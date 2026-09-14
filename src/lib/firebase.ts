import { initializeApp, getApps, getApp } from 'firebase/app';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — getReactNativePersistence는 RN 빌드 entry에만 타입이 있어 ts가 못 찾음 (런타임은 정상)
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCjKfXp65NeKKuMa4t5oRjY91h1ptq2cws',
  authDomain: 'dongdaemoon-vscode.firebaseapp.com',
  projectId: 'dongdaemoon-vscode',
  storageBucket: 'dongdaemoon-vscode.firebasestorage.app',
  messagingSenderId: '387030473505',
  appId: '1:387030473505:web:fc968e79fe0c0f5e6b7c60',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth 초기화: HMR/Fast Refresh 로 이 파일이 재평가되어도 안전하도록 구성.
// - 첫 호출: initializeAuth + RN persistence
// - 두 번째 호출(이미 초기화됨): getAuth fallback
// - try/catch 는 already-initialized 에러만 잡고, 다른 에러는 다시 throw 해서 가리지 않음.
let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  if (e?.code === 'auth/already-initialized') {
    _auth = getAuth(app);
  } else {
    console.error('[firebase] initializeAuth failed:', e);
    throw e;
  }
}
export const auth = _auth;

export const db = getFirestore(app);

export const storage = getStorage(app);

// Cloud Functions — region us-central1 (functions/src/*.ts 배포 region 과 일치).
export const functions = getFunctions(app, 'us-central1');
