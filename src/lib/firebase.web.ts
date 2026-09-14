import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCjKfXp65NeKKuMa4t5oRjY91h1ptq2cws',
  authDomain: 'dongdaemoon-vscode.firebaseapp.com',
  projectId: 'dongdaemoon-vscode',
  storageBucket: 'dongdaemoon-vscode.firebasestorage.app',
  messagingSenderId: '387030473505',
  appId: '1:387030473505:web:fc968e79fe0c0f5e6b7c60',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// 웹: localStorage 기반 persistence (브라우저 재시작 후에도 로그인 유지).
// fire-and-forget — 실패해도 앱은 동작.
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn('[firebase.web] setPersistence failed:', e);
});

export const db = getFirestore(app);

export const storage = getStorage(app);

export const functions = getFunctions(app, 'us-central1');
