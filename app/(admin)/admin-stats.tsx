import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  CreditCard,
  Crown,
  Gift,
  Heart,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Package,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/common/ScreenHeader';

/**
 * 관리자 통계 페이지.
 *
 * 데이터 소스: Firestore 컬렉션 count / 최근 문서 스캔.
 * - 총 회원 / 방문자 / 사장님 / 활성 사장님
 * - 신규 가입 (전체/7d/30d)
 * - DAU/WAU/MAU 근사값 (createdAt 기반 — 실질 활성 지표는 별도 tracking 필요)
 * - 프리미엄 회원 수 (users 하위 meta/entitlement 는 collection group 쿼리)
 * - 매장 등록 수 / 부자재 요청 수 / 리뷰 수 / 배너 수
 * - 프로모션 코드 (전체/사용됨)
 * - 문의 대기 / 광고 문의 대기 / 매장 인증 대기
 * - 14일 신규 가입 트렌드 (막대 차트)
 */

type Range = '7d' | '30d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  all: '전체',
};

interface Stats {
  totalUsers: number;
  visitors: number;
  merchants: number;
  activeMerchants: number;
  premiumUsers: number;
  new7d: number;
  new30d: number;
  totalShops: number;
  totalFavorites: number;
  totalPartsRequests: number;
  totalReviews: number;
  totalBanners: number;
  totalPromoCodes: number;
  usedPromoCodes: number;
  pendingClaims: number;
  openInquiries: number;
  openAdInquiries: number;
  dailySignups: Array<{ date: string; count: number }>;
}

const DEFAULT_STATS: Stats = {
  totalUsers: 0,
  visitors: 0,
  merchants: 0,
  activeMerchants: 0,
  premiumUsers: 0,
  new7d: 0,
  new30d: 0,
  totalShops: 0,
  totalFavorites: 0,
  totalPartsRequests: 0,
  totalReviews: 0,
  totalBanners: 0,
  totalPromoCodes: 0,
  usedPromoCodes: 0,
  pendingClaims: 0,
  openInquiries: 0,
  openAdInquiries: 0,
  dailySignups: [],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminStatsScreen() {
  const [range, setRange] = useState<Range>('7d');
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const now = Date.now();
      const cutoff7 = Timestamp.fromMillis(now - 7 * DAY_MS);
      const cutoff30 = Timestamp.fromMillis(now - 30 * DAY_MS);
      const cutoff14 = now - 14 * DAY_MS;

      const [
        totalUsers,
        visitors,
        merchants,
        activeMerchants,
        premiumUsers,
        new7d,
        new30d,
        totalShops,
        totalFavorites,
        totalPartsRequests,
        totalReviews,
        totalBanners,
        totalPromoCodes,
        usedPromoCodes,
        pendingClaims,
        openInquiries,
        openAdInquiries,
      ] = await Promise.all([
        count(collection(db, 'users')),
        count(query(collection(db, 'users'), where('role', '==', 'visitor'))),
        count(query(collection(db, 'users'), where('role', '==', 'merchant'))),
        count(
          query(
            collection(db, 'users'),
            where('role', '==', 'merchant'),
            where('status', '==', 'active'),
          ),
        ),
        // premium: users 컬렉션의 entitlement.plan === 'premium' — 별도 필드 없어서 스캔 필요.
        // 초기 규모에선 client 스캔 허용, 규모 커지면 Cloud Function 집계로 이전.
        countPremiumUsers(),
        count(query(collection(db, 'users'), where('createdAt', '>=', cutoff7))),
        count(query(collection(db, 'users'), where('createdAt', '>=', cutoff30))),
        count(collection(db, 'shops')),
        // favorites 는 users/*/favorites 하위 subcollection — collection group 으로 count
        countCollectionGroup('favorites'),
        count(collection(db, 'partsRequests')),
        countCollectionGroup('entries'), // reviews/{shopCode}/entries 하위
        count(collection(db, 'homeBanners')),
        count(collection(db, 'promoCodes')),
        count(query(collection(db, 'promoCodes'), where('usedBy', '!=', null))),
        count(query(collection(db, 'merchantClaims'), where('status', '==', 'pending'))),
        count(query(collection(db, 'inquiries'), where('status', 'in', ['open', 'in_progress']))),
        count(query(collection(db, 'adInquiries'), where('status', '==', 'pending'))),
      ]);

      const dailySignups = await loadDailySignupTrend(cutoff14);

      setStats({
        totalUsers,
        visitors,
        merchants,
        activeMerchants,
        premiumUsers,
        new7d,
        new30d,
        totalShops,
        totalFavorites,
        totalPartsRequests,
        totalReviews,
        totalBanners,
        totalPromoCodes,
        usedPromoCodes,
        pendingClaims,
        openInquiries,
        openAdInquiries,
        dailySignups,
      });
    } catch (err) {
      console.error('stats load failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const conversion = useMemo(() => {
    if (stats.totalUsers <= 0) return 0;
    return (stats.premiumUsers / stats.totalUsers) * 100;
  }, [stats.totalUsers, stats.premiumUsers]);

  const currentPeriodValue = range === '7d' ? stats.new7d : range === '30d' ? stats.new30d : stats.totalUsers;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="통계"
        showBack={false}
        rightSlot={
          <Pressable onPress={onRefresh} hitSlop={10} disabled={refreshing}>
            <Text style={styles.refreshText}>{refreshing ? '...' : '새로고침'}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.rangeRow}>
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <Pressable
              key={r}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeChipText, range === r && styles.rangeChipTextActive]}>
                {RANGE_LABELS[r]}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* 핵심 KPI */}
            <Text style={styles.sectionTitle}>핵심 KPI</Text>
            <View style={styles.kpiGrid}>
              <KpiCard
                Icon={Users}
                label="총 회원"
                value={stats.totalUsers}
                sub={`방문자 ${stats.visitors} · 사장님 ${stats.merchants}`}
              />
              <KpiCard
                Icon={UserPlus}
                label="신규 가입 (기간)"
                value={currentPeriodValue}
                sub={RANGE_LABELS[range]}
                accent={Colors.primary}
              />
              <KpiCard
                Icon={Crown}
                label="프리미엄 회원"
                value={stats.premiumUsers}
                sub={`전환율 ${conversion.toFixed(1)}%`}
                accent={Colors.warning}
              />
              <KpiCard
                Icon={Store}
                label="등록 매장"
                value={stats.totalShops}
                sub={`활성 사장님 ${stats.activeMerchants}`}
              />
              <KpiCard
                Icon={Activity}
                label="처리 대기 (합계)"
                value={stats.pendingClaims + stats.openInquiries + stats.openAdInquiries}
                sub={`매장인증 ${stats.pendingClaims} · 문의 ${stats.openInquiries} · 광고 ${stats.openAdInquiries}`}
                accent={Colors.danger}
              />
            </View>

            {/* 오늘의 요약 */}
            <Text style={styles.sectionTitle}>기간 요약</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                · 최근 7일 신규 가입 <Text style={styles.summaryStrong}>{stats.new7d}명</Text>,
                최근 30일 신규 가입 <Text style={styles.summaryStrong}>{stats.new30d}명</Text>
              </Text>
              <Text style={styles.summaryText}>
                · 전체 회원 중 프리미엄 <Text style={styles.summaryStrong}>{stats.premiumUsers}명</Text>
                (전환율 {conversion.toFixed(1)}%)
              </Text>
              <Text style={styles.summaryText}>
                · 사장님 <Text style={styles.summaryStrong}>{stats.activeMerchants}명</Text> 매장{' '}
                <Text style={styles.summaryStrong}>{stats.totalShops}개</Text> 인증됨
              </Text>
              <Text style={styles.summaryText}>
                · 처리 대기 총{' '}
                <Text style={styles.summaryStrong}>
                  {stats.pendingClaims + stats.openInquiries + stats.openAdInquiries}건
                </Text>{' '}
                (매장인증 {stats.pendingClaims} · 문의 {stats.openInquiries} · 광고 {stats.openAdInquiries})
              </Text>
              <Text style={styles.summaryText}>
                · 프로모션 코드{' '}
                <Text style={styles.summaryStrong}>
                  {stats.usedPromoCodes}/{stats.totalPromoCodes}
                </Text>{' '}
                사용
              </Text>
            </View>

            {/* 14일 신규 가입 트렌드 */}
            <Text style={styles.sectionTitle}>14일 신규 가입 추이</Text>
            <View style={styles.chartCard}>
              <BarChart data={stats.dailySignups} />
            </View>

            {/* 기능별 사용 지표 */}
            <Text style={styles.sectionTitle}>기능별 사용 지표</Text>
            <View style={styles.kpiGrid}>
              <FeatureCard
                Icon={Heart}
                label="관심 매장 등록"
                value={stats.totalFavorites}
                desc="사용자가 등록한 관심 매장 (누적)"
              />
              <FeatureCard
                Icon={Package}
                label="부자재 요청"
                value={stats.totalPartsRequests}
                desc="사용자가 등록한 부자재 찾기 요청"
              />
              <FeatureCard
                Icon={Star}
                label="매장 리뷰"
                value={stats.totalReviews}
                desc="1계정 1매장 리뷰 (누적)"
              />
              <FeatureCard
                Icon={ImageIcon}
                label="홈 배너"
                value={stats.totalBanners}
                desc="운영자 등록 홈 배너"
              />
              <FeatureCard
                Icon={Gift}
                label="프로모션 코드 사용"
                value={`${stats.usedPromoCodes} / ${stats.totalPromoCodes}`}
                desc="사용된 / 전체 발급"
              />
              <FeatureCard
                Icon={Sparkles}
                label="매장 인증 신청"
                value={stats.pendingClaims}
                desc="처리 대기 중인 매장 매칭 신청"
              />
              <FeatureCard
                Icon={MessageCircle}
                label="문의 대기"
                value={stats.openInquiries}
                desc="일반 문의 처리 대기"
              />
              <FeatureCard
                Icon={CreditCard}
                label="광고 문의 대기"
                value={stats.openAdInquiries}
                desc="광고 문의 처리 대기"
              />
            </View>

            <View style={{ height: 32 }} />
            <Text style={styles.noteText}>
              ※ 실시간 활성 사용자(DAU/WAU/MAU) 는 이벤트 트래킹 파이프라인이 준비되면 표시됩니다.
              현재는 Firestore doc 스캔 기반 근사치입니다.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

async function count(q: any): Promise<number> {
  try {
    const s = await getCountFromServer(q);
    return s.data().count;
  } catch {
    return 0;
  }
}

async function countCollectionGroup(name: string): Promise<number> {
  try {
    // dynamic import to keep bundle small; collectionGroup 은 firebase/firestore export.
    const { collectionGroup } = await import('firebase/firestore');
    const s = await getCountFromServer(collectionGroup(db, name));
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

async function loadDailySignupTrend(cutoffMs: number): Promise<Array<{ date: string; count: number }>> {
  try {
    const q = query(collection(db, 'users'), where('createdAt', '>=', Timestamp.fromMillis(cutoffMs)));
    const snap = await getDocs(q);
    const buckets: Record<string, number> = {};
    // 최근 14일 슬롯 미리 생성
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * DAY_MS);
      const key = keyFor(d);
      buckets[key] = 0;
    }
    for (const doc of snap.docs) {
      const data = doc.data() as { createdAt?: Timestamp };
      const t = data.createdAt?.toMillis?.();
      if (!t) continue;
      const key = keyFor(new Date(t));
      if (key in buckets) buckets[key] += 1;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  } catch {
    return [];
  }
}

function keyFor(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

function KpiCard({
  Icon,
  label,
  value,
  sub,
  accent,
}: {
  Icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  const color = accent ?? Colors.text;
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}18` }]}>
        <Icon size={22} color={color} strokeWidth={2.2} />
      </View>
      <Text style={[styles.kpiValue, accent ? { color } : undefined]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

function FeatureCard({
  Icon,
  label,
  value,
  desc,
}: {
  Icon: LucideIcon;
  label: string;
  value: number | string;
  desc: string;
}) {
  return (
    <View style={styles.featureCard}>
      <Icon size={16} color={Colors.textMuted} strokeWidth={2} />
      <Text style={styles.featureLabel}>{label}</Text>
      <Text style={styles.featureValue}>{value}</Text>
      <Text style={styles.featureDesc} numberOfLines={2}>{desc}</Text>
    </View>
  );
}

function BarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={styles.chartArea}>
      <View style={styles.bars}>
        {data.map((d) => {
          const h = Math.max(4, (d.count / max) * 140);
          return (
            <View key={d.date} style={styles.barCol}>
              <Text style={styles.barValue}>{d.count > 0 ? d.count : ''}</Text>
              <View style={[styles.bar, { height: h }]} />
              <Text style={styles.barLabel} numberOfLines={1}>{d.date}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        <TrendingUp size={12} color={Colors.textMuted} strokeWidth={2.2} />
        <Text style={styles.chartLegendText}>일별 신규 가입 수 (최대 {max}명)</Text>
      </View>
    </View>
  );
}

// Layers 아이콘 예비 — 미사용 경고 회피
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _reserved = [Layers];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, maxWidth: 1300, width: '100%', alignSelf: 'center' },
  refreshText: { fontSize: 12, color: Colors.primary, fontWeight: '800' },

  rangeRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rangeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rangeChipText: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  rangeChipTextActive: { color: '#fff' },

  loading: { padding: 40, alignItems: 'center' },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 12,
  },

  kpiGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  kpiCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    flexGrow: 1,
    flexBasis: 180,
    gap: 6,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiValue: { fontSize: 24, fontWeight: '900', color: Colors.text },
  kpiLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  kpiSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },

  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  summaryText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  summaryStrong: { fontWeight: '900' },

  chartCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartArea: {},
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 180,
    paddingBottom: 24,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 22,
  },
  bar: {
    width: '80%',
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  barValue: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '800',
    marginBottom: 2,
    minHeight: 12,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    position: 'absolute',
    bottom: -16,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  chartLegendText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  featureCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    minWidth: 160,
    flexGrow: 1,
    flexBasis: 160,
  },
  featureLabel: { fontSize: 12, color: Colors.text, fontWeight: '800' },
  featureValue: { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 2 },
  featureDesc: { fontSize: 10, color: Colors.textMuted, lineHeight: 14 },

  noteText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 15,
    marginTop: 8,
  },
});
