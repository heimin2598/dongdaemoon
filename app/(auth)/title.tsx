import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import { Button } from '@/components/common/Button';

export default function TitleScreen() {
  return (
    <View style={styles.root}>
      {/* 배경 비디오 (루프 + 음소거 + 자동재생) */}
      <Video
        source={require('@assets/images/title_video.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
      />

      {/* 가독성 개선용 어두운 오버레이 */}
      <View style={styles.overlay} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* 상단 텍스트 블록 */}
        <View style={styles.top}>
          <Text style={styles.title}>동대문 종합시장</Text>
          <Text style={styles.title}>셰르파</Text>
          <Text style={styles.subtitle}>복잡한 동대문 종합시장이 쉬워지다</Text>
          <Text style={styles.credit}>designed by heimin studio</Text>
        </View>

        {/* 하단 버튼 블록 */}
        <View style={styles.bottom}>
          <Button label="로그인" onPress={() => router.push('/(auth)/login')} style={styles.btn} />
          <Button
            label="회원가입"
            variant="secondary"
            onPress={() => router.push('/(auth)/signup-select')}
            style={{ ...styles.btn, ...styles.btnSecondary }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  top: {
    marginTop: 16,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  credit: {
    marginTop: 6,
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottom: {
    gap: 12,
    paddingBottom: 8,
  },
  btn: {
    height: 56,
    width: '100%',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 0,
  },
});
