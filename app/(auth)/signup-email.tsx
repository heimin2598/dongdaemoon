import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

export default function SignupScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role: UserRole = params.role === 'merchant' ? 'merchant' : 'visitor';
  const isMerchant = role === 'merchant';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { signUpEmail, loading } = useAuthStore();

  const onSignup = async () => {
    setError(null);
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await signUpEmail(email.trim(), password, displayName.trim() || undefined, role);
      const next = useAuthStore.getState().user;
      if (next?.role === 'merchant' && next.status !== 'active') {
        router.replace('/(auth)/pending-approval');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      setError(e.message ?? '회원가입에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={isMerchant ? '매장 사장님 회원가입' : '회원가입'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>이메일로 가입</Text>
          <Text style={styles.desc}>
            {isMerchant
              ? '가입 후 관리자 승인이 완료되면 앱을 이용할 수 있습니다.'
              : '동대문 종합시장 셰르파를 시작해 보세요.'}
          </Text>

          <TextInput
            label="이메일"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            label="닉네임 (선택)"
            placeholder="표시 이름"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            label="비밀번호"
            placeholder="6자 이상"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            label="비밀번호 확인"
            placeholder="다시 입력"
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            error={error ?? undefined}
          />

          <Button label="회원가입" onPress={onSignup} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: 10 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, marginTop: 6 },
});
