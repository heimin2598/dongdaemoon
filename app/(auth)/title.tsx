import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { LanguagePicker } from '@/components/common/LanguagePicker';

const titleVideoSource = require('@assets/images/title_video.mp4');

export default function TitleScreen() {
  const { t } = useTranslation();
  // expo-video 로 교체 (SDK 54 에서 expo-av deprecated). iOS 26.5 의 Swift Concurrency
  // 호환 문제 회피용 — Apple 심사에서 반복 반려된 launch crash 의 유력 원인이었음.
  const player = useVideoPlayer(titleVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={styles.root}>
      {/* 배경 비디오 (루프 + 음소거 + 자동재생) — 터치 가로채지 않도록 pointerEvents none */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />

      {/* 가독성 개선용 어두운 오버레이 */}
      <View style={styles.overlay} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* 상단: 언어 칩 (우측 정렬) + 텍스트 블록 */}
        <View>
          <View style={styles.langWrap}>
            <LanguagePicker tint="#fff" />
          </View>
          <View style={styles.top}>
            <Text style={styles.title}>동대문 종합시장</Text>
            <Text style={styles.title}>셰르파</Text>
            <Text style={styles.subtitle}>복잡한 동대문 종합시장이 쉬워지다</Text>
            <Text style={styles.credit}>designed by heimin studio</Text>
          </View>
        </View>

        {/* 하단 버튼 블록 */}
        <View style={styles.bottom}>
          <Button label={t('auth.signIn')} onPress={() => router.push('/(auth)/login')} style={styles.btn} />
          <Button
            label={t('auth.signUp')}
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
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  langWrap: { alignItems: 'flex-end', marginTop: 4, marginBottom: 8 },
  top: {
    marginTop: 8,
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
