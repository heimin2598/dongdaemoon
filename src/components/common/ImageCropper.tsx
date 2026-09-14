import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  sourceUri: string | null;
  /** 결과 가로:세로 비율 (예: 배너는 2.7) */
  aspectRatio: number;
  /** 결과 PNG/JPEG 의 가로 픽셀 (높이는 가로/aspectRatio). 권장 1080~1500 */
  outputWidth?: number;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
}

/**
 * 이미지 핀치줌·팬 크롭 에디터.
 * 웹/iOS/Android 모두에서 동작 (Gesture Handler v2 + Reanimated v4).
 *
 * 사용:
 *   <ImageCropper visible={!!pendingUri} sourceUri={pendingUri}
 *     aspectRatio={2.7}
 *     onCancel={() => setPendingUri(null)}
 *     onConfirm={(uri) => { setImageUri(uri); setPendingUri(null); }} />
 */
export function ImageCropper({
  visible,
  sourceUri,
  aspectRatio,
  outputWidth = 1200,
  onCancel,
  onConfirm,
}: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  // Gesture state — Reanimated shared values
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const baseTx = useSharedValue(0);
  const baseTy = useSharedValue(0);

  // 이미지 자연 크기 측정
  useEffect(() => {
    if (!visible || !sourceUri) {
      setImgSize(null);
      return;
    }
    Image.getSize(
      sourceUri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize(null),
    );
    // 매번 모달 열릴 때 변환 초기화
    scale.value = 1;
    baseScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    baseTx.value = 0;
    baseTy.value = 0;
  }, [visible, sourceUri]);

  // 이미지 → 프레임 안에 cover 로 채우기 위한 base scale
  // (최초 표시는 cover. 사용자가 추가로 zoom in/out)
  const baseFitScale = imgSize && frame.w > 0
    ? Math.max(frame.w / imgSize.w, frame.h / imgSize.h)
    : 1;

  // 크롭 시 panX/panY 클램프 — 이미지가 프레임 밖으로 너무 빠지지 않도록
  const clampTranslate = (s: number, t: number, axis: 'x' | 'y'): number => {
    if (!imgSize) return t;
    const fitScale = baseFitScale * s;
    const displayed =
      axis === 'x' ? imgSize.w * fitScale : imgSize.h * fitScale;
    const frameSize = axis === 'x' ? frame.w : frame.h;
    const maxOffset = Math.max(0, (displayed - frameSize) / 2);
    if (t > maxOffset) return maxOffset;
    if (t < -maxOffset) return -maxOffset;
    return t;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = baseScale.value * e.scale;
      scale.value = Math.min(Math.max(next, 1), 6);
    })
    .onEnd(() => {
      baseScale.value = scale.value;
      // 줌 변경 후 pan 도 다시 클램프
      tx.value = withTiming(clampTranslateInWorklet(scale.value, tx.value, 'x'));
      ty.value = withTiming(clampTranslateInWorklet(scale.value, ty.value, 'y'));
      baseTx.value = tx.value;
      baseTy.value = ty.value;
    });

  function clampTranslateInWorklet(s: number, t: number, axis: 'x' | 'y'): number {
    'worklet';
    if (!imgSize) return t;
    const fitScale = baseFitScale * s;
    const displayed = axis === 'x' ? imgSize.w * fitScale : imgSize.h * fitScale;
    const frameSize = axis === 'x' ? frame.w : frame.h;
    const maxOffset = Math.max(0, (displayed - frameSize) / 2);
    if (t > maxOffset) return maxOffset;
    if (t < -maxOffset) return -maxOffset;
    return t;
  }

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = clampTranslateInWorklet(scale.value, baseTx.value + e.translationX, 'x');
      ty.value = clampTranslateInWorklet(scale.value, baseTy.value + e.translationY, 'y');
    })
    .onEnd(() => {
      baseTx.value = tx.value;
      baseTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      baseScale.value = 1;
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      baseTx.value = 0;
      baseTy.value = 0;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);
  const allGestures = Gesture.Race(doubleTap, composed);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const layoutW = e.nativeEvent.layout.width;
    const w = layoutW;
    const h = w / aspectRatio;
    setFrame({ w, h });
  };

  const handleConfirm = async () => {
    if (!sourceUri || !imgSize || frame.w <= 0) return;
    setBusy(true);
    try {
      // 화면상 변환을 이미지 좌표계 크롭으로 환산
      const totalScale = baseFitScale * scale.value;
      // 크롭 폭/높이 (이미지 픽셀 기준)
      const cropW = frame.w / totalScale;
      const cropH = frame.h / totalScale;
      // 프레임 중심이 이미지 좌표계에서 어디인가 (px)
      // 변환된 이미지 중심이 화면상 (frame.w/2 + tx, frame.h/2 + ty)
      // 프레임 중심은 (frame.w/2, frame.h/2)
      // 이미지 좌표계에서 프레임 중심 = 이미지 중심 - (tx/totalScale, ty/totalScale)
      const cx = imgSize.w / 2 - tx.value / totalScale;
      const cy = imgSize.h / 2 - ty.value / totalScale;
      const originX = Math.max(0, Math.min(imgSize.w - cropW, cx - cropW / 2));
      const originY = Math.max(0, Math.min(imgSize.h - cropH, cy - cropH / 2));

      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [
          {
            crop: {
              originX,
              originY,
              width: cropW,
              height: cropH,
            },
          },
          {
            resize: {
              width: outputWidth,
              height: Math.round(outputWidth / aspectRatio),
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      onConfirm(result.uri);
    } catch (e) {
      console.error('ImageCropper crop failed:', e);
      // 실패 시 그래도 modal 닫고 원본 그대로 사용
      onConfirm(sourceUri);
    } finally {
      setBusy(false);
    }
  };

  // imgSize 가 아직 없으면 placeholder 표시
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} disabled={busy} hitSlop={10}>
            <Text style={[styles.headerBtn, busy && styles.headerBtnDisabled]}>
              취소
            </Text>
          </Pressable>
          <Text style={styles.title}>배너 영역 조정</Text>
          <Pressable onPress={handleConfirm} disabled={busy || !imgSize} hitSlop={10}>
            <Text
              style={[
                styles.headerBtnPrimary,
                (busy || !imgSize) && styles.headerBtnDisabled,
              ]}
            >
              {busy ? '처리 중...' : '적용'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.cropArea} onLayout={onLayout}>
          {sourceUri && imgSize && frame.w > 0 && (
            <GestureDetector gesture={allGestures}>
              <Animated.View style={[styles.cropFrame, { width: frame.w, height: frame.h }]}>
                <Animated.Image
                  source={{ uri: sourceUri }}
                  style={[
                    {
                      width: imgSize.w * baseFitScale,
                      height: imgSize.h * baseFitScale,
                      position: 'absolute',
                      left: (frame.w - imgSize.w * baseFitScale) / 2,
                      top: (frame.h - imgSize.h * baseFitScale) / 2,
                    },
                    animatedImageStyle,
                  ]}
                  resizeMode="cover"
                />
              </Animated.View>
            </GestureDetector>
          )}
          {!imgSize && sourceUri && (
            <View style={styles.loading}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.hintBox}>
          <Text style={styles.hint}>
            • 두 손가락으로 확대/축소 (마우스: 휠 X — 핀치 또는 더블탭으로 리셋)
          </Text>
          <Text style={styles.hint}>• 한 손가락으로 위치 이동</Text>
          <Text style={styles.hint}>• 더블탭으로 원래 크기로 복귀</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerBtn: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerBtnPrimary: { fontSize: 15, fontWeight: '800', color: '#FF8A2B' },
  headerBtnDisabled: { opacity: 0.4 },

  cropArea: {
    marginHorizontal: 16,
    aspectRatio: undefined,
    flexShrink: 0,
    height: undefined,
  },
  cropFrame: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
  },

  loading: { padding: 40, alignItems: 'center' },

  hintBox: {
    marginTop: 24,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});
