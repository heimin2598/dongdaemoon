import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * AdMob 광고 래퍼.
 *
 * 네이티브 모듈(react-native-google-mobile-ads) 은 Expo Go 동작 X →
 * dev/standalone build 에서만 dynamic require 로 lazy 로딩.
 *
 * 흐름:
 *  - 앱 부트(_layout.tsx) 에서 initAds() 1회 호출
 *  - 배너: <AdBanner /> 컴포넌트 사용 (premium 사용자에겐 null)
 *  - 전면(Interstitial): showInterstitial() 으로 페이지 전환 시점에 호출
 *
 * 광고 ID 는 app.json extra.admob 에서 읽음. 개발 모드(__DEV__) 에선
 * Google 이 제공하는 테스트 ID 자동 사용해서 invalid traffic 방지.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';
const canUseAds = !isExpoGo && !isWeb;

const adConfig = (Constants.expoConfig?.extra as { admob?: Record<string, string> } | undefined)
  ?.admob;

// Google 공식 테스트 광고 ID — 개발 빌드에서는 이걸 써야 정책 위반 안 됨.
const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

function pickId(realKey: 'androidBannerUnitId' | 'iosBannerUnitId' | 'androidInterstitialUnitId' | 'iosInterstitialUnitId', testId: string): string {
  if (__DEV__) return testId;
  return adConfig?.[realKey] ?? testId;
}

export function bannerUnitId(): string {
  return pickId(Platform.OS === 'ios' ? 'iosBannerUnitId' : 'androidBannerUnitId', TEST_BANNER);
}

export function interstitialUnitId(): string {
  return pickId(
    Platform.OS === 'ios' ? 'iosInterstitialUnitId' : 'androidInterstitialUnitId',
    TEST_INTERSTITIAL,
  );
}

interface AdsModule {
  default: {
    initialize(): Promise<unknown>;
    setRequestConfiguration(opts: { testDeviceIdentifiers?: string[] }): Promise<unknown>;
  };
  InterstitialAd: {
    createForAdRequest(
      adUnitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean },
    ): InterstitialInstance;
  };
  AdEventType: {
    LOADED: string;
    ERROR: string;
    CLOSED: string;
  };
}

interface InterstitialInstance {
  load(): void;
  show(): Promise<unknown>;
  loaded: boolean;
  addAdEventListener(type: string, cb: (e?: unknown) => void): () => void;
}

let _mod: AdsModule | null = null;
let _initialized = false;
let _interstitial: InterstitialInstance | null = null;
let _interstitialLoading = false;

function loadModule(): AdsModule | null {
  if (!canUseAds) return null;
  if (_mod) return _mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mod = require('react-native-google-mobile-ads') as AdsModule;
    return _mod;
  } catch {
    return null;
  }
}

export function adsAvailable(): boolean {
  return !!loadModule();
}

export async function initAds(): Promise<void> {
  if (_initialized) return;
  const m = loadModule();
  if (!m) return;
  // iOS 26.5 에서 AdMob 의 ATTrackingManager 호출이 cold-start 와 충돌해
  // MCRestrictionManager XML 파싱이 crash. 추가 idle 시간으로 우회.
  if (Platform.OS === 'ios') {
    await new Promise((r) => setTimeout(r, 1500));
  }
  try {
    await m.default.initialize();
    _initialized = true;
    preloadInterstitial();
  } catch {
    // init 실패는 silent
  }
}

function preloadInterstitial(): void {
  const m = loadModule();
  if (!m || _interstitialLoading) return;
  if (_interstitial?.loaded) return;
  _interstitialLoading = true;
  const ad = m.InterstitialAd.createForAdRequest(interstitialUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });
  const offLoaded = ad.addAdEventListener(m.AdEventType.LOADED, () => {
    _interstitialLoading = false;
  });
  const offError = ad.addAdEventListener(m.AdEventType.ERROR, () => {
    _interstitialLoading = false;
    _interstitial = null;
    offLoaded();
    offError();
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    _interstitial = null;
    // 다음 전환 대비 미리 로드
    preloadInterstitial();
  });
  _interstitial = ad;
  ad.load();
}

/**
 * 전면 광고 노출. 프리미엄 사용자는 호출 측에서 거르고,
 * 여기서는 광고 가용성만 판단. 미준비면 silent 패스.
 *
 * 자연스러운 전환점에서만 호출 (길안내 시작 후, 매장 N개 본 뒤 등).
 * 호출 빈도는 호출 측이 throttle 처리.
 */
export async function showInterstitial(): Promise<boolean> {
  const m = loadModule();
  if (!m || !_initialized) return false;
  if (!_interstitial?.loaded) {
    // 미준비 — 다음 기회 대비 로드만 트리거
    preloadInterstitial();
    return false;
  }
  try {
    await _interstitial.show();
    _lastInterstitialAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
//  throttle + counter
// ─────────────────────────────────────────────────────────

let _lastInterstitialAt = 0;
const _counters: Record<string, number> = {};
const MIN_INTERVAL_MS = 60 * 1000; // 같은 사용자에게 1분 안에 두 번 보여주지 않음

/**
 * 지정한 transition slot 의 카운터를 1 올리고, 그 결과가 `everyN` 의 배수면
 * 추가로 minimum interval (60초) 도 통과한 경우 전면광고 노출.
 *
 * 예: maybeShowInterstitial('storeDetailBack', 3) →
 *     같은 slot 3 회마다 한 번, 단 직전 노출로부터 60초 이내면 skip.
 */
export async function maybeShowInterstitial(slot: string, everyN: number): Promise<boolean> {
  _counters[slot] = (_counters[slot] ?? 0) + 1;
  if (_counters[slot] % everyN !== 0) return false;
  if (Date.now() - _lastInterstitialAt < MIN_INTERVAL_MS) return false;
  return showInterstitial();
}
