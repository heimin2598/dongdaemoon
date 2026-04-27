import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

export interface ZoomableMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  getScale: () => number;
  /** 컨테이너 픽셀 좌표로 지정된 사각형 영역이 화면 중앙에 꽉 차도록 줌/팬. */
  zoomToRect: (x: number, y: number, w: number, h: number) => void;
}

interface Props {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
}

/**
 * 지도 전용 pinch + pan + wheel 줌 컨테이너.
 * - 모바일: 두 손가락 pinch, 한 손가락 pan
 * - 웹/PC: 마우스 휠 스크롤 줌, 드래그 pan
 * - 명시적 reset() 호출 외 자동 원위치 없음
 */
export const ZoomableMap = forwardRef<ZoomableMapHandle, Props>(function ZoomableMap(
  { children, minScale = 0.8, maxScale = 6 },
  ref,
) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const containerSize = useRef({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    containerSize.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const applyScale = (next: number) => {
    const clamped = Math.max(minScale, Math.min(maxScale, next));
    scale.value = withTiming(clamped, { duration: 150 });
    savedScale.value = clamped;
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => applyScale(savedScale.value * 1.4),
    zoomOut: () => applyScale(savedScale.value / 1.4),
    reset: () => {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTX.value = 0;
      savedTY.value = 0;
    },
    getScale: () => savedScale.value,
    zoomToRect: (x, y, w, h) => {
      const { w: cw, h: ch } = containerSize.current;
      if (cw <= 0 || ch <= 0 || w <= 0 || h <= 0) return;
      const pad = 0.88;
      const s = Math.max(minScale, Math.min(maxScale, Math.min(cw / w, ch / h) * pad));
      // 스케일은 엘리먼트 중심 기준이라, 중심 보정:
      // tx = s * (컨테이너중심 - 타겟중심) 공식이 성립
      const px = x + w / 2;
      const py = y + h / 2;
      const tx = s * (cw / 2 - px);
      const ty = s * (ch / 2 - py);
      scale.value = withTiming(s, { duration: 280 });
      savedScale.value = s;
      translateX.value = withTiming(tx, { duration: 280 });
      translateY.value = withTiming(ty, { duration: 280 });
      savedTX.value = tx;
      savedTY.value = ty;
    },
  }));

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(minScale, Math.min(maxScale, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    })
    .onFinalize(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    })
    .onFinalize(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // 웹 마우스 휠 지원 — deltaY < 0 확대, > 0 축소
  const webWheelHandler =
    Platform.OS === 'web'
      ? {
          onWheel: (e: any) => {
            // 페이지 스크롤 방지
            e?.preventDefault?.();
            e?.stopPropagation?.();
            const delta = e?.deltaY ?? 0;
            if (delta === 0) return;
            // 휠 한 틱당 1.1배 스케일 변화
            const factor = delta < 0 ? 1.1 : 1 / 1.1;
            const next = savedScale.value * factor;
            const clamped = Math.max(minScale, Math.min(maxScale, next));
            scale.value = clamped;
            savedScale.value = clamped;
          },
        }
      : {};

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container} collapsable={false} onLayout={onLayout} {...webWheelHandler}>
        <Animated.View style={[styles.inner, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
  },
});
