import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
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
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signUpEmail, loading } = useAuthStore();

  const onSignup = async () => {
    setError(null);
    if (!agreed) {
      setError('이용약관 및 개인정보처리방침에 동의해 주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await signUpEmail(email.trim(), password, displayName.trim() || undefined, role);
      const next = useAuthStore.getState().user;
      if (next?.role === 'merchant' && next.status !== 'active') {
        // 신규 가입 직후 → 매장 매칭 페이지로
        router.replace('/(auth)/signup-match');
      } else {
        // visitor 가입 직후 → paywall 페이지로 (무료 회원으로 계속 또는 프리미엄 전환 선택)
        router.replace({ pathname: '/paywall', params: { fromSignup: '1' } } as any);
      }
    } catch (e: any) {
      setError(e.message ?? '회원가입에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

          <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Check size={14} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={styles.agreeText}>
              <Text style={styles.required}>(필수) </Text>
              <Text
                style={styles.agreeLink}
                onPress={() => router.push('/terms-of-service')}
              >
                이용약관
              </Text>
              {' 및 '}
              <Text
                style={styles.agreeLink}
                onPress={() => router.push('/privacy-policy')}
              >
                개인정보처리방침
              </Text>
              에 동의합니다.
            </Text>
          </Pressable>

          <Button label="회원가입" onPress={onSignup} loading={loading} disabled={!agreed} />
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
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginTop: 2,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  agreeText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  required: { color: Colors.danger, fontWeight: '700' },
  agreeLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
});
