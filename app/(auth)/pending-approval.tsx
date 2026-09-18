import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Hourglass, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { subscribeToProfile } from '@/lib/auth/firebaseAuth';
import { subscribeMyLatestClaim } from '@/lib/merchantClaims';
import { showInfoAlert } from '@/utils/alerts';
import { APPROVAL_PENDING_FLAG } from '@/constants/approval';
import { formatStoreLocation, getStoreByCode } from '@/data/stores';
import type { MerchantClaim } from '@/types';

export default function PendingApprovalScreen() {
  const { t } = useTranslation();
  const { user, refreshUser, signOut } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const [claim, setClaim] = useState<MerchantClaim | null>(null);
  const [claimLoaded, setClaimLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.setItem(APPROVAL_PENDING_FLAG, '1').catch(() => {});
  }, []);

  // 본인 프로필 실시간 구독 — 어드민이 승인하면 즉시 반영
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToProfile(user.id, (profile) => {
      if (!profile) return;
      if (profile.status === 'active') {
        showInfoAlert(
          '승인 완료',
          '운영자가 매장 인증을 승인했습니다.\n동대문 종합시장 셰르파를 시작하세요!',
          () => {
            AsyncStorage.removeItem(APPROVAL_PENDING_FLAG).catch(() => {});
            router.replace('/(tabs)/home');
          },
          '시작하기',
        );
      } else if (profile.status !== user.status) {
        refreshUser();
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 본인 클레임 구독 — 없으면 매칭 페이지로 안내
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeMyLatestClaim(user.id, (c) => {
      setClaim(c);
      setClaimLoaded(true);
    });
    return () => unsub();
  }, [user?.id]);

  // 사용자가 pending 상태인데 클레임이 아직 없으면 매칭 페이지로 강제 이동
  useEffect(() => {
    if (!claimLoaded) return;
    if (user?.role === 'merchant' && user.status !== 'active' && !claim) {
      router.replace('/(auth)/signup-match');
    }
  }, [claimLoaded, claim, user]);

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

  const onContactAdmin = () => {
    router.push('/inquiry-new');
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/(auth)/title');
  };

  const isRejected = claim?.status === 'rejected' || user?.status === 'rejected';
  const isApproved = claim?.status === 'approved' && user?.status === 'active';

  // 매장 정보 — existing 은 디렉터리 조회, new 는 입력값
  const storeFromDirectory = claim?.storeCode ? getStoreByCode(claim.storeCode) : undefined;
  const storeName = claim?.claimType === 'existing'
    ? (storeFromDirectory?.name ?? claim.storeCode ?? '-')
    : (claim?.newStore?.name ?? '-');
  const storeLocation = claim?.claimType === 'existing'
    ? (storeFromDirectory ? formatStoreLocation(storeFromDirectory) || '-' : '-')
    : (claim?.newStore?.address ?? '-');

  if (!claimLoaded) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          {isApproved ? (
            <ShieldCheck size={56} color="#1B7A3E" strokeWidth={2} />
          ) : isRejected ? (
            <AlertTriangle size={56} color={Colors.danger} strokeWidth={2} />
          ) : (
            <Hourglass size={56} color={Colors.primary} strokeWidth={2} />
          )}
        </View>

        <Text style={styles.title}>
          {isApproved
            ? t('pending.approved')
            : isRejected
              ? t('pending.rejected')
              : t('pending.inProgress')}
        </Text>

        <Text style={styles.body}>
          {isApproved
            ? '동대문 종합시장 셰르파의 모든 사장님 기능을 사용하실 수 있습니다.'
            : isRejected
              ? `${claim?.rejectReason ?? '운영자가 신청 정보를 확인했습니다.'}\n자세한 사유는 운영자에게 문의해 주세요.`
              : '운영자가 신청하신 매장 정보를 확인 중입니다.\n승인이 완료되면 사장님 기능을 모두 사용하실 수 있습니다.'}
        </Text>

        {claim?.shortId && !isApproved && (
          <View style={styles.idCard}>
            <Text style={styles.idLabel}>{t('pending.applicationId')}</Text>
            <Text style={styles.idValue}>{claim.shortId}</Text>
            <Text style={styles.idHint}>
              운영자가 전화로 신청 ID를 확인하실 수 있어요.{'\n'}이때 위 ID를 말씀해 주세요.
            </Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <View style={styles.infoHead}>
            <Text style={styles.infoHeadLabel}>인증 상태</Text>
            <StatusPill status={claim?.status ?? (user?.status === 'rejected' ? 'rejected' : 'pending')} />
          </View>
          {claim && (
            <>
              <InfoRow label="매장" value={storeName} />
              <InfoRow label="위치" value={storeLocation} />
              <InfoRow
                label="유형"
                value={claim.claimType === 'existing' ? '기존 업체 매칭' : '직접 등록 신청'}
              />
              <InfoRow label="연락처" value={claim.applicantPhone || '-'} />
              <InfoRow
                label="신청일"
                value={new Date(claim.createdAt).toLocaleString('ko-KR')}
              />
            </>
          )}
        </View>

        <View style={styles.btnGroup}>
          <Button
            label={checking ? t('common.loading') : t('pending.refresh')}
            onPress={onRefresh}
            loading={checking}
          />
          <Button label={t('pending.askAdmin')} variant="secondary" onPress={onContactAdmin} />
          {isRejected && (
            <Button
              label={t('pending.retry')}
              variant="secondary"
              onPress={() => router.replace('/(auth)/signup-match')}
            />
          )}
          <Button label={t('auth.logout')} variant="secondary" onPress={onSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({
  status,
}: {
  status: 'pending' | 'approved' | 'rejected';
}) {
  const cfg =
    status === 'approved'
      ? { label: '승인 완료', bg: '#E0F2E9', color: '#1B7A3E' }
      : status === 'rejected'
        ? { label: '거부됨', bg: '#FBE4E4', color: Colors.danger }
        : { label: '운영자 확인 중', bg: '#FFF3D6', color: '#A66A00' };
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
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
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingTop: 40, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignItems: 'center', marginBottom: 4 },
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
    marginBottom: 8,
  },
  idCard: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#F0F4FB',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    gap: 6,
  },
  idLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  idValue: { fontSize: 28, fontWeight: '900', color: Colors.primary, letterSpacing: 2 },
  idHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  infoHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoHeadLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { width: 70, fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '600' },
  btnGroup: { gap: 10, marginTop: 8 },
});
