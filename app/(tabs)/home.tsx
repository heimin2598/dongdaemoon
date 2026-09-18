import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Check,
  ChevronRight,
  Coffee,
  Component,
  CreditCard,
  Heart,
  ImageIcon,
  Landmark,
  MessageCircle,
  Package,
  Plus,
  Scissors,
  Search as SearchIcon,
  Sparkles,
  Spool,
  Store,
  UtensilsCrossed,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Colors, BuildingColors } from '@/constants/colors';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useAuthStore } from '@/stores/authStore';
import { BUILDING_ORDER } from '@/constants/buildings';
import { getStoreByCode } from '@/data/stores';
import { APPROVAL_PENDING_FLAG } from '@/constants/approval';
import { showInfoAlert } from '@/utils/alerts';
import { FEATURE_MESSENGER_ENABLED } from '@/constants/features';
import { subscribeMyShops } from '@/lib/shops';
import {
  DEFAULT_MAIN_COLOR,
  DEFAULT_SUB_COLOR,
  HomeBanner,
  subscribeActiveBanners,
} from '@/lib/homeBanners';
import { HomeBannerCarousel } from '@/components/common/HomeBannerCarousel';
import { AdBanner } from '@/components/common/AdBanner';
import { subscribeBannerSettings } from '@/lib/bannerSettings';
import { HomeQrWidget } from '@/components/common/HomeQrWidget';
import { NotificationBar } from '@/components/common/NotificationBar';
import { useMerchantHomeStats, useMerchantNotificationCount } from '@/lib/merchantHomeStats';
import { useAppNotifications } from '@/lib/notifications';
import { getShopStatusDisplay, OPERATING_OPTIONS } from '@/lib/shopStatus';
import { setOperatingStatus } from '@/lib/shops';
import type { OperatingStatus } from '@/types';
import { encodeShopQr, encodeUserQr, decodeQr } from '@/lib/qrPayload';
import { addCustomer } from '@/lib/customers';
import { Shop } from '@/types';

type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  query: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'store_name', label: '상호 찾기', icon: Store, query: '' },
  { key: 'fabric', label: '원단', icon: Scissors, query: '원단' },
  { key: 'accessory', label: '부자재', icon: Component, query: '부자재' },
  { key: 'thread', label: '실', icon: Spool, query: '실' },
  { key: 'lace', label: '레이스', icon: Sparkles, query: '레이스' },
  { key: 'facility', label: '편의시설', icon: Landmark, query: '편의시설' },
  { key: 'food', label: '식당가', icon: UtensilsCrossed, query: '식당가' },
  { key: 'cafe', label: '카페', icon: Coffee, query: '카페' },
];

/**
 * Firestore `homeBanners` 가 비어있거나 권한·네트워크 오류 시 표시될 fallback.
 * 광고 운영을 시작하기 전(또는 빈 콘솔 상태)에도 홈이 휑하지 않도록 둠.
 */
const FALLBACK_BANNERS: HomeBanner[] = [
  {
    id: 'fallback_parts',
    subCopy: '부자재 찾기',
    mainCopy: '시장 가기 전에 원하는 부자재를 미리 찾아보세요',
    subColor: DEFAULT_SUB_COLOR,
    mainColor: DEFAULT_MAIN_COLOR,
    landingUrl: '/(tabs)/parts',
    order: 0,
    active: true,
    startsAt: null,
    endsAt: null,
    startTimeOfDay: null,
    endTimeOfDay: null,
  },
  {
    id: 'fallback_overview',
    subCopy: '한눈에 보기',
    mainCopy: '동·층별 카테고리 한 번에',
    subColor: DEFAULT_SUB_COLOR,
    mainColor: DEFAULT_MAIN_COLOR,
    landingUrl: '/overview',
    order: 1,
    active: true,
    startsAt: null,
    endsAt: null,
    startTimeOfDay: null,
    endTimeOfDay: null,
  },
  {
    id: 'fallback_fav',
    subCopy: '관심 매장',
    mainCopy: '관심 매장을 등록하고 메모 기능을 사용하세요',
    subColor: DEFAULT_SUB_COLOR,
    mainColor: DEFAULT_MAIN_COLOR,
    landingUrl: '/favorites',
    order: 2,
    active: true,
    startsAt: null,
    endsAt: null,
    startTimeOfDay: null,
    endTimeOfDay: null,
  },
];

function openBannerLink(url: string) {
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    Linking.openURL(url).catch(() => {});
  } else {
    router.push(url as any);
  }
}

const BANNER_INTERVAL_MS = 3000;

export default function HomeScreen() {
  const { t } = useTranslation();
  const merchantStats = useMerchantHomeStats();
  const notifCount = useMerchantNotificationCount();
  const [query, setQuery] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const recentQueries = useSearchStore((s) => s.recentQueries);
  const setBuilding = useMapStore((s) => s.setBuilding);
  const setFloor = useMapStore((s) => s.setFloor);
  const favoriteCodes = useFavoritesStore((s) => s.codes);
  const user = useAuthStore((s) => s.user);
  const [myShops, setMyShops] = useState<Shop[]>([]);
  // 구독 도착 전 [] 를 "매장 없음" 으로 단정하면 사장님에게 "매장을 등록해 주세요" 가
  // 뜬다. 이미 등록한 사장님은 매장이 사라진 줄 안다.
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const favoriteStores = favoriteCodes
    .map((c) => getStoreByCode(c))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';

  // 사장님은 본인 shops를 실시간 구독 — 등록 매장 수, 환영 배너에 사용
  useEffect(() => {
    if (!isMerchantActive || !user?.id) return;
    setShopsLoaded(false);
    const unsub = subscribeMyShops(user.id, (list) => {
      setMyShops(list);
      setShopsLoaded(true);
    });
    return () => unsub();
  }, [isMerchantActive, user?.id]);

  // 사장님이 승인 받은 후 처음 홈에 들어왔을 때 알림 (로그아웃 후 재로그인 시나리오)
  useEffect(() => {
    if (user?.role !== 'merchant' || user?.status !== 'active') return;
    AsyncStorage.getItem(APPROVAL_PENDING_FLAG).then((flag) => {
      if (flag !== '1') return;
      AsyncStorage.removeItem(APPROVAL_PENDING_FLAG).catch(() => {});
      showInfoAlert(
        '승인 완료',
        '관리자가 가입을 승인했습니다.\n동대문 종합시장 셰르파를 시작하세요!',
        undefined,
        '시작하기',
      );
    });
  }, [user?.role, user?.status]);

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push({ pathname: '/search', params: { q: trimmed } });
  };

  // 배너 carousel — Firestore 구독, 비어있으면 fallback 사용
  const [remoteBanners, setRemoteBanners] = useState<HomeBanner[]>([]);
  const [bannerShuffle, setBannerShuffle] = useState(false);

  useEffect(() => {
    const unsub = subscribeActiveBanners('home', setRemoteBanners);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeBannerSettings('home', (s) =>
      setBannerShuffle(s.displayMode === 'random'),
    );
    return () => unsub();
  }, []);

  const banners = remoteBanners.length > 0 ? remoteBanners : FALLBACK_BANNERS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView>
        {/* 사장님 전용 대문 — 흰 카드 + 매장 정보 + 영업중 칩 + 등록 매장/신규 알림 */}
        {isMerchantActive && (
          <View style={styles.mHero}>
            <View style={styles.mHeroTop}>
              <View style={styles.mHeroLogoCard}>
                <Image
                  source={require('../../assets/DDM-LOGO.png')}
                  style={styles.mHeroLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mHeroBrand}>동대문 종합시장 셰르파</Text>
                <Text style={styles.mHeroTitle} numberOfLines={1}>
                  {myShops[0]?.displayName ?? `${user?.displayName ?? '사장님'} 사장님`}
                </Text>
                <Text style={styles.mHeroSub}>
                  {!shopsLoaded
                    ? '매장 정보를 불러오는 중이에요'
                    : myShops.length > 0
                      ? '오늘도 좋은 거래 되세요'
                      : '먼저 매장을 등록해 주세요'}
                </Text>
              </View>
              {merchantStats && myShops[0] && (() => {
                const d = getShopStatusDisplay(myShops[0]);
                return (
                  <Pressable
                    style={[styles.mHeroStatusBtn, { backgroundColor: d.bg }]}
                    onPress={() => setStatusModalOpen(true)}
                  >
                    <Text style={[styles.mHeroStatusLabel, { color: d.color }]}>
                      ● {d.label}
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
            <View style={styles.mHeroBottom}>
              <Pressable
                style={styles.mHeroMetricBtn}
                onPress={() => router.push('/my-shops')}
              >
                <Store size={14} color={Colors.text} strokeWidth={2.2} />
                <Text style={styles.mHeroMetricText}>
                  등록 매장{' '}
                  <Text style={styles.mHeroMetricNum}>{shopsLoaded ? myShops.length : '–'}</Text>개
                </Text>
                <ChevronRight size={14} color={Colors.textMuted} />
              </Pressable>
              <Pressable
                style={styles.mHeroMetricBtn}
                onPress={() => {
                  // 메신저 오픈 전까지는 무동작. 활성 시 알림 있으면 메신저로 이동.
                  if (FEATURE_MESSENGER_ENABLED && notifCount > 0) {
                    router.push('/(tabs)/messenger' as any);
                  }
                }}
              >
                <Bell size={14} color={Colors.text} strokeWidth={2.2} />
                <Text style={styles.mHeroMetricText}>
                  신규 알림 <Text style={styles.mHeroMetricNum}>{notifCount}</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 방문자 전용: 인사 + 검색바 (사장님은 검색 거의 사용 안 함 → 숨김) */}
        {!isMerchantActive && (
          <View style={styles.hero}>
            <Text style={styles.greet}>{t('home.greet')}</Text>
            <View style={styles.searchBar}>
              <SearchIcon size={20} color={Colors.textMuted} strokeWidth={2} style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => submitSearch(query)}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={10}>
                  <X size={18} color={Colors.textMuted} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* QR 위젯 — 본인 QR 보기 + QR 스캔 */}
        {user && (
          <HomeQrWidget
            ownLabel={isMerchantActive ? '내 매장 QR' : '내 QR'}
            ownQrValue={
              isMerchantActive && myShops[0]
                ? encodeShopQr(
                    myShops[0].id,
                    user.shortId,
                    myShops[0].displayName,
                    myShops[0].storeCodes?.[0],
                  )
                : encodeUserQr(user.id, user.shortId, user.displayName)
            }
            ownCaption={
              isMerchantActive
                ? myShops[0]?.storeCodes?.[0]
                  ? `${myShops[0].displayName} · ${myShops[0].storeCodes[0]}`
                  : myShops[0]?.displayName
                : user.shortId
                  ? `ID · ${user.shortId}`
                  : undefined
            }
            onScan={async (raw) => {
              const payload = decodeQr(raw);
              if (!payload) {
                showInfoAlert('인식 실패', '셰르파 QR 형식이 아닙니다.');
                return;
              }
              if (payload.t === 's') {
                // 매장 QR → 매장 상세로
                const code = payload.c;
                if (code) {
                  router.push(`/store/${encodeURIComponent(code)}`);
                } else {
                  showInfoAlert('매장 정보 부족', '매장 코드가 포함되어 있지 않습니다.');
                }
                return;
              }
              // 사용자 QR
              if (isMerchantActive && myShops[0]) {
                try {
                  await addCustomer({
                    shopId: myShops[0].id,
                    customerUid: payload.i,
                    customerShortId: payload.s ?? null,
                    customerDisplayName: payload.n ?? '(이름 미상)',
                  });
                  showInfoAlert('고객 등록', `${payload.n ?? '고객'} 님을 등록했습니다.`, () =>
                    router.push('/(tabs)/customers' as any),
                  );
                } catch (e: any) {
                  showInfoAlert('등록 실패', e?.message ?? '네트워크 오류입니다.');
                }
              } else {
                showInfoAlert(
                  '사용자 QR',
                  payload.n ? `${payload.n} 님의 ID 입니다.` : '사용자 QR 입니다.',
                );
              }
            }}
          />
        )}

        {/* 알림바 — 광고 배너 위. 48h 이내 채팅/부자재 알림 합성 */}
        {user && <NotificationBar />}

        {/* 사장님: 광고 배너 — QR/알림 바로 아래 */}
        {isMerchantActive && (
          <View style={styles.bannerWrap}>
            <AdBanner />
          </View>
        )}

        {/* 영업 상태 토글은 hero 우측 칩에 통합됨 */}

        {/* 사장님: 빠른 현황 요약 스트립 (4개 숫자 카드) */}
        {isMerchantActive && merchantStats && (
          <View style={styles.mStatsStrip}>
            {FEATURE_MESSENGER_ENABLED && (
              <StatCell
                label="미답 메시지"
                value={merchantStats.unreadMessageCount}
                Icon={MessageCircle}
                onPress={() => router.push('/(tabs)/messenger' as any)}
              />
            )}
            <StatCell
              label="신규 요청"
              value={merchantStats.newPartsRequestCount}
              Icon={Sparkles}
              onPress={() => router.push('/(tabs)/parts' as any)}
            />
            <StatCell
              label="상품"
              value={merchantStats.productCount}
              Icon={Package}
              onPress={() =>
                myShops[0] &&
                router.push({ pathname: '/shop-products', params: { shopId: myShops[0].id } } as any)
              }
            />
            <StatCell
              label="결제수단"
              value={merchantStats.paymentMethodCount}
              Icon={CreditCard}
              onPress={() =>
                myShops[0] &&
                router.push({ pathname: '/my-shop-edit', params: { id: myShops[0].id } })
              }
              warn={merchantStats.paymentMethodCount === 0}
            />
          </View>
        )}

        {/* 사장님: 오늘 할 일 카드 */}
        {isMerchantActive && merchantStats && myShops[0] && (
          <OwnerTodoCard stats={merchantStats} shopId={myShops[0].id} />
        )}

        {/* 사장님: 고객에게 보이는 내 매장 */}
        {isMerchantActive && merchantStats && myShops[0] && (
          <OwnerVisibilityCard stats={merchantStats} shopId={myShops[0].id} />
        )}

        {/* 사장님: 매장 관리 (레퍼런스 디자인) */}
        {isMerchantActive && shopsLoaded && (
          <View style={styles.mManageCard}>
            <Text style={styles.mManageTitle}>매장 관리</Text>
            {myShops.length === 0 ? (
              <Pressable style={styles.mManageEmptyCta} onPress={() => router.push('/my-shops')}>
                <Plus size={16} color="#fff" strokeWidth={2.6} />
                <Text style={styles.mManageEmptyCtaText}>지금 매장 등록하기</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.mManageRow}>
                  <ManageCell
                    Icon={Wrench}
                    label="매장 정보"
                    onPress={() =>
                      router.push({ pathname: '/my-shop-edit', params: { id: myShops[0].id } })
                    }
                  />
                  <ManageCell
                    Icon={ImageIcon}
                    label="매장 사진"
                    warn={!!merchantStats && merchantStats.photoCount === 0}
                    onPress={() =>
                      router.push({ pathname: '/my-shop-edit', params: { id: myShops[0].id } })
                    }
                  />
                  <ManageCell
                    Icon={Package}
                    label="상품 등록"
                    warn={!!merchantStats && merchantStats.productCount === 0}
                    onPress={() =>
                      router.push({
                        pathname: '/shop-products',
                        params: { shopId: myShops[0].id },
                      } as any)
                    }
                  />
                  <ManageCell
                    Icon={CreditCard}
                    label="결제 수단"
                    warn={!!merchantStats && merchantStats.paymentMethodCount === 0}
                    onPress={() =>
                      router.push({ pathname: '/my-shop-edit', params: { id: myShops[0].id } })
                    }
                  />
                </View>
                <Pressable
                  style={styles.mManageSeeAll}
                  onPress={() => router.push('/my-shops')}
                >
                  <Text style={styles.mManageSeeAllText}>내 매장 전체 보기</Text>
                  <ChevronRight size={14} color={Colors.primary} />
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* 사장님: 셰르파 활용 가이드 */}
        {isMerchantActive && <OwnerGuideCard />}

        {/* 사장님: 새 소식 카드 */}
        {isMerchantActive && <OwnerNewsCard />}

        {/* 방문자 전용: 광고 배너 → 관심 매장 / 빠른 검색 / 지도 / 최근 검색 */}
        {!isMerchantActive && (
          <View style={styles.bannerWrap}>
            <AdBanner />
          </View>
        )}
        {!isMerchantActive && (
          <>
            <Pressable style={styles.favBar} onPress={() => router.push('/favorites')}>
              <Heart size={20} color="#E63946" fill="#E63946" strokeWidth={2} />
              <Text style={styles.favBarLabel}>관심 매장</Text>
              <Text style={styles.favBarCount}>{favoriteCodes.length}개</Text>
              <ChevronRight size={20} color={Colors.textMuted} />
            </Pressable>

            <Text style={styles.sectionTitle}>빠른 검색</Text>
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Pressable
                    key={a.key}
                    style={styles.quickItem}
                    onPress={() => {
                      if (a.query) {
                        submitSearch(a.query);
                      } else {
                        router.push('/(tabs)/search');
                      }
                    }}
                  >
                    <View style={styles.quickIcon}>
                      <Icon size={24} color={Colors.primary} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.quickLabel}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {!isMerchantActive && (
          <>
            {/* 부자재 찾기 진입 바 — 가로 긴 단일 버튼 */}
            <Pressable
              style={styles.partsBar}
              onPress={() => router.push('/parts' as any)}
            >
              <View style={styles.partsBarIcon}>
                <Component size={18} color={Colors.primary} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partsBarTitle}>부자재를 찾습니다</Text>
                <Text style={styles.partsBarDesc}>
                  사진과 설명을 올리면 사장님들이 매칭해 드려요
                </Text>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </Pressable>

            <Text style={styles.sectionTitle}>지도에서 보기</Text>
            <View style={styles.mapRow}>
              {BUILDING_ORDER.map((b) => {
                const color = BuildingColors[b];
                return (
                  <Pressable
                    key={b}
                    style={[styles.buildingCard, { backgroundColor: color.primary }]}
                    onPress={() => {
                      setBuilding(b);
                      router.push('/map-building');
                    }}
                  >
                    <Text style={[styles.buildingBig, { color: color.text }]}>{b}</Text>
                    <Text style={[styles.buildingLabel, { color: color.text }]}>동 보기</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.floorCta} onPress={() => router.push('/overview')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.floorCtaTitle}>한눈에 보기</Text>
                <Text style={styles.floorCtaDesc}>층별 카테고리 한 장으로 · 탭하면 해당 지도로 이동</Text>
              </View>
              <ChevronRight size={20} color={Colors.textMuted} />
            </Pressable>

            {recentQueries.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>최근 검색</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recentQueries}
                  keyExtractor={(i) => i}
                  contentContainerStyle={styles.chipRow}
                  renderItem={({ item }) => (
                    <Pressable style={styles.chip} onPress={() => submitSearch(item)}>
                      <Text style={styles.chipText}>{item}</Text>
                    </Pressable>
                  )}
                />
              </>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 영업 상태 변경 모달 — hero 우측 칩 탭 시 노출 */}
      <Modal
        visible={statusModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalOpen(false)}
      >
        <Pressable style={statusModalStyles.backdrop} onPress={() => setStatusModalOpen(false)}>
          <Pressable style={statusModalStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={statusModalStyles.title}>영업 상태 변경</Text>
            {OPERATING_OPTIONS.map((opt) => (
              <Pressable
                key={opt.status}
                disabled={statusBusy || !myShops[0]}
                onPress={async () => {
                  if (!myShops[0]) return;
                  const untilMs = opt.presetUntilMinutes
                    ? Date.now() + opt.presetUntilMinutes * 60 * 1000
                    : null;
                  setStatusBusy(true);
                  try {
                    await setOperatingStatus(myShops[0].id, opt.status as OperatingStatus, untilMs);
                    setStatusModalOpen(false);
                  } catch (e: any) {
                    showInfoAlert('변경 실패', e?.message ?? '네트워크 오류입니다.');
                  } finally {
                    setStatusBusy(false);
                  }
                }}
                style={({ pressed }) => [
                  statusModalStyles.opt,
                  pressed && { backgroundColor: '#F4F6FA' },
                ]}
              >
                <Text style={statusModalStyles.optEmoji}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={statusModalStyles.optLabel}>{opt.label}</Text>
                  <Text style={statusModalStyles.optHint}>{opt.hint}</Text>
                </View>
                {opt.presetUntilMinutes && (
                  <Text style={statusModalStyles.optMinutes}>+{opt.presetUntilMinutes}분</Text>
                )}
              </Pressable>
            ))}
            {statusBusy && (
              <View style={statusModalStyles.busy}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const statusModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: Colors.surface, borderRadius: 14, padding: 8, paddingBottom: 4 },
  title: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  optEmoji: { fontSize: 22 },
  optLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },
  optHint: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  optMinutes: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  busy: { padding: 12, alignItems: 'center' },
});

function StatCell({
  label,
  value,
  Icon,
  onPress,
  warn,
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  onPress: () => void;
  warn?: boolean;
}) {
  return (
    <Pressable style={styles.mStatCell} onPress={onPress}>
      <Icon size={16} color={value > 0 ? Colors.primary : Colors.textMuted} strokeWidth={2.2} />
      <Text style={[styles.mStatValue, value > 0 && { color: Colors.primary }]}>
        {value > 99 ? '99+' : value}
      </Text>
      <Text style={[styles.mStatLabel, warn && { color: Colors.danger, fontWeight: '800' }]}>
        {warn ? `${label} 확인` : label}
      </Text>
    </Pressable>
  );
}

function OwnerTodoCard({
  stats,
  shopId,
}: {
  stats: import('@/lib/merchantHomeStats').MerchantHomeStats;
  shopId: string;
}) {
  const todos: Array<{ key: string; label: string; count?: number; onPress: () => void }> = [];
  if (FEATURE_MESSENGER_ENABLED && stats.unreadMessageCount > 0)
    todos.push({
      key: 'msg',
      label: `미답 메시지 ${stats.unreadMessageCount}건 확인`,
      onPress: () => router.push('/(tabs)/messenger' as any),
    });
  if (stats.newPartsRequestCount > 0)
    todos.push({
      key: 'parts',
      label: `신규 부자재 요청 ${stats.newPartsRequestCount}건`,
      onPress: () => router.push('/(tabs)/parts' as any),
    });
  if (stats.paymentMethodCount === 0)
    todos.push({
      key: 'pay',
      label: '결제 수단 등록 필요',
      onPress: () => router.push({ pathname: '/my-shop-edit', params: { id: shopId } }),
    });
  if (stats.photoCount === 0)
    todos.push({
      key: 'photo',
      label: '매장 사진 등록 필요',
      onPress: () => router.push({ pathname: '/my-shop-edit', params: { id: shopId } }),
    });
  if (stats.productCount === 0)
    todos.push({
      key: 'product',
      label: '대표 상품 등록 필요',
      onPress: () => router.push({ pathname: '/shop-products', params: { shopId } } as any),
    });
  if (!stats.hasDescription)
    todos.push({
      key: 'desc',
      label: '매장 소개글 작성 필요',
      onPress: () => router.push({ pathname: '/my-shop-edit', params: { id: shopId } }),
    });

  const display = todos.slice(0, 4);
  return (
    <View style={styles.mTodoCard}>
      <View style={styles.mTodoHead}>
        <Text style={styles.mTodoTitle}>오늘 할 일</Text>
        <Text style={styles.mTodoSub}>
          {todos.length === 0 ? '오늘은 처리할 일이 없어요' : '오늘 처리하면 좋은 일이에요'}
        </Text>
      </View>
      {display.length === 0 ? (
        <View style={styles.mTodoEmpty}>
          <Check size={18} color="#1B7A3E" strokeWidth={2.4} />
          <Text style={styles.mTodoEmptyText}>모두 처리 완료</Text>
        </View>
      ) : (
        <>
          {display.map((t) => (
            <Pressable key={t.key} style={styles.mTodoRow} onPress={t.onPress}>
              <View style={styles.mTodoDot} />
              <Text style={styles.mTodoText} numberOfLines={1}>
                {t.label}
              </Text>
              <ChevronRight size={14} color={Colors.textMuted} />
            </Pressable>
          ))}
          {todos[0] && (
            <Pressable style={styles.mTodoCta} onPress={todos[0].onPress}>
              <Text style={styles.mTodoCtaText}>바로 처리하기</Text>
              <ChevronRight size={14} color="#fff" />
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function OwnerVisibilityCard({
  stats,
  shopId,
}: {
  stats: import('@/lib/merchantHomeStats').MerchantHomeStats;
  shopId: string;
}) {
  const items: Array<{ key: string; label: string; done: boolean }> = [
    {
      key: 'photo',
      label: stats.photoCount > 0 ? `사진 ${stats.photoCount}장` : '사진을 추가해 주세요',
      done: stats.photoCount > 0,
    },
    {
      key: 'product',
      label: stats.productCount > 0 ? `상품 ${stats.productCount}개` : '상품을 등록해 주세요',
      done: stats.productCount > 0,
    },
    {
      key: 'payment',
      label:
        stats.paymentMethodCount > 0
          ? `결제수단 ${stats.paymentMethodCount}개`
          : '결제수단을 선택해 주세요',
      done: stats.paymentMethodCount > 0,
    },
    {
      key: 'desc',
      label: stats.hasDescription ? '소개글 등록 완료' : '소개글을 입력해 주세요',
      done: stats.hasDescription,
    },
  ];

  const previewCode = stats.shop?.storeCodes?.[0];
  return (
    <View style={styles.mVisibilityCard}>
      <View style={styles.mVisHead}>
        <Text style={styles.mVisTitle}>고객에게 보이는 내 매장</Text>
      </View>
      {items.map((it) => (
        <View key={it.key} style={styles.mVisRow}>
          <View
            style={[
              styles.mVisCheck,
              { backgroundColor: it.done ? '#E0F2E9' : '#FBE4E4' },
            ]}
          >
            {it.done ? (
              <Check size={11} color="#1B7A3E" strokeWidth={3} />
            ) : (
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.danger }}>!</Text>
            )}
          </View>
          <Text
            style={[
              styles.mVisLabel,
              !it.done && { color: Colors.danger, fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {it.label}
          </Text>
        </View>
      ))}
      {previewCode && (
        <Pressable
          style={styles.mVisCta}
          onPress={() => router.push(`/store/${encodeURIComponent(previewCode)}` as any)}
        >
          <Text style={styles.mVisCtaText}>고객 화면 미리보기</Text>
          <ChevronRight size={14} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

function ManageCell({
  Icon,
  label,
  onPress,
  warn,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  warn?: boolean;
}) {
  return (
    <Pressable style={styles.mManageCell} onPress={onPress}>
      <View style={styles.mManageIconBox}>
        <Icon size={18} color={Colors.primary} strokeWidth={2.2} />
        {warn && <View style={styles.mManageWarnDot} />}
      </View>
      <Text style={styles.mManageCellLabel}>{label}</Text>
    </Pressable>
  );
}

function OwnerGuideCard() {
  const tips: Array<{ key: string; icon: string; title: string; desc: string; onPress: () => void }> = [
    {
      key: 'qr',
      icon: '📱',
      title: '내 매장 QR 인쇄해서 매장에 부착',
      desc: '방문 손님이 스캔하면 바로 관심 매장 등록 가능',
      onPress: () => router.push('/(tabs)/home' as any),
    },
    {
      key: 'parts',
      icon: '🪡',
      title: '부자재 요청에 답글 달기',
      desc: '내 분야 요청에 빠르게 답하면 신규 손님이 늘어요',
      onPress: () => router.push('/(tabs)/parts' as any),
    },
    {
      key: 'customers',
      icon: '👥',
      title: '고객 QR 스캔으로 단골 관리',
      desc: '고객 메모/연락처를 기록해 매번 응대 품질을 높여요',
      onPress: () => router.push('/(tabs)/customers' as any),
    },
  ];
  return (
    <View style={styles.mGuideCard}>
      <View style={styles.mGuideHead}>
        <Text style={styles.mGuideTitle}>셰르파 활용 가이드</Text>
        <Text style={styles.mGuideSub}>이렇게 쓰면 더 효과적이에요</Text>
      </View>
      {tips.map((tip) => (
        <Pressable key={tip.key} style={styles.mGuideItem} onPress={tip.onPress}>
          <Text style={styles.mGuideEmoji}>{tip.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mGuideItemTitle} numberOfLines={1}>{tip.title}</Text>
            <Text style={styles.mGuideItemDesc} numberOfLines={2}>{tip.desc}</Text>
          </View>
          <ChevronRight size={14} color={Colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

function OwnerNewsCard() {
  const notifs = useAppNotifications();
  const display = notifs.slice(0, 2);
  return (
    <View style={styles.mNewsCard}>
      <View style={styles.mNewsHead}>
        <Text style={styles.mNewsTitle}>새 소식</Text>
        {FEATURE_MESSENGER_ENABLED && notifs.length > 0 && (
          <Pressable
            onPress={() => router.push('/(tabs)/messenger' as any)}
            hitSlop={6}
          >
            <Text style={styles.mNewsMore}>모두 보기 ›</Text>
          </Pressable>
        )}
      </View>
      {display.length === 0 ? (
        <View style={styles.mNewsEmpty}>
          <Text style={styles.mNewsEmptyText}>새 소식이 없어요</Text>
          <Text style={styles.mNewsEmptySub}>
            새 메시지나 요청이 오면 여기에서 알려드릴게요.
          </Text>
        </View>
      ) : (
        display.map((n) => (
          <Pressable
            key={n.id}
            style={styles.mNewsItem}
            onPress={() => n.link && router.push(n.link as any)}
          >
            <Text style={styles.mNewsItemEmoji}>{n.emoji}</Text>
            <Text style={styles.mNewsItemText} numberOfLines={2}>
              {n.text}
            </Text>
            <ChevronRight size={14} color={Colors.textMuted} />
          </Pressable>
        ))
      )}
    </View>
  );
}

function OwnerQuickCard({
  Icon,
  label,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ownerQuickCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.ownerQuickIcon}>
        <Icon size={22} color={Colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={styles.ownerQuickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  hero: {
    padding: 20,
    paddingTop: 12,
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  greet: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { marginRight: 8, fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  clearIcon: { fontSize: 22, color: Colors.textMuted, paddingHorizontal: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  partsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  partsBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  partsBarTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },
  partsBarDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  favBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  merchantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  merchantIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantIcon: { fontSize: 22 },
  merchantHello: { fontSize: 15, fontWeight: '800', color: Colors.text },
  merchantSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  merchantArrow: { fontSize: 22, color: Colors.primary, fontWeight: '800' },

  ownerHero: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 130,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ownerHeroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
  },
  ownerHeroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  ownerHeroLogoCard: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ownerHeroLogo: { width: '100%', height: '100%' },
  ownerHeroBrand: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  ownerHeroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  ownerHeroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '600',
  },

  ownerCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ownerCardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerCardTitle: { fontSize: 16, fontWeight: '900', color: Colors.text, letterSpacing: -0.3 },
  ownerCardSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  ownerCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  ownerCardCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ownerCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerQuickCard: {
    width: '23.5%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  ownerQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerQuickLabel: { fontSize: 11, fontWeight: '800', color: Colors.text },
  ownerCardSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 2,
    marginHorizontal: -16,
    marginBottom: -16,
    paddingBottom: 14,
  },
  ownerCardSeeAllText: { fontSize: 13, color: Colors.primary, fontWeight: '800' },

  // 사장님 hero 신디자인
  mHero: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  mHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mHeroLogoCard: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  mHeroLogo: { width: '100%', height: '100%' },
  mHeroBrand: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  mHeroTitle: { fontSize: 17, fontWeight: '900', color: Colors.text },
  mHeroSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  mHeroStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mHeroStatusEmoji: { fontSize: 8 },
  mHeroStatusLabel: { fontSize: 11, fontWeight: '800' },
  mHeroBottom: { flexDirection: 'row', gap: 6 },
  mHeroMetricBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  mHeroMetricText: { flex: 1, fontSize: 11, color: Colors.text, fontWeight: '700' },
  mHeroMetricNum: { color: Colors.primary, fontWeight: '900' },

  // 숫자 스트립
  mStatsStrip: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 10,
  },
  mStatCell: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  mStatValue: { fontSize: 18, fontWeight: '900', color: Colors.textMuted },
  mStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', textAlign: 'center' },

  // 오늘 할 일
  mTodoCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  mTodoHead: { marginBottom: 4 },
  mTodoTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },
  mTodoSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  mTodoEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#E0F2E9',
    borderRadius: 8,
  },
  mTodoEmptyText: { fontSize: 12, fontWeight: '800', color: '#1B7A3E' },
  mTodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  mTodoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  mTodoText: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '600' },
  mTodoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  mTodoCtaText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // 고객에게 보이는 내 매장
  mVisibilityCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  mVisHead: { marginBottom: 4 },
  mVisTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },
  mVisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  mVisCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mVisLabel: { flex: 1, fontSize: 12, color: Colors.text, fontWeight: '600' },
  mVisCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 6,
  },
  mVisCtaText: { fontSize: 12, fontWeight: '800', color: Colors.primary },

  // 매장 관리 (레퍼런스 디자인)
  mManageCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mManageTitle: { fontSize: 14, fontWeight: '900', color: Colors.text, marginBottom: 10 },
  mManageRow: { flexDirection: 'row', gap: 6 },
  mManageCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 4,
  },
  mManageIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mManageWarnDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  mManageCellLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  mManageSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  mManageSeeAllText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  mManageEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  mManageEmptyCtaText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // 셰르파 활용 가이드 카드
  mGuideCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mGuideHead: { marginBottom: 8 },
  mGuideTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },
  mGuideSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  mGuideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(11,46,90,0.12)',
  },
  mGuideEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  mGuideItemTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  mGuideItemDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2, lineHeight: 15 },

  // 새 소식 카드
  mNewsCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mNewsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mNewsTitle: { fontSize: 14, fontWeight: '900', color: Colors.text },
  mNewsMore: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  mNewsEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  mNewsEmptyText: { fontSize: 13, fontWeight: '800', color: Colors.text },
  mNewsEmptySub: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  mNewsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  mNewsItemEmoji: { fontSize: 18 },
  mNewsItemText: { flex: 1, fontSize: 12, color: Colors.text, fontWeight: '600', lineHeight: 18 },
  favBarIcon: { fontSize: 18 },
  favBarLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  favBarCount: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  favBarArrow: { fontSize: 20, color: Colors.textMuted, marginLeft: 4 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickLabel: { marginTop: 6, fontSize: 12, color: Colors.text, fontWeight: '600' },

  bannerWrap: { marginTop: 20 },

  mapRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  buildingCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buildingBig: { fontSize: 32, fontWeight: '900' },
  buildingLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  floorCta: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  floorCtaTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  floorCtaDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  floorCtaArrow: { fontSize: 28, color: Colors.textMuted },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  footerBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerBtnText: { fontWeight: '600', color: Colors.text },
});
