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
 *  - paywall 에서 getPurchasablePlans() → purchasePlan(plan, uid)
 *  - Firestore entitlement 갱신은 RC → Cloud Function webhook (admin 권한) 이 담당.
 *    webhook 이 늦거나 실패하면 syncEntitlement callable 이 RC REST 로 되읽어 메운다.
 *
 * 신원 불변식 (이게 깨지면 돈만 빠지고 권한이 안 생긴다):
 *   구매·복원은 RC appUserID 가 Firebase uid 와 일치할 때만 수행한다.
 *   일치시키지 못하면 구매를 **시작하지 않는다**. 익명 ID($RCAnonymousID:...) 로
 *   결제가 기록되면 webhook 이 users/$RCAnonymousID.../meta/entitlement 에 써서
 *   정작 결제한 계정은 영원히 무료로 남는다.
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
  getAppUserID(): Promise<string> | string;
  getOfferings(): Promise<RCOffering>;
  purchasePackage(pkg: RCPackage): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<RCCustomerInfo>;
  presentCodeRedemptionSheet?(): Promise<void>;
}

let _mod: { default: RCPurchases } | null = null;
let _initPromise: Promise<boolean> | null = null;
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

/**
 * SDK configure. 여러 번 불려도 실제 configure 는 1회.
 * 반환 promise 를 보관해서 "아직 준비 안 됨" 때문에 로그인이 조용히 누락되는 일을 막는다.
 */
export function initPurchases(): Promise<boolean> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const P = getPurchases();
    if (!P) {
      if (!isWeb && !isExpoGo) {
        // 네이티브 SDK 로드 실패 — 프로덕션 빌드에서 발생하면 심각.
        // Expo Go / 웹은 정상 동작 (dynamic require 실패 예상됨).
        console.error('[purchases] Failed to load react-native-purchases native module.');
      }
      return false;
    }
    const key = Platform.OS === 'ios' ? rcConfig?.iosApiKey : rcConfig?.androidApiKey;
    if (!key || key.startsWith('REPLACE_ME')) {
      console.error('[purchases] Missing RevenueCat API key for platform', Platform.OS);
      return false;
    }
    // 테스트 스토어 키(test_...)가 운영 빌드에 섞이면 실제 청구 없이 결제가 성립한다.
    if (!__DEV__ && key.startsWith('test_')) {
      console.error('[purchases] Test store API key in a production build — refusing to configure.');
      return false;
    }
    try {
      if (typeof P.setLogLevel === 'function') {
        P.setLogLevel(__DEV__ ? 'DEBUG' : 'WARN');
      }
      P.configure({ apiKey: key });
      _initialized = true;
      return true;
    } catch (err) {
      // 다음 호출에서 재시도할 수 있도록 promise 를 비운다.
      console.error('[purchases] RC configure failed:', err);
      _initPromise = null;
      return false;
    }
  })();
  return _initPromise;
}

async function readAppUserId(P: RCPurchases): Promise<string | null> {
  try {
    const id = await Promise.resolve(P.getAppUserID());
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/**
 * RC appUserID 를 Firebase uid 로 맞춘다. 이미 맞으면 no-op.
 * 성공 여부를 반환 — 호출자는 false 면 결제를 진행시키면 안 된다.
 */
export async function identifyPurchaseUser(uid: string): Promise<boolean> {
  if (!uid) return false;
  const ready = await initPurchases();
  const P = getPurchases();
  if (!ready || !P) return false;

  const current = await readAppUserId(P);
  if (current === uid) return true;
  try {
    await P.logIn(uid);
  } catch (err) {
    console.error('[purchases] RC logIn failed:', err);
    return false;
  }
  // logIn 이 성공해도 실제 식별자가 바뀌었는지 반드시 확인한다.
  const after = await readAppUserId(P);
  if (after !== uid) {
    console.error('[purchases] RC appUserID mismatch after logIn:', after);
    return false;
  }
  return true;
}

export async function logoutPurchaseUser(): Promise<void> {
  const P = getPurchases();
  if (!P || !_initialized) return;
  try {
    await P.logOut();
  } catch {
    // 이미 익명 상태면 throw — 무시
  }
}

function toOfferingPackage(pkg: RCPackage): OfferingPackage {
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

export const IDENTITY_FAILED_MSG =
  '결제 계정 확인에 실패했습니다.\n네트워크 확인 후 다시 시도해 주세요. 결제는 진행되지 않았습니다.';

const PLAN_NOT_SOLD_MSG =
  '이 요금제는 현재 스토어에서 판매하지 않습니다.\n다른 요금제를 선택해 주세요.';

function matchPackage(packages: RCPackage[], plan: PlanType): RCPackage | undefined {
  const targetPackageType = plan === 'monthly' ? 'MONTHLY' : 'LIFETIME';
  const targetProductId = plan === 'monthly' ? PRODUCT_MONTHLY : PRODUCT_LIFETIME;
  const targetPackageId = plan === 'monthly' ? '$rc_monthly' : '$rc_lifetime';
  return packages.find(
    (p) =>
      p.packageType === targetPackageType ||
      p.product.identifier === targetProductId ||
      p.identifier === targetPackageId,
  );
}

/** 현재 스토어에서 실제로 구매 가능한 플랜 + 표시 가격. 페이월이 하드코딩 대신 이걸 쓴다. */
export async function getPurchasablePlans(): Promise<Partial<Record<PlanType, OfferingPackage>>> {
  const ready = await initPurchases();
  const P = getPurchases();
  if (!ready || !P) return {};
  try {
    const cur = (await P.getOfferings()).current;
    if (!cur) return {};
    const out: Partial<Record<PlanType, OfferingPackage>> = {};
    for (const plan of ['monthly', 'lifetime'] as PlanType[]) {
      const pkg = matchPackage(cur.availablePackages, plan);
      if (pkg) out[plan] = toOfferingPackage(pkg);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 플랜(월간/평생) 으로 구매.
 * uid 는 필수 — RC 신원을 Firebase uid 로 맞춘 뒤에만 결제 시트를 띄운다.
 */
export async function purchasePlan(plan: PlanType, uid: string): Promise<PurchaseResult> {
  const ready = await initPurchases();
  const P = getPurchases();
  if (!ready || !P) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  if (!(await identifyPurchaseUser(uid))) {
    throw new Error(IDENTITY_FAILED_MSG);
  }
  const offerings = await P.getOfferings();
  const cur = offerings.current;
  // Play/App Store 서비스 자격증명 전파 지연(개발자 계정 이관 직후 최대 36h) 이나 일시적 스토어 장애로
  // offerings 가 비는 경우가 있다. 영구 오류처럼 읽히면 이탈/저평점으로 이어지므로 재시도 안내로 문구 통일.
  if (!cur) throw new Error(STORE_UNAVAILABLE_MSG);
  const pkg = matchPackage(cur.availablePackages, plan);
  // offerings 는 받았는데 해당 플랜만 없는 경우 = 스토어에 상품이 등록돼 있지 않다.
  // 재시도해도 영원히 안 되므로 일시 장애 문구를 쓰면 안 된다.
  if (!pkg) throw new Error(cur.availablePackages.length ? PLAN_NOT_SOLD_MSG : STORE_UNAVAILABLE_MSG);
  const { customerInfo } = await P.purchasePackage(pkg);
  return readEntitlementFromCustomerInfo(customerInfo);
}

export async function restorePurchases(uid: string): Promise<PurchaseResult> {
  const ready = await initPurchases();
  const P = getPurchases();
  if (!ready || !P) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  if (!(await identifyPurchaseUser(uid))) {
    throw new Error(IDENTITY_FAILED_MSG);
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
export async function presentAppleCodeRedemptionSheet(uid: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const ready = await initPurchases();
  const P = getPurchases();
  if (!ready || !P) {
    throw new Error('결제 시스템이 초기화되지 않았습니다.');
  }
  // 코드 리뎀션도 결제 트랜잭션이다 — 신원이 안 맞으면 혜택이 다른 계정에 붙는다.
  if (!(await identifyPurchaseUser(uid))) {
    throw new Error(IDENTITY_FAILED_MSG);
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
