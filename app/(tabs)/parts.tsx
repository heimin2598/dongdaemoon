import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, ImageOff, MessageSquare, Plus } from 'lucide-react-native';
import { showInfoAlert } from '@/utils/alerts';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { usePartsRequestsStore } from '@/stores/partsRequestsStore';
import { PartsCategory, PartsRequest, Shop } from '@/types';
import { PARTS_CATEGORY_LABEL } from '@/constants/partsCategories';
import { subscribeMyShops } from '@/lib/shops';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PaywallSheet } from '@/components/common/PaywallSheet';
import { Button } from '@/components/common/Button';
import { useTranslation } from 'react-i18next';

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

function RequestCard({ item }: { item: PartsRequest }) {
  const cover = item.photos[0];
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: item.id } })}
    >
      <View style={styles.cardThumbWrap}>
        {cover ? (
          <Image source={{ uri: cover.url }} style={styles.cardThumb} />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbEmpty]}>
            <ImageOff size={20} color={Colors.textMuted} strokeWidth={2} />
          </View>
        )}
        {item.photos.length > 1 && (
          <View style={styles.cardThumbBadge}>
            <Text style={styles.cardThumbBadgeText}>+{item.photos.length - 1}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardHeaderRow}>
          {item.categories && item.categories.length > 0 && (
            <View style={styles.categoryBadgeRow}>
              {item.categories.map((c) => (
                <View key={c} style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {PARTS_CATEGORY_LABEL[c]}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {item.authorName || '익명'}
          </Text>
          {item.status === 'closed' && (
            <View style={styles.closedTag}>
              <Text style={styles.closedTagText}>종료</Text>
            </View>
          )}
          <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>
          {item.text || '(내용 없음)'}
        </Text>
        <View style={styles.cardFooterRow}>
          <MessageSquare size={14} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.cardReplyCount}>응답 {item.replyCount}개</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function PartsFeedScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isMerchantActive = user?.role === 'merchant' && user.status === 'active';
  const partsTitle = isMerchantActive ? t('parts.tabSupply') : t('parts.tabFind');
  const feed = usePartsRequestsStore((s) => s.feed);
  const watchFeed = usePartsRequestsStore((s) => s.watchFeed);
  const unwatchFeed = usePartsRequestsStore((s) => s.unwatchFeed);
  const { isPremium, loading: entitlementLoading } = useEntitlement();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [myShops, setMyShops] = useState<Shop[]>([]);
  // 사장님 디폴트: 내 분야만 — 본인이 다루는 카테고리 위주로 보기
  const [myFieldOnly, setMyFieldOnly] = useState<boolean>(true);

  useEffect(() => {
    if (!isPremium) return;
    watchFeed();
    return () => unwatchFeed();
  }, [isPremium]);

  // 사장님 본인 매장 구독 — 내 분야 union 계산용
  useEffect(() => {
    if (!isMerchantActive || !user?.id) {
      setMyShops([]);
      return;
    }
    const unsub = subscribeMyShops(user.id, setMyShops);
    return () => unsub();
  }, [isMerchantActive, user?.id]);

  const myCategorySet = useMemo<Set<PartsCategory>>(() => {
    const set = new Set<PartsCategory>();
    myShops.forEach((s) => (s.categories ?? []).forEach((c) => set.add(c)));
    return set;
  }, [myShops]);

  const showToggle = isMerchantActive && myCategorySet.size > 0;

  const blockedSet = useBlocksStore((s) => s.blockedSet);

  const filteredFeed = useMemo<PartsRequest[]>(() => {
    let list = feed.filter((r) => !blockedSet.has(r.authorUid));
    if (showToggle && myFieldOnly) {
      list = list.filter(
        (r) =>
          Array.isArray(r.categories) &&
          r.categories.some((c) => myCategorySet.has(c)),
      );
    }
    return list;
  }, [feed, showToggle, myFieldOnly, myCategorySet, blockedSet]);

  const onCreate = () => {
    if (!user) {
      // 아무 설명 없이 로그인 화면으로 보내면 왜 튕겼는지 알 수 없다.
      showInfoAlert(
        '로그인이 필요해요',
        '부자재 요청을 올리려면 로그인이 필요합니다.',
        () => router.push('/(auth)/login'),
        '로그인하기',
      );
      return;
    }
    if (!isPremium) {
      setPaywallOpen(true);
      return;
    }
    router.push('/parts/new');
  };

  // 비-프리미엄 사용자는 진입 시 안내 화면 (사장님은 본업이라 게이트 면제)
  if (user && !entitlementLoading && !isPremium && !isMerchantActive) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <PartsBackButton />
          <Text style={styles.headerTitle}>{partsTitle}</Text>
          <Text style={styles.headerSub}>프리미엄 회원 전용 기능입니다</Text>
        </View>
        <View style={styles.lockedWrap}>
          <View style={styles.lockedIconWrap}>
            <Crown size={36} color={Colors.warning} strokeWidth={2.2} />
          </View>
          <Text style={styles.lockedTitle}>프리미엄에서 이용 가능</Text>
          <Text style={styles.lockedDesc}>
            찾는 부자재의 사진과 설명을 올리면{'\n'}
            동대문 종합시장 사장님들이 매칭해 드려요.
          </Text>
          <Button
            label="프리미엄 안내 보기"
            onPress={() => setPaywallOpen(true)}
            style={{ marginTop: 24, paddingHorizontal: 32 }}
          />
        </View>
        <PaywallSheet
          visible={paywallOpen}
          feature="부자재 찾기"
          onClose={() => setPaywallOpen(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <PartsBackButton />
        <Text style={styles.headerTitle}>{partsTitle}</Text>
        <Text style={styles.headerSub}>
          {isMerchantActive
            ? '특정 부자재를 찾는 고객이 부자재를 찾는 글을 올리는 곳이에요'
            : '사진과 설명을 올리면 사장님들이 매칭해 드려요'}
        </Text>
      </View>

      {showToggle && (
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, myFieldOnly && styles.toggleBtnActive]}
            onPress={() => setMyFieldOnly(true)}
          >
            <Text style={[styles.toggleLabel, myFieldOnly && styles.toggleLabelActive]}>
{t('parts.myField')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, !myFieldOnly && styles.toggleBtnActive]}
            onPress={() => setMyFieldOnly(false)}
          >
            <Text style={[styles.toggleLabel, !myFieldOnly && styles.toggleLabelActive]}>
{t('parts.all')}
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filteredFeed}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <RequestCard item={item} />}
        contentContainerStyle={filteredFeed.length === 0 ? styles.emptyWrap : styles.listWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            {showToggle && myFieldOnly ? (
              <>
                <Text style={styles.emptyTitle}>내 분야 요청이 없어요</Text>
                <Text style={styles.emptyDesc}>
                  현재 매칭되는 카테고리의 요청이 없습니다.{'\n'}
                  "전체" 로 전환해서 다른 요청도 둘러보세요.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>아직 등록된 요청이 없어요</Text>
                <Text style={styles.emptyDesc}>
                  찾는 부자재의 사진과 설명을 올리면{'\n'}사장님들이 알려드립니다.
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* 요청 작성 FAB — 방문자만. 사장님은 요청을 받는 쪽이라 숨김. */}
      {!isMerchantActive && (
        <Pressable style={styles.fab} onPress={onCreate}>
          <Plus size={22} color="#fff" strokeWidth={2.6} />
          <Text style={styles.fabLabel}>요청 작성</Text>
        </Pressable>
      )}

      <PaywallSheet
        visible={paywallOpen}
        feature="부자재 찾기"
        onClose={() => setPaywallOpen(false)}
      />
    </SafeAreaView>
  );
}

/**
 * 방문자에게는 부자재 탭이 탭바에서 숨겨져(href: null) 있어 홈 카드로만 들어온다.
 * 그 경우 활성 탭 표시도 없고 빠져나갈 버튼도 없어 갇힌 느낌이 된다.
 */
function PartsBackButton() {
  if (!router.canGoBack()) return null;
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
      <ChevronLeft size={26} color={Colors.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: { marginLeft: -8, marginBottom: 2, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  toggleBtn: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  toggleLabelActive: { color: '#fff' },

  listWrap: { padding: 12, gap: 10, paddingBottom: 96 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  lockedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockedIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF4D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  lockedDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardThumbWrap: { position: 'relative' },
  cardThumb: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  cardThumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  cardThumbBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  cardThumbBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  categoryBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  categoryBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  cardAuthor: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  closedTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.divider,
  },
  closedTagText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  cardTime: { marginLeft: 'auto', fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  cardText: { fontSize: 14, color: Colors.text, lineHeight: 20, marginTop: 4 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cardReplyCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
