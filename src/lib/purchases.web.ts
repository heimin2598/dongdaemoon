/**
 * Web 환경 stub — react-native-purchases 는 네이티브 전용.
 * 웹에서는 결제 비활성 + paywall 에서 사용자에게 안내.
 *
 * 네이티브 purchases.ts 의 export 집합과 반드시 일치시킨다.
 * 하나라도 빠지면 웹 번들에서 undefined import 가 되어 호출 시점에 터진다.
 */

export const PRODUCT_MONTHLY = 'premium_monthly';
export const PRODUCT_LIFETIME = 'premium_lifetime';

export interface OfferingPackage {
  identifier: string;
  productId: string;
  title: string;
  priceString: string;
  period: 'monthly' | 'lifetime' | 'other';
}

export interface PurchasesAvailability {
  available: boolean;
  reason?: 'expo-go' | 'web' | 'no-module';
}

export interface PurchaseResult {
  isActive: boolean;
  expiresAtMs: number | null;
  productId: string | null;
}

export type PlanType = 'monthly' | 'lifetime';

export const STORE_UNAVAILABLE_MSG =
  '스토어 상품 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요. 이미 결제한 이용권은 그대로 유지됩니다.';

export const IDENTITY_FAILED_MSG =
  '결제 계정 확인에 실패했습니다.\n네트워크 확인 후 다시 시도해 주세요. 결제는 진행되지 않았습니다.';

export function purchasesAvailability(): PurchasesAvailability {
  return { available: false, reason: 'web' };
}

export async function initPurchases(): Promise<boolean> {
  return false;
}
export async function identifyPurchaseUser(_uid: string): Promise<boolean> {
  return false;
}
export async function logoutPurchaseUser(): Promise<void> {}
export async function getPurchasablePlans(): Promise<Partial<Record<PlanType, OfferingPackage>>> {
  return {};
}
export async function purchasePlan(_plan: PlanType, _uid: string): Promise<PurchaseResult> {
  throw new Error('웹에서는 인앱 결제를 사용할 수 없습니다. 모바일 앱에서 진행해 주세요.');
}
export async function restorePurchases(_uid: string): Promise<PurchaseResult> {
  throw new Error('웹에서는 결제 복원을 사용할 수 없습니다.');
}
export async function presentAppleCodeRedemptionSheet(_uid: string): Promise<void> {}
