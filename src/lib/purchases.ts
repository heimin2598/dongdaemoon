import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * RevenueCat 인앱 결제 래퍼.
 *
 * 네이티브 모듈(react-native-purchases)이 Expo Go 에서 동작 X →
 * dev/standalone build 에서만 dynamic require 로 lazy 로딩.
 *
 * 흐름:
 *  - 앱 부트(_layout.tsx) 에서 initPurchases() 1회 호출
 *  - 로그인 시 identifyPurchaseUser(uid), 로그아웃 시 logoutPurchaseUser()
 *  - paywall 에서 getOfferings() → purchasePackage(pkg)
 *  - 구매 성공 직후 syncEntitlementFromCustomerInfo(uid, info) — 클라이언트가 best-effort Firestore 갱신.
 *    진실은 RevenueCat → Firebase webhook 으로 받는 서버 측에서 보장.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';
const canUsePurchases = !isExpoGo && !isWeb;

const rcConfig = (Constants.expoConfig?.extra as { revenueCat?: Record<string, string> } | undefined)
  ?.revenueCat;
const ENTITLEMENT_ID = rcConfig?.entitlementId ?? 'premium';
export const PRODUCT_MONTHLY = rcConfig?.productMonthly ?? 'premium_monthly';
export const PRODUCT_LIFETIME = rcConfig?.productLifetime ?? 'premium_lifetime';

// 로컬 최소 타입 — react-native-purchases 설치 전에도 컴파일 통과되도록 의도적으로 좁게 정의.
interface RCEntitlement {
  productIdentifier?: string;
  expirationDate?: string | null;
}
interface RCCustomerInfo {
  entitlements: { active: Record<string, RCEntitlement | undefined> };
}
interface RCProduct {
  identifier: string;
  title: string;
  priceString: string;
}
interface RCPackage {
  identifier: string;
  packageType: string;
  product: RCProduct;
}
interface RCOffering {
  current: { availablePackages: RCPackage[] } | null;
}
interface RCPurchases {
  configure(opts: { apiKey: string }): void;
  setLogLevel(level: string): void;
  logIn(uid: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getOfferings(): Promise<RCOffering>;
  purchasePackage(pkg: RCPackage): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<RCCustomerInfo>;
  presentCodeRedemptionSheet?(): Promise<void>;
}

let _mod: { default: RCPurchases } | null = null;
let _initialized = false;

function loadModule(): { default: RCPurchases } | null {
  if (!canUsePurchases) return null;
  if (_mod) return _mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mod = require('react-native-purchases') as { default: RCPurchases };
    return _mod;
  } catch {
    return null;
  }
}

function getPurchases(): RCPurchases | null {
  return loadModule()?.default ?? null;
}

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

export function purchasesAvailability(): PurchasesAvailability {
  if (isExpoGo) return { available: false, reason: 'expo-go' };
  if (isWeb) return { available: false, reason: 'web' };
  if (!loadModule()) return { available: false, reason: 'no-module' };
  return { available: true };
}

export async function initPurchases(): Promise<void> {
  if (_initialized) return;
  const P = getPurchases();
  if (!P) {
    if (!isWeb && !isExpoGo) {
      // 네이티브 SDK 로드 실패 — 프로덕션 빌드에서 발생하면 심각.
      // Expo Go / 웹은 정상 동작 (dynamic require 실패 예상됨).
      console.error('[purchases] Failed to load react-native-purchases native module.');
    }
    return;
  }
  const key = Platform.OS === 'ios' ? rcConfig?.iosApiKey : rcConfig?.androidApiKey;
  if (!key || key.startsWith('REPLACE_ME')) {
    console.error('[purchases] Missing RevenueCat API key for platform', Platform.OS);
    return;
  }
  try {
    if (typeof P.setLogLevel === 'function') {
      P.setLogLevel('DEBUG');
    }
    P.configure({ apiKey: key });
    _initialized = true;
  } catch (err) {
    // configure 실패는 다음 호출 시 재시도 — 하지만 로깅해서 원인 추적 가능하게.
    console.error('[purchases] RC configure failed:', err);
  }
}

export async function identifyPurchaseUser(uid: string): Promise<void> {
  const P = getPurchases();
  if (!P || !_initialized) return;
  try {
    await P.logIn(uid);
  } catch {
    // ignore
  }
}

export async function logoutPurchaseUser(): Promise<void> {
  const P = getPurchases();
  if (!P || !_initialized) return;
  try {
    await P.logOut();
  } catch {
    // 이미 로그아웃 상태면 throw — 무시
  }
}

export async function getOfferings(): Promise<OfferingPackage[]> {
  const P = getPurchases();
  if (!P || !_initialized) return [];
  try {
    const offerings = await P.getOfferings();
    const cur = offerings.current;
    if (!cur) return [];
    return cur.availablePackages.map((pkg) => {
      const product = pkg.product;
      const period = pkg.packageType === 'MONTHLY'
        ? 'monthly'
        : pkg.packageType === 'LIFETIME'
          ? 'lifetime'
          : 'other';
      return {
        identifier: pkg.identifier,
        productId: product.identifier,
        title: product.title,
        priceString: product.priceString,
        period,
      };
    });
  } catch {
    return [];
  }
}

/**
 * 구매 결과.
 */
export interface PurchaseResult {
  isActive: boolean;
  expiresAtMs: number | null;
  productId: string | null;
}

export type PlanType = 'monthly' | 'lifetime';

export const STORE_UNAVAILABLE_MSG =
  '스토어 상품 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요. 이미 결제한 이용권은 그대로 유지됩니다.';

/**
 * 플랜(월간/평생) 으로 구매. test store / real store 둘 다 동일하게 동작하도록
 * packageType (MONTHLY/LIFETIME) 또는 product/package identifier 다중 매칭.
 */
export async function purchasePlan(plan: PlanType): Promise<PurchaseResult> {
  const P = getPurchases();
  if (!P || !_initialized) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  const offerings = await P.getOfferings();
  const cur = offerings.current;
  // Play/App Store 서비스 자격증명 전파 지연(개발자 계정 이관 직후 최대 36h) 이나 일시적 스토어 장애로
  // offerings 가 비는 경우가 있다. 영구 오류처럼 읽히면 이탈/저평점으로 이어지므로 재시도 안내로 문구 통일.
  if (!cur) throw new Error(STORE_UNAVAILABLE_MSG);
  const targetPackageType = plan === 'monthly' ? 'MONTHLY' : 'LIFETIME';
  const targetProductId = plan === 'monthly' ? PRODUCT_MONTHLY : PRODUCT_LIFETIME;
  const targetPackageId = plan === 'monthly' ? '$rc_monthly' : '$rc_lifetime';
  const pkg = cur.availablePackages.find(
    (p) =>
      p.packageType === targetPackageType ||
      p.product.identifier === targetProductId ||
      p.identifier === targetPackageId,
  );
  if (!pkg) throw new Error(STORE_UNAVAILABLE_MSG);
  const { customerInfo } = await P.purchasePackage(pkg);
  return readEntitlementFromCustomerInfo(customerInfo);
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const P = getPurchases();
  if (!P || !_initialized) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  const info = await P.restorePurchases();
  return readEntitlementFromCustomerInfo(info);
}

/**
 * Apple 표준 코드 리뎀션 시트 (iOS 14+).
 * 관리자가 App Store Connect 에서 발급한 프로모션 코드를 사용자가 앱 내에서 입력할 수 있게 한다.
 * Apple 정책 (Guideline 3.1.1) 준수: 커스텀 코드 시스템 대신 Apple 표준 시트 사용.
 *
 * 흐름:
 *  - 시트 열림 (Apple 시스템 UI)
 *  - 사용자 코드 입력
 *  - Apple 이 검증 → 성공 시 App Store 결제 트랜잭션 발생 (₩0)
 *  - RC 가 자동 감지 → webhook 발화 → Firestore entitlement 갱신
 *
 * iOS 만 유효. Android · Web · Expo Go 에서는 no-op (조용히 return).
 */
export async function presentAppleCodeRedemptionSheet(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const P = getPurchases();
  if (!P || !_initialized) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  if (typeof P.presentCodeRedemptionSheet !== 'function') {
    throw new Error('이 iOS 버전은 코드 리뎀션을 지원하지 않습니다. (iOS 14 이상 필요)');
  }
  await P.presentCodeRedemptionSheet();
}

function readEntitlementFromCustomerInfo(info: RCCustomerInfo): PurchaseResult {
  const ent = info.entitlements.active[ENTITLEMENT_ID];
  if (!ent) return { isActive: false, expiresAtMs: null, productId: null };
  const expiresAtMs = ent.expirationDate ? new Date(ent.expirationDate).getTime() : null;
  return {
    isActive: true,
    expiresAtMs,
    productId: ent.productIdentifier ?? null,
  };
}

// entitlement 갱신은 RevenueCat → Cloud Function webhook (functions/src/revenuecatWebhook.ts)
// 이 admin 권한으로 users/{uid}/meta/entitlement 를 직접 갱신. 클라이언트 동기화는 제거됨.
