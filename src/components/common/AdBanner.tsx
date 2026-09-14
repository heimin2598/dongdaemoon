import React from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { bannerUnitId } from '@/lib/ads';
import { useEntitlement } from '@/hooks/useEntitlement';

/**
 * AdMob 적응형 배너 컴포넌트.
 *
 * - 프리미엄 사용자에겐 null 렌더 (광고 제거 혜택)
 * - Expo Go / 웹: null
 * - 그 외: 적응형 배너 노출
 *
 * 부모는 별도 padding/margin 만 줘서 시각적 분리 처리.
 */
export function AdBanner({ style }: { style?: object }) {
  const { isPremium } = useEntitlement();
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const isWeb = Platform.OS === 'web';

  if (isPremium || isExpoGo || isWeb) return null;

  // Dynamic require: BannerAd / BannerAdSize 를 Expo Go 충돌 없이 lazy 로드.
  let BannerAd: React.ComponentType<{
    unitId: string;
    size: string;
    requestOptions?: { requestNonPersonalizedAdsOnly?: boolean };
  }> | null = null;
  let BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string; BANNER: string } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch {
    return null;
  }
  if (!BannerAd || !BannerAdSize) return null;

  return (
    <View style={style}>
      <BannerAd
        unitId={bannerUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
