import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { showInfoAlert } from '@/utils/alerts';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { signInEmail, signInGoogle, signInApple, loading } = useAuthStore();
  const { promptGoogleSignIn } = useGoogleAuth();
  const { promptAppleSignIn, available: appleAvailable } = useAppleAuth();

  const goAfterLogin = () => {
    const next = useAuthStore.getState().user;
    if (next?.role === 'merchant' && next.status !== 'active') {
      router.replace('/(auth)/pending-approval');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const onLogin = async () => {
    setError(null);
    try {
      await signInEmail(email.trim(), password);
      goAfterLogin();
    } catch (e: any) {
      setError(e.message ?? '로그인에 실패했습니다.');
    }
  };

  const onGoogle = async () => {
    try {
      const outcome = await promptGoogleSignIn();
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'idToken') {
        await signInGoogle('visitor', outcome.idToken);
      } else {
        await signInGoogle('visitor');
      }
      goAfterLogin();
    } catch (e: any) {
      showInfoAlert('Google 로그인 실패', e?.message ?? '잠시 후 다시 시도해 주세요.');
    }
  };

  const onApple = async () => {
    try {
      const outcome = await promptAppleSignIn();
      if (outcome.kind === 'cancelled' || outcome.kind === 'unsupported') return;
      if (outcome.kind === 'idToken') {
        await signInApple('visitor', outcome.idToken, outcome.rawNonce);
      } else {
        await signInApple('visitor');
      }
      goAfterLogin();
    } catch (e: any) {
      const msg = e?.message ?? '잠시 후 다시 시도해 주세요.';
      const hint = /provider|operation-not-allowed|configuration/i.test(msg)
        ? '\n\nFirebase Console에서 Apple provider가 활성화되어 있는지 확인해 주세요.'
        : '';
      showInfoAlert('Apple 로그인 실패', msg + hint);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('auth.signIn')} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>다시 오신 걸 환영합니다</Text>
          <Text style={styles.desc}>동대문 종합시장 셰르파로 원하는 곳을 빠르게 찾으세요.</Text>

          <TextInput
            testID="emailInput"
            label={t('auth.email')}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            testID="passwordInput"
            label={t('auth.password')}
            placeholder="••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={error ?? undefined}
          />

          <Button label={t('auth.signIn')} onPress={onLogin} loading={loading} />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end', marginTop: 10 }}
          >
            <Text style={styles.link}>비밀번호를 잊으셨나요?</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.line} />
          </View>

          <Button
            label={t('auth.googleSignIn')}
            variant="secondary"
            onPress={onGoogle}
            style={{ marginBottom: 10 }}
          />
          {appleAvailable && (
            <Button
              label={t('auth.appleSignIn')}
              variant="secondary"
              onPress={onApple}
            />
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>아직 계정이 없으신가요?</Text>
            <Pressable onPress={() => router.push('/(auth)/signup-select')}>
              <Text style={styles.link}> 회원가입</Text>
            </Pressable>
          </View>
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
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 10, color: Colors.textMuted, fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: Colors.textMuted, fontSize: 14 },
});
