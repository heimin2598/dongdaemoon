import React, { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** 비활성화하면 회전/스왑 없이 그냥 자식 렌더 */
  enabled?: boolean;
}

/**
 * 자식을 항상 "가로(landscape) 좌표계"로 렌더한다.
 * 뷰포트가 세로(폰 세로)인 경우 전체를 90° 회전하고 width/height 를 swap.
 * UI 는 orientation 변화에 따라 재배치되지 않고 가로 레이아웃 기준으로 고정된다.
 */
export function LandscapeLock({ children, enabled = true }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (!enabled) return <>{children}</>;

  const isPortrait = winH > winW;
  const landW = isPortrait ? winH : winW;
  const landH = isPortrait ? winW : winH;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.landscape,
          {
            width: landW,
            height: landH,
            left: isPortrait ? (winW - landW) / 2 : 0,
            top: isPortrait ? (winH - landH) / 2 : 0,
            transform: isPortrait ? [{ rotate: '90deg' }] : undefined,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#fff' },
  landscape: { position: 'absolute' },
});
