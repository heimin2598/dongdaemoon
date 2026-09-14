/**
 * Web 환경 stub — react-native-google-mobile-ads 는 네이티브 전용.
 */

export function bannerUnitId(): string {
  return '';
}
export function interstitialUnitId(): string {
  return '';
}
export function adsAvailable(): boolean {
  return false;
}
export async function initAds(): Promise<void> {}
export async function showInterstitial(): Promise<boolean> {
  return false;
}
