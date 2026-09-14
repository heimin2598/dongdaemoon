import type { PaymentMethod } from '@/types';

export interface PaymentMethodInfo {
  key: PaymentMethod;
  label: string;
  emoji: string;
  /** 배지 배경/텍스트 — 브랜드 컬러 */
  bg: string;
  color: string;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { key: 'card',     label: '카드',         emoji: '💳', bg: '#E8EEFB', color: '#1F4FB0' },
  { key: 'cash',     label: '현금',         emoji: '💵', bg: '#E5F5EC', color: '#1B7A3E' },
  { key: 'kakao',    label: '카카오페이',   emoji: '💛', bg: '#FFF6CC', color: '#856B00' },
  { key: 'naver',    label: '네이버페이',   emoji: '💚', bg: '#E2F4E5', color: '#1F7A3E' },
  { key: 'samsung',  label: '삼성페이',     emoji: '🔷', bg: '#E3ECFA', color: '#0F4A8F' },
  { key: 'transfer', label: '계좌이체',     emoji: '🏦', bg: '#EFEFEF', color: '#444' },
];

const BY_KEY = new Map(PAYMENT_METHODS.map((p) => [p.key, p]));

export function getPaymentMethodInfo(key: PaymentMethod): PaymentMethodInfo | undefined {
  return BY_KEY.get(key);
}
