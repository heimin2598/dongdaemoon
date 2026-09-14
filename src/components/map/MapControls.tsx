import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen?: () => void;
  onExitFullscreen?: () => void;
  /** false면 +/-/리셋 버튼 숨김 (기본 true) */
  showZoomButtons?: boolean;
}

/**
 * 지도 오버레이 컨트롤: 줌 +/- · 리셋 · 전체보기 토글
 */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  onExitFullscreen,
  showZoomButtons = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = 12 + insets.bottom;
  return (
    <>
      {/* 좌측 하단: 줌 컨트롤 (showZoomButtons=true면 +/-/리셋, false면 리셋만) */}
      <View style={[styles.zoomGroup, { bottom }]} pointerEvents="box-none">
        {showZoomButtons && (
          <>
            <Pressable style={styles.button} onPress={onZoomIn}>
              <Text style={styles.buttonText}>＋</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.button} onPress={onZoomOut}>
              <Text style={styles.buttonText}>－</Text>
            </Pressable>
            <View style={styles.divider} />
          </>
        )}
        <Pressable style={styles.button} onPress={onReset}>
          <Text style={[styles.buttonText, { fontSize: 16 }]}>⟲</Text>
        </Pressable>
      </View>

      {/* 우측 하단: 전체보기 토글 */}
      {onFullscreen && (
        <Pressable style={[styles.fullscreenButton, { bottom }]} onPress={onFullscreen} accessibilityLabel="전체보기">
          <Text style={styles.fullscreenIcon}>⛶</Text>
        </Pressable>
      )}
      {onExitFullscreen && (
        <Pressable style={[styles.fullscreenButton, { bottom }]} onPress={onExitFullscreen} accessibilityLabel="전체보기 해제">
          <Text style={styles.fullscreenIcon}>✕</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  zoomGroup: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    opacity: 0.7,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  button: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontSize: 20, fontWeight: '700', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.divider },
  fullscreenButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fullscreenIcon: { fontSize: 18, color: Colors.text, fontWeight: '600' },
});
