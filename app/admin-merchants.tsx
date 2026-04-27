import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { isAdminEmail } from '@/constants/admin';
import {
  approveMerchant,
  listMerchants,
  MerchantSummary,
  rejectMerchant,
  resetMerchantToPending,
} from '@/lib/auth/firebaseAuth';
import { showInfoAlert } from '@/utils/alerts';
import { UserStatus } from '@/types';

type Tab = 'pending' | 'all';

export default function AdminMerchantsScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('pending');
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingUid, setActingUid] = useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

  const load = useCallback(
    async (currentTab: Tab) => {
      setLoading(true);
      try {
        const filter: UserStatus | undefined = currentTab === 'pending' ? 'pending' : undefined;
        const list = await listMerchants(filter);
        setMerchants(list);
      } catch (e: any) {
        const code = e?.code ?? '';
        const msg = e?.message ?? String(e);
        const isPerm = code === 'permission-denied' || /permission/i.test(msg);
        showInfoAlert(
          '불러오기 실패',
          isPerm
            ? `Firestore 보안 규칙이 어드민의 사용자 조회를 막고 있습니다.\n\nFirebase Console → Firestore → 규칙 탭에서 어드민 규칙(isAdmin())을 적용했는지 확인하세요.\n\n에러: ${code || msg}`
            : `에러: ${code || msg}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAdmin) return;
    load(tab);
  }, [tab, isAdmin, load]);

  // 어드민이 아니면 접근 차단
  useEffect(() => {
    if (user && !isAdmin) {
      showInfoAlert('접근 권한 없음', '어드민 전용 페이지입니다.', () => router.back());
    }
  }, [user, isAdmin]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="어드민" />
        <View style={styles.center}>
          <Text style={styles.muted}>어드민 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onApprove = async (m: MerchantSummary) => {
    setActingUid(m.uid);
    try {
      await approveMerchant(m.uid);
      await load(tab);
    } catch (e) {
      showInfoAlert('승인 실패', '권한이 없거나 네트워크 오류입니다.\n보안 규칙이 어드민 이메일을 허용하는지 확인하세요.');
    } finally {
      setActingUid(null);
    }
  };

  const onReject = async (m: MerchantSummary) => {
    setActingUid(m.uid);
    try {
      await rejectMerchant(m.uid);
      await load(tab);
    } catch (e) {
      showInfoAlert('거부 실패', '권한이 없거나 네트워크 오류입니다.');
    } finally {
      setActingUid(null);
    }
  };

  const onReset = async (m: MerchantSummary) => {
    setActingUid(m.uid);
    try {
      await resetMerchantToPending(m.uid);
      await load(tab);
    } catch (e) {
      showInfoAlert('상태 변경 실패', '권한이 없거나 네트워크 오류입니다.');
    } finally {
      setActingUid(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="매장 사장님 승인 관리" />

      <View style={styles.tabs}>
        <TabButton label="승인 대기" active={tab === 'pending'} onPress={() => setTab('pending')} />
        <TabButton label="전체" active={tab === 'all'} onPress={() => setTab('all')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => load(tab)} tintColor={Colors.primary} />
        }
      >
        {loading && merchants.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : merchants.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              {tab === 'pending' ? '승인 대기 중인 매장 사장님이 없습니다.' : '매장 사장님 가입자가 없습니다.'}
            </Text>
          </View>
        ) : (
          merchants.map((m) => (
            <MerchantCard
              key={m.uid}
              m={m}
              busy={actingUid === m.uid}
              onApprove={() => onApprove(m)}
              onReject={() => onReject(m)}
              onReset={() => onReset(m)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active && styles.tabBtnActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

interface CardProps {
  m: MerchantSummary;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}

function MerchantCard({ m, busy, onApprove, onReject, onReset }: CardProps) {
  const created = m.createdAt?.toDate?.()
    ? m.createdAt.toDate().toLocaleString('ko-KR')
    : '-';
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName}>{m.displayName ?? '(닉네임 없음)'}</Text>
        <StatusBadge status={m.status} />
      </View>
      <Text style={styles.cardEmail}>{m.email}</Text>
      <Text style={styles.cardMeta}>가입일: {created}</Text>

      <View style={styles.cardActions}>
        {m.status === 'pending' && (
          <>
            <Button label="승인" onPress={onApprove} loading={busy} style={{ flex: 1 }} />
            <Button label="거부" variant="danger" onPress={onReject} loading={busy} style={{ flex: 1 }} />
          </>
        )}
        {m.status === 'active' && (
          <Button label="대기로 되돌리기" variant="secondary" onPress={onReset} loading={busy} style={{ flex: 1 }} />
        )}
        {m.status === 'rejected' && (
          <>
            <Button label="다시 승인" onPress={onApprove} loading={busy} style={{ flex: 1 }} />
            <Button label="대기로 되돌리기" variant="secondary" onPress={onReset} loading={busy} style={{ flex: 1 }} />
          </>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const cfg =
    status === 'active'
      ? { label: '승인됨', bg: '#E0F2E9', color: '#1B7A3E' }
      : status === 'rejected'
        ? { label: '거부됨', bg: '#FBE4E4', color: Colors.danger }
        : { label: '대기 중', bg: '#FFF3D6', color: '#A66A00' };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tabLabelActive: { color: '#fff' },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { fontSize: 13, color: Colors.textMuted },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
