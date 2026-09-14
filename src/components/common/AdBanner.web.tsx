import React from 'react';

/**
 * 웹용 AdBanner 스텁 — react-native-google-mobile-ads 가 web export 가 없어서
 * native 전용 import 가 Metro 웹 번들을 실패시킨다. 웹에서는 광고 자체가 무의미하니
 * null 렌더로 처리. 네이티브 빌드에서는 AdBanner.tsx 가 사용된다.
 */
export function AdBanner(_props: { style?: object }) {
  return null;
}
