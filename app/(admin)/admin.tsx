import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUpCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  Gift,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  Shield,
  Store,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';

const T = {
  bg: '#F5F7FA',
  panel: '#FFFFFF',
  border: '#E5E9F0',
  divider: '#EEF2F7',
  text: '#0F1729',
  textMuted: '#6B7280',
  textDim: '#94A3B8',
  primary: '#2563EB',
  primaryDeep: '#1E3A8A',
  primarySoft: '#EFF4FF',
  success: '#10B981',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  gold: '#F3B21B',
};

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  activeMerchants: number;
  pendingClaims: number;
  openInquiries: number;
  openAdInquiries: number;
  new7d: number;
  totalPromoCodes: number;
  usedPromoCodes: number;
}

const DEFAULT: Stats = {
  totalUsers: 0,
  premiumUsers: 0,
  activeMerchants: 0,
  pendingClaims: 0,
  openInquiries: 0,
  openAdInquiries: 0,
  new7d: 0,
  totalPromoCodes: 0,
  usedPromoCodes: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const me = useAuthStore((s) => s.user);
  const [w, setW] = useState<number>(() => Dimensions.get('window').width);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);

  const isMobileApp = Platform.OS !== 'web';
  const isNarrow = w < 768;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = Date.now();
        const cutoff7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const [
          totalUsers,
          activeMerchants,
          pendingClaims,
          openInquiries,
          openAdInquiries,
          new7d,
          totalPromoCodes,
          usedPromoCodes,
          premiumUsers,
        ] = await Promise.all([
          count(collection(db, 'users')),
          count(
            query(collection(db, 'users'), where('role', '==', 'merchant'), where('status', '==', 'active')),
          ),
          count(query(collection(db, 'merchantClaims'), where('status', '==', 'pending'))),
          count(query(collection(db, 'inquiries'), where('status', 'in', ['open', 'in_progress']))),
          count(query(collection(db, 'adInquiries'), where('status', '==', 'pending'))),
          count(query(collection(db, 'users'), where('createdAt', '>=', cutoff7))),
          count(collection(db, 'promoCodes')),
          count(query(collection(db, 'promoCodes'), where('usedBy', '!=', null))),
          countPremiumUsers(),
        ]);
        if (cancelled) return;
        setStats({
          totalUsers,
          activeMerchants,
          pendingClaims,
          openInquiries,
          openAdInquiries,
          new7d,
          totalPromoCodes,
          usedPromoCodes,
          premiumUsers,
        });
      } catch (err) {
        console.error('dashboard stats failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const conversion = stats.totalUsers > 0 ? (stats.premiumUsers / stats.totalUsers) * 100 : 0;
  const pending = stats.pendingClaims + stats.openInquiries + stats.openAdInquiries;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return '늦은 밤이네요';
    if (h < 12) return '좋은 아침입니다';
    if (h < 18) return '좋은 오후입니다';
    return '좋은 저녁이네요';
  })();

  const content = (
    <ScrollView
      contentContainerStyle={[styles.scroll, isNarrow && styles.scrollNarrow]}
      showsVerticalScrollIndicator={false}
    >
      {/* 웰컴 헤더 */}
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeGreet}>{greeting}, 👋</Text>
          <Text style={styles.welcomeTitle}>
            {me?.displayName ?? '운영자'}님
          </Text>
          <Text style={styles.welcomeSub}>DDM Sherpa 관리자 포털에 오신 것을 환영합니다</Text>
        </View>
        {!isNarrow && (
          <View style={styles.notifBox}>
            <Bell size={18} color={T.text} strokeWidth={2.2} />
            {pending > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifDotText}>{pending > 99 ? '99+' : pending}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={T.primary} />
        </View>
      ) : (
        <>
          {/* 처리 필요 알림 */}
          {pending > 0 && (
            <Pressable
              style={styles.attentionBanner}
              onPress={() => router.push('/admin-merchants')}
            >
              <View style={styles.attentionIcon}>
                <Bell size={16} color={T.warning} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attentionTitle}>
                  처리 필요 {pending}건
                </Text>
                <Text style={styles.attentionDesc}>
                  매장 인증 {stats.pendingClaims} · 문의 {stats.openInquiries} · 광고 문의 {stats.openAdInquiries}
                </Text>
              </View>
              <ArrowUpRight size={18} color={T.warning} strokeWidth={2.4} />
            </Pressable>
          )}

          {/* 핵심 KPI 그리드 */}
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              Icon={Users}
              label="총 회원"
              value={stats.totalUsers}
              sub={`이번 주 신규 +${stats.new7d}`}
              color={T.primary}
              soft={T.primarySoft}
              onPress={() => router.push('/admin-users')}
            />
            <KpiCard
              Icon={Shield}
              label="프리미엄 회원"
              value={stats.premiumUsers}
              sub={`전환율 ${conversion.toFixed(1)}%`}
              color={T.gold}
              soft="#FEF9E7"
              onPress={() => router.push('/admin-users')}
            />
            <KpiCard
              Icon={Store}
              label="활성 사장님"
              value={stats.activeMerchants}
              sub="인증 완료"
              color={T.success}
              soft={T.successSoft}
              onPress={() => router.push('/admin-users')}
            />
            <KpiCard
              Icon={Gift}
              label="프로모션 사용"
              value={`${stats.usedPromoCodes}/${stats.totalPromoCodes}`}
              sub={`남은 ${stats.totalPromoCodes - stats.usedPromoCodes}개`}
              color="#8B5CF6"
              soft="#F3E8FF"
              onPress={() => router.push('/admin-promo-codes')}
            />
          </View>

          {/* 처리 대기 위젯 */}
          <Text style={styles.sectionTitle}>처리 대기</Text>
          <View style={styles.attentionGrid}>
            <AttentionCard
              Icon={UserCheck}
              label="매장 인증 신청"
              count={stats.pendingClaims}
              color={T.warning}
              soft={T.warningSoft}
              onPress={() => router.push('/admin-merchants')}
            />
            <AttentionCard
              Icon={MessageCircle}
              label="문의 답변 대기"
              count={stats.openInquiries}
              color={T.primary}
              soft={T.primarySoft}
              onPress={() => router.push('/admin-inquiries')}
            />
            <AttentionCard
              Icon={Megaphone}
              label="광고 문의 대기"
              count={stats.openAdInquiries}
              color={T.danger}
              soft={T.dangerSoft}
              onPress={() => router.push('/admin-ad-inquiries')}
            />
          </View>

          {/* 통계 CTA */}
          <Pressable style={styles.ctaBanner} onPress={() => router.push('/admin-stats')}>
            <View style={styles.ctaIconBox}>
              <BarChart3 size={22} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>상세 통계 보기</Text>
              <Text style={styles.ctaDesc}>회원 증가 추이 · 기능별 사용량 · 프리미엄 전환율</Text>
            </View>
            <ArrowUpRight size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>

          {/* 전체 관리 메뉴 */}
          <Text style={styles.sectionTitle}>관리 메뉴</Text>
          <View style={styles.menuGrid}>
            <MenuCard Icon={Users} label="회원 관리" desc="회원 조회 · 프리미엄 · 차단 · 탈퇴" onPress={() => router.push('/admin-users')} />
            <MenuCard Icon={UserCheck} label="매장 인증" desc="사장님 매장 매칭 신청 심사" onPress={() => router.push('/admin-merchants')} />
            <MenuCard Icon={ImageIcon} label="홈 배너" desc="홈 화면 배너 관리" onPress={() => router.push({ pathname: '/admin-banners', params: { kind: 'home' } })} />
            <MenuCard Icon={ImageIcon} label="매장 배너" desc="매장 찾기 화면 배너" onPress={() => router.push({ pathname: '/admin-banners', params: { kind: 'search' } })} />
            <MenuCard Icon={Gift} label="프로모션 코드" desc="영구 프리미엄 코드 발급" onPress={() => router.push('/admin-promo-codes')} />
            <MenuCard Icon={MessageCircle} label="문의 관리" desc="일반 문의 답변 및 상태" onPress={() => router.push('/admin-inquiries')} />
            <MenuCard Icon={Megaphone} label="광고 문의" desc="광고 제휴 문의 관리" onPress={() => router.push('/admin-ad-inquiries')} />
            <MenuCard Icon={BarChart3} label="통계" desc="회원 · 매출 · 사용량 분석" onPress={() => router.push('/admin-stats')} />
            <MenuCard Icon={ArrowUpCircle} label="앱 버전" desc="업데이트 안내 · 강제 업데이트" onPress={() => router.push('/admin-app-version')} />
          </View>

          <View style={{ height: 48 }} />
        </>
      )}
    </ScrollView>
  );

  // 모바일 앱 관리자: SafeAreaView + 자체 헤더
  if (isMobileApp) {
    return (
      <SafeAreaView style={styles.mobileRoot} edges={['top', 'bottom']}>
        <View style={styles.mobileHeader}>
          <View>
            <Text style={styles.mobileHeaderBrand}>DDM Sherpa</Text>
            <Text style={styles.mobileHeaderSub}>Admin Portal</Text>
          </View>
          <UserPlus size={20} color={T.text} strokeWidth={2} />
        </View>
        {content}
      </SafeAreaView>
    );
  }

  // 웹: 사이드바 옆에 나오므로 SafeAreaView 없이 그냥 반환
  return <View style={styles.webRoot}>{content}</View>;
}

async function count(q: any): Promise<number> {
  try {
    const s = await getCountFromServer(q);
    return s.data().count;
  } catch {
    return 0;
  }
}

async function countPremiumUsers(): Promise<number> {
  try {
    const { collectionGroup, query, where } = await import('firebase/firestore');
    const q = query(collectionGroup(db, 'meta'), where('plan', '==', 'premium'));
    const s = await getCountFromServer(q);
    return s.data().count;
  } catch {
    return 0;
  }
}

function KpiCard({
  Icon,
  label,
  value,
  sub,
  color,
  soft,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  value: number | string;
  sub: string;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.kpiCard} onPress={onPress}>
      <View style={[styles.kpiIcon, { backgroundColor: soft }]}>
        <Icon size={20} color={color} strokeWidth={2.2} />
      </View>
      <View style={styles.kpiTop}>
        <ArrowUpRight size={14} color={T.textDim} strokeWidth={2} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiSub, { color }]}>{sub}</Text>
    </Pressable>
  );
}

function AttentionCard({
  Icon,
  label,
  count,
  color,
  soft,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  count: number;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.attentionCard} onPress={onPress}>
      <View style={[styles.attentionIconBig, { backgroundColor: soft }]}>
        <Icon size={22} color={color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.attentionCardLabel}>{label}</Text>
        <Text style={[styles.attentionCardCount, count > 0 ? { color } : { color: T.textDim }]}>
          {count}
          <Text style={styles.attentionCardUnit}> 건</Text>
        </Text>
      </View>
      <ChevronRight size={16} color={T.textDim} />
    </Pressable>
  );
}

function MenuCard({
  Icon,
  label,
  desc,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuCard} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Icon size={18} color={T.primary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuDesc} numberOfLines={1}>{desc}</Text>
      </View>
      <ChevronRight size={16} color={T.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  webRoot: { flex: 1, backgroundColor: T.bg },
  mobileRoot: { flex: 1, backgroundColor: T.bg },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: T.panel,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  mobileHeaderBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.3,
  },
  mobileHeaderSub: {
    fontSize: 9,
    color: T.textMuted,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  scroll: {
    padding: 32,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  scrollNarrow: { padding: 16 },
  loading: { padding: 60, alignItems: 'center' },

  // Welcome
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  welcomeGreet: { fontSize: 13, color: T.textMuted, fontWeight: '700' },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  welcomeSub: { fontSize: 13, color: T.textMuted, marginTop: 6 },

  notifBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Attention banner
  attentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: T.warningSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 24,
  },
  attentionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attentionTitle: { fontSize: 14, fontWeight: '900', color: T.text },
  attentionDesc: { fontSize: 12, color: T.textMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: T.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 32,
  },
  kpiCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.border,
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 220,
    position: 'relative',
  },
  kpiIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  kpiTop: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 6,
    borderRadius: 8,
    backgroundColor: T.bg,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.6,
  },
  kpiLabel: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
  },

  // Attention Grid
  attentionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  attentionCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 240,
    flexGrow: 1,
    flexBasis: 240,
  },
  attentionIconBig: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attentionCardLabel: { fontSize: 12, color: T.textMuted, fontWeight: '700' },
  attentionCardCount: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  attentionCardUnit: { fontSize: 12, fontWeight: '700', color: T.textMuted },

  // CTA banner
  ctaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    borderRadius: 16,
    backgroundColor: T.primaryDeep,
    marginBottom: 24,
  },
  ctaIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  ctaDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Menu Grid
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.border,
    minWidth: 260,
    flexGrow: 1,
    flexBasis: 260,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { fontSize: 13, fontWeight: '900', color: T.text },
  menuDesc: { fontSize: 11, color: T.textMuted, marginTop: 2 },
});
