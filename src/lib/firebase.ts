import { initializeApp, getApps, getApp } from 'firebase/app';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — getReactNativePersistence는 RN 빌드 entry에만 타입이 있어 ts가 못 찾음 (런타임은 정상)
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
