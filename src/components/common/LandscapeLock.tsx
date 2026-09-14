import React, { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  /** 비활성화하면 회전/스왑 없이 그냥 자식 렌더 */
  enabled?: boolean;
}

/**
 * 자식을 항상 "가로(landscape) 좌표계"로 렌더한다.
 * 뷰포트가 세로(폰 세로)인 경우 전체를 90° 회전하고 width/height 를 swap.
 *
 * 세로 → 가로 90° rotate 시 시스템 UI(상단 시간/배터리, 하단 nav button) 가
 * 회전 후의 좌/우 가장자리에 위치한다. SafeAreaContext 의 insets 는 폰의 물리적 자세
 * (세로) 기준 값이므로 회전된 시각적 좌표계로 회전시켜 자식 영역에 padding 적용한다.
 *
 * 90° 시계방향 회전 시 매핑:
 *   회전 후의 시각적 top     = 폰의 left (= insets.left ≈ 0)
 *   회전 후의 시각적 bottom  = 폰의 right (= insets.right ≈ 0)
 *   회전 후의 시각적 left    = 폰의 bottom (= insets.bottom = 3-버튼 nav)
 *   회전 후의 시각적 right   = 폰의 top (= insets.top = 시간/배터리 status)
 *
 * 따라서 자식에게 paddingLeft = insets.bottom, paddingRight = insets.top 을 적용해야
 * 가로 모드 화면 좌우에 시스템 UI 영역만큼의 여백이 생긴다.
 */
export function LandscapeLock({ children, enabled = true }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!enabled) return <>{children}</>;

  const isPortrait = winH > winW;
  const landW = isPortrait ? winH : winW;
  const landH = isPortrait ? winW : winH;

  // 회전 시 insets 매핑 (90° 시계방향 회전 기준)
  // 회전 안 한 경우엔 insets 그대로 적용
  // BUFFER: 갤럭시 3-button nav 와 콘텐츠가 너무 붙어 보여서 추가 여백
  const NAV_BUFFER = 12;
  const STATUS_BUFFER = 8;
  const padTop = (isPortrait ? insets.left : insets.top) + STATUS_BUFFER;
  const padBottom = (isPortrait ? insets.right : insets.bottom) + NAV_BUFFER;
  const padLeft = (isPortrait ? insets.bottom : insets.left) + NAV_BUFFER;
  const padRight = (isPortrait ? insets.top : insets.right) + STATUS_BUFFER;

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
            paddingTop: padTop,
            paddingBottom: padBottom,
            paddingLeft: padLeft,
            paddingRight: padRight,
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
