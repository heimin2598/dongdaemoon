import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const onSubmit = async () => {
    setError(null);
    try {
      await resetPassword(email.trim());
      setSent(true);
      Alert.alert('안내', '비밀번호 재설정 안내를 전송했습니다. (데모 환경에서는 실제 메일이 발송되지 않습니다.)', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="비밀번호 찾기" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>등록된 이메일을 입력해 주세요</Text>
        <Text style={styles.desc}>입력하신 이메일로 비밀번호 재설정 안내를 보내드립니다.</Text>
        <TextInput
          label="이메일"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={error ?? undefined}
        />
        <Button label={sent ? '전송 완료' : '재설정 메일 보내기'} onPress={onSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, marginTop: 6 },
});
