import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAppleAuth } from '@/hooks/useAppleAuth';
import { showInfoAlert } from '@/utils/alerts';

export default function SignupScreen() {
  const { signInGoogle, signInApple, loading } = useAuthStore();
  const { promptGoogleSignIn } = useGoogleAuth();
  const { promptAppleSignIn, available: appleAvailable } = useAppleAuth();

  const onGoogle = async () => {
    try {
      const outcome = await promptGoogleSignIn();
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'idToken') {
        await signInGoogle('visitor', outcome.idToken);
      } else {
        await signInGoogle('visitor');
      }
      router.replace('/(tabs)/home');
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
      router.replace('/(tabs)/home');
    } catch (e: any) {
      const msg = e?.message ?? '잠시 후 다시 시도해 주세요.';
      const hint = /provider|operation-not-allowed|configuration/i.test(msg)
        ? '\n\nFirebase Console에서 Apple provider가 활성화되어 있는지 확인해 주세요.'
        : '';
      showInfoAlert('Apple 로그인 실패', msg + hint);
    }
  };

  const onEmail = () => {
    router.push('/(auth)/signup-email');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="회원가입" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>회원가입 방법 선택</Text>
        <Text style={styles.desc}>원하는 방법으로 가입하고 바로 시작해 보세요.</Text>

        <View style={styles.buttonBlock}>
          <ProviderButton
            label="구글 계정으로 회원가입"
            icon="G"
            iconBg="#fff"
            iconColor="#4285F4"
            bg="#fff"
            color="#202124"
            border={Colors.border}
            onPress={onGoogle}
            disabled={loading}
          />
          {appleAvailable && (
            <ProviderButton
              label="애플 계정으로 회원가입"
              icon=""
              iconBg="transparent"
              iconColor="#fff"
              bg="#000"
              color="#fff"
              onPress={onApple}
              disabled={loading}
            />
          )}
          <ProviderButton
            label="이메일로 회원가입"
            icon="✉"
            iconBg={Colors.primary}
            iconColor="#fff"
            bg={Colors.surface}
            color={Colors.text}
            border={Colors.primary}
            onPress={onEmail}
          />
        </View>

        <Text style={styles.footer}>이미 계정이 있으신가요? <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>로그인</Text></Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProviderButtonProps {
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  bg: string;
  color: string;
  border?: string;
  onPress: () => void;
  disabled?: boolean;
}

function ProviderButton({ label, icon, iconBg, iconColor, bg, color, border, onPress, disabled }: ProviderButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.providerBtn,
        { backgroundColor: bg, borderColor: border ?? 'transparent', borderWidth: border ? 1.5 : 0 },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Text style={[styles.iconText, { color: iconColor }]}>{icon}</Text>
      </View>
      <Text style={[styles.providerLabel, { color }]}>{label}</Text>
      <View style={{ width: 32 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: 10 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, marginBottom: 28, marginTop: 6 },
  buttonBlock: { gap: 10 },
  providerBtn: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 16, fontWeight: '900' },
  providerLabel: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  footer: { marginTop: 28, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  link: { color: Colors.primary, fontWeight: '700' },
});
