import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { subscribeToProfile } from '@/lib/auth/firebaseAuth';
import { showInfoAlert } from '@/utils/alerts';
import { APPROVAL_PENDING_FLAG } from '@/constants/approval';

export default function PendingApprovalScreen() {
  const { user, refreshUser, signOut } = useAuthStore();
  const [checking, setChecking] = useState(false);

  // 화면 진입 시 "승인 대기 상태였음" 플래그를 남긴다 → 홈에서 알림 표시 트리거
  useEffect(() => {
    AsyncStorage.setItem(APPROVAL_PENDING_FLAG, '1').catch(() => {});
  }, []);

  // 본인 프로필 실시간 구독 — 어드민이 Firebase Console이나 어드민 페이지에서 승인하면 즉시 반영
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToProfile(user.id, (profile) => {
      if (!profile) return;
      if (profile.status === 'active') {
        showInfoAlert('승인 완료', '관리자가 가입을 승인했습니다.\n동대문 종합시장 셰르파를 시작하세요!', () => {
          AsyncStorage.removeItem(APPROVAL_PENDING_FLAG).catch(() => {});
          router.replace('/(tabs)/home');
        }, '시작하기');
      } else if (profile.status !== user.status) {
        // pending → rejected 등의 변화도 store에 반영
        refreshUser();
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onRefresh = async () => {
    setChecking(true);
    try {
      await refreshUser();
      const next = useAuthStore.getState().user;
      if (next?.status === 'active') {
        AsyncStorage.removeItem(APPROVAL_PENDING_FLAG).catch(() => {});
        router.replace('/(tabs)/home');
      }
    } finally {
      setChecking(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/(auth)/title');
  };

  const isRejected = user?.status === 'rejected';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{isRejected ? '⚠️' : '⏳'}</Text>
        </View>

        <Text style={styles.title}>
          {isRejected ? '가입이 거부되었습니다' : '승인 대기 중입니다'}
        </Text>

        <Text style={styles.body}>
          {isRejected
            ? '관리자가 가입 요청을 거부했습니다.\n자세한 사유는 관리자에게 문의해 주세요.'
            : '매장 사장님 회원가입 신청이 접수되었습니다.\n관리자 확인 후 승인되면 앱을 이용할 수 있습니다.'}
        </Text>

        <View style={styles.infoBox}>
          <InfoRow label="이메일" value={user?.email ?? '-'} />
          <InfoRow label="이름" value={user?.displayName ?? '-'} />
          <InfoRow
            label="상태"
            value={isRejected ? '거부됨' : '승인 대기 중'}
            valueColor={isRejected ? Colors.danger : Colors.primary}
          />
        </View>

        <View style={styles.btnGroup}>
          <Button
            label={checking ? '확인 중...' : '승인 상태 다시 확인'}
            onPress={onRefresh}
            loading={checking}
          />
          <Button label="로그아웃" variant="secondary" onPress={onSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingTop: 60, gap: 16 },
  iconWrap: { alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 64 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  rowValue: { fontSize: 14, color: Colors.text, fontWeight: '700' },
  btnGroup: { gap: 10, marginTop: 8 },
});
