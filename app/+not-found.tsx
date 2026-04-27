import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🧭</Text>
        <Text style={styles.title}>화면을 찾을 수 없어요</Text>
        <Text style={styles.desc}>
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </Text>
        <Button label="홈으로 돌아가기" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 24 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
