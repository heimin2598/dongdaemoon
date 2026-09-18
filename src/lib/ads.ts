import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AdMob 광고 래퍼.
 *
 * 네이티브 모듈(react-native-google-mobile-ads) 은 Expo Go 동작 X →
 * dev/standalone build 에서만 dynamic require 로 lazy 로딩.
 *
 * 흐름:
 *  - 앱 부트(_layout.tsx) 에서 initAds() 1회 호출
 *  - 배너: <AdBanner /> 컴포넌트 사용 (premium 사용자에겐 null)
 *  - 전면(Interstitial): maybeShowInterstitial(slot, everyN) 으로 전환 시점에 호출.
 *    간격(60초)·세션 상한(3)·일 상한(8) 은 이 파일이 관리한다.
 *
 * 광고 ID 는 app.json extra.admob 에서 읽음. 개발 모드(__DEV__) 에선
 * Google 이 제공하는 테스트 ID 자동 사용해서 invalid traffic 방지.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';
const canUseAds = !isExpoGo && !isWeb;

const adConfig = (
  Constants.expoConfig?.extra as
    | { admob?: Record<string, string> & { testDeviceIds?: string[] } }
    | undefined
)?.admob;

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
    // 릴리스 빌드를 우리 기기로 검수할 때 실광고가 뜨면 무효 트래픽으로 계정이 제한된다.
    // app.json 의 extra.admob.testDeviceIds 에 기기 해시를 넣으면 그 기기만 테스트 광고를 받는다.
    // 해시 = 그 기기 광고 ID(AAID) 의 MD5 대문자. 릴리스 빌드 logcat 의
    // "setTestDeviceIds" 줄에 찍히는 값과 같아야 한다 (빌드 후 대조할 것).
    const testIds = adConfig?.testDeviceIds;
    if (Array.isArray(testIds) && testIds.length > 0) {
      await m.default.setRequestConfiguration({ testDeviceIdentifiers: testIds });
    }
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
 * 빈도 제어 없이 즉시 노출하므로 화면에서는 `maybeShowInterstitial` 을 쓴다.
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
    await recordShown();
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
//  throttle + counter
// ─────────────────────────────────────────────────────────

const MIN_INTERVAL_MS = 60 * 1000; // 같은 사용자에게 1분 안에 두 번 보여주지 않음
const SESSION_CAP = 3;             // 앱 실행 1회당 상한
const DAY_CAP = 8;                 // 하루 상한 (기기 로컬 날짜 기준)
const STORAGE_KEY = 'ads.interstitial.v1';

interface PersistedAdState {
  day: string;
  dayCount: number;
  lastAt: number;
}

const _counters: Record<string, number> = {};
let _sessionCount = 0;
let _state: PersistedAdState | null = null;
let _loading: Promise<PersistedAdState> | null = null;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function loadState(): Promise<PersistedAdState> {
  if (_state) return _state;
  if (_loading) return _loading;
  _loading = (async () => {
    const fresh: PersistedAdState = { day: todayKey(), dayCount: 0, lastAt: 0 };
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedAdState;
        // 날짜가 바뀌면 일 카운터만 리셋. lastAt 은 유지해야 자정 직후 연속 노출을 막는다.
        _state =
          parsed.day === fresh.day
            ? parsed
            : { day: fresh.day, dayCount: 0, lastAt: parsed.lastAt ?? 0 };
      } else {
        _state = fresh;
      }
    } catch {
      _state = fresh;
    }
    return _state;
  })();
  return _loading;
}

async function persist(s: PersistedAdState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // persist 실패는 silent — 메모리 상태만으로도 세션 안에서는 동작한다
  }
}

async function recordShown(): Promise<void> {
  const s = await loadState();
  const day = todayKey();
  if (s.day !== day) {
    s.day = day;
    s.dayCount = 0;
  }
  s.dayCount += 1;
  s.lastAt = Date.now();
  _sessionCount += 1;
  await persist(s);
}

/** 상한·간격 게이트. 통과 못 하면 노출 시도조차 하지 않는다. */
async function withinCaps(): Promise<boolean> {
  if (_sessionCount >= SESSION_CAP) return false;
  const s = await loadState();
  if (s.day === todayKey() && s.dayCount >= DAY_CAP) return false;
  return Date.now() - s.lastAt >= MIN_INTERVAL_MS;
}

/**
 * 지정한 transition slot 의 카운터가 `everyN` 에 도달하고 상한·간격을 모두
 * 통과하면 전면광고를 노출한다.
 *
 * 임계치에 도달했는데 간격/상한에 막히거나 광고가 미로딩이면 **카운터를 유지**해
 * 다음 전환에서 곧바로 재시도한다. 배수(`% everyN`) 방식이면 막힌 기회가 통째로
 * 날아가고 다음 기회가 2N 번째가 되어 실제 노출이 기대의 절반 이하로 떨어진다.
 */
export async function maybeShowInterstitial(slot: string, everyN: number): Promise<boolean> {
  if (!canUseAds) return false;
  const next = (_counters[slot] ?? 0) + 1;
  _counters[slot] = next;
  if (next < everyN) return false;
  if (!(await withinCaps())) {
    // 간격/상한에 막힌 동안 미리 채워둬야 해제 직후 첫 기회에 바로 노출된다.
    // (미로딩이면 showInterstitial 이 한 번 헛돌고 그 다음 전환에서야 뜬다)
    preloadInterstitial();
    return false;
  }
  const shown = await showInterstitial();
  if (shown) _counters[slot] = 0;
  return shown;
}
