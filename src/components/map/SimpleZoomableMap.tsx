import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

export interface SimpleZoomableMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  getScale: () => number;
  zoomToRect: (x: number, y: number, w: number, h: number) => void;
}

interface Props {
  children: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  /**
   * 부모 컨테이너가 LandscapeLock 으로 90° CW 회전된 상태인지.
   * true 면 touch 델타를 사용자 시야 좌표계로 변환:
   *   visual_dx = device_dy, visual_dy = -device_dx
   * pinch 거리는 회전 무관이라 그대로.
   */
  landscape?: boolean;
}

/**
 * PanResponder + Animated 기반 줌/팬 컨테이너.
 * 기존 ZoomableMap (reanimated 4 + gesture-handler GestureDetector) 가 Fabric 의 view 마운팅과
 * 충돌해 native crash 를 일으켰던 문제 회피용. RN 내장 PanResponder + Animated 만 사용.
 *
 * 핵심: onPanResponderGrant 는 첫 터치 시 한 번만 fire 하므로 두 번째 손가락이 나중에 추가될 때
 * onPanResponderMove 안에서 핀치 시작점을 동적으로 잡아야 한다.
 */
export const SimpleZoomableMap = forwardRef<SimpleZoomableMapHandle, Props>(function SimpleZoomableMap(
  { children, minScale = 0.8, maxScale = 6, landscape = false },
  ref,
) {
  const landscapeRef = useRef(landscape);
  landscapeRef.current = landscape;
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleValue = useRef(1);
  const txValue = useRef(0);
  const tyValue = useRef(0);

  // 핀치 상태
  const pinchActive = useRef(false);
  const pinchInitialDistance = useRef(0);
  const pinchInitialScale = useRef(1);

  // 팬 상태
  const panLastX = useRef(0);
  const panLastY = useRef(0);

  const containerSize = useRef({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    containerSize.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const clamp = (v: number) => Math.max(minScale, Math.min(maxScale, v));

  const applyScale = (v: number) => {
    const c = clamp(v);
    scale.setValue(c);
    scaleValue.current = c;
  };

  const applyTranslate = (x: number, y: number) => {
    translateX.setValue(x);
    translateY.setValue(y);
    txValue.current = x;
    tyValue.current = y;
  };

  const distance = (touches: { pageX: number; pageY: number }[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          pinchActive.current = true;
          pinchInitialDistance.current = distance(touches) || 1;
          pinchInitialScale.current = scaleValue.current;
        } else if (touches.length === 1) {
          pinchActive.current = false;
          panLastX.current = touches[0].pageX;
          panLastY.current = touches[0].pageY;
        }
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          // 두 손가락 — 핀치 줌
          const d = distance(touches);
          if (!pinchActive.current) {
            // 1 finger → 2 fingers 전환된 순간. 새 baseline 잡기.
            pinchActive.current = true;
            pinchInitialDistance.current = d || 1;
            pinchInitialScale.current = scaleValue.current;
            return;
          }
          const factor = d / pinchInitialDistance.current;
          applyScale(pinchInitialScale.current * factor);
        } else if (touches.length === 1) {
          // 한 손가락 — 팬
          if (pinchActive.current) {
            // 2 fingers → 1 finger 전환된 순간. 팬 baseline 다시 잡기.
            pinchActive.current = false;
            panLastX.current = touches[0].pageX;
            panLastY.current = touches[0].pageY;
            return;
          }
          const rawDeltaX = touches[0].pageX - panLastX.current;
          const rawDeltaY = touches[0].pageY - panLastY.current;
          // LandscapeLock 으로 90° CW 회전된 부모 안이면 사용자 시야 좌표계로 변환:
          //   visual_dx = device_dy, visual_dy = -device_dx
          const visualDx = landscapeRef.current ? rawDeltaY : rawDeltaX;
          const visualDy = landscapeRef.current ? -rawDeltaX : rawDeltaY;
          applyTranslate(txValue.current + visualDx, tyValue.current + visualDy);
          panLastX.current = touches[0].pageX;
          panLastY.current = touches[0].pageY;
        }
      },
      onPanResponderRelease: () => {
        pinchActive.current = false;
        pinchInitialDistance.current = 0;
      },
      onPanResponderTerminate: () => {
        pinchActive.current = false;
        pinchInitialDistance.current = 0;
      },
    }),
  ).current;

  useImperativeHandle(ref, () => ({
    zoomIn: () => applyScale(scaleValue.current * 1.4),
    zoomOut: () => applyScale(scaleValue.current / 1.4),
    reset: () => {
      applyScale(1);
      applyTranslate(0, 0);
    },
    getScale: () => scaleValue.current,
    zoomToRect: (x, y, w, h) => {
      const { w: cw, h: ch } = containerSize.current;
      if (cw <= 0 || ch <= 0 || w <= 0 || h <= 0) return;
      const pad = 0.88;
      const s = clamp(Math.min(cw / w, ch / h) * pad);
      const px = x + w / 2;
      const py = y + h / 2;
      const tx = s * (cw / 2 - px);
      const ty = s * (ch / 2 - py);
      applyScale(s);
      applyTranslate(tx, ty);
    },
  }));

  // 웹 마우스 휠
  const webWheelHandler =
    Platform.OS === 'web'
      ? {
          onWheel: (e: any) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            const delta = e?.deltaY ?? 0;
            if (delta === 0) return;
            const factor = delta < 0 ? 1.1 : 1 / 1.1;
            applyScale(scaleValue.current * factor);
          },
        }
      : {};

  return (
    <View
      style={styles.container}
      collapsable={false}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      {...webWheelHandler}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
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
