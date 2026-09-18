import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { maybeShowInterstitial } from '@/lib/ads';
import * as ImagePicker from 'expo-image-picker';
import {
  Check,
  ChevronRight,
  Clock,
  Crown,
  Heart,
  MapPin,
  Phone,
  Plus,
  X,
} from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { PhoneIcon } from '@/components/common/PhoneIcon';
import { PaywallSheet } from '@/components/common/PaywallSheet';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { formatStoreLocation, getStoreByCode, parseKeywordTags } from '@/data/stores';
import type { Store } from '@/data/stores/types';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useMemosStore } from '@/stores/memosStore';
import { usePhotoMemosStore } from '@/stores/photoMemosStore';
import { useReviewsStore } from '@/stores/reviewsStore';
import { useAuthStore } from '@/stores/authStore';
import { StarRow } from '@/components/common/StarRow';
import { useEntitlement } from '@/hooks/useEntitlement';
import { MAIN_CATEGORY_COLOR, MAIN_CATEGORY_EMOJI } from '@/data/stores/types';
import { BuildingCode, FloorCode, Shop } from '@/types';
import { subscribeShopByStoreCode } from '@/lib/shops';
import { ensureChat } from '@/lib/chats';
import {
  FEATURE_MESSENGER_ENABLED,
  MESSENGER_COMING_SOON_BODY,
  MESSENGER_COMING_SOON_TITLE,
} from '@/constants/features';
import { PARTS_CATEGORY_LABEL } from '@/constants/partsCategories';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';
import { proxyImage } from '@/utils/imageProxy';
import { MessageCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ShopStatusPill } from '@/components/common/ShopStatusPill';
import { PaymentBadges } from '@/components/common/PaymentBadges';
import { subscribeProducts } from '@/lib/shopProducts';
import type { ShopProduct } from '@/types';
import {
  deletePhotoMemo,
  MAX_PHOTOS_PER_SHOP,
  updatePhotoMemoCaption,
  uploadPhotoMemo,
} from '@/lib/photoMemos';

type TabKey = 'memo' | 'photos';

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'memo', label: '메모' },
  { key: 'photos', label: '포토 메모' },
];

export default function StoreDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const codeParam = code ? decodeURIComponent(code) : '';
  const dirStore = codeParam ? getStoreByCode(codeParam) : undefined;
  // shop 매칭에 쓸 코드 — 디렉터리 매칭이 있으면 그 코드, 없으면 URL 코드 (신규 등록 매장 fallback)
  const shopCode = dirStore?.code ?? codeParam;

  const [tab, setTab] = useState<TabKey>('memo');
  const [paywall, setPaywall] = useState<{ visible: boolean; feature?: string }>({ visible: false });
  const { isPremium } = useEntitlement();
  const currentUser = useAuthStore((s) => s.user);

  // 매장 상세에서 뒤로가기 → free 사용자에게 2회마다 1회 전면광고 (간격·상한은 ads.ts).
  // ScreenHeader 의 화살표, Android 하드웨어 ◁ 둘 다 같은 경로 통해 처리.
  const onBack = useCallback(() => {
    if (!isPremium) {
      maybeShowInterstitial('storeDetailBack', 2).catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [isPremium]);

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopChecked, setShopChecked] = useState(false);
  useEffect(() => {
    if (!shopCode) return;
    const unsub = subscribeShopByStoreCode(shopCode, (s) => {
      setShop(s);
      setShopChecked(true);
    });
    return () => unsub();
  }, [shopCode]);

  // 디렉터리에 없는 신규 매장은 shop 정보 기반으로 가상 Store 객체 생성
  const fallbackStore: Store | undefined = !dirStore && shop
    ? {
        id: -1,
        code: shopCode,
        name: shop.displayName || '매장',
        category: '기타',
        subCategory: null,
        building: null,
        floor: null,
        unit: null,
        location: null,
        phone: shop.phone || null,
        keywords: '',
        description: shop.description || '',
        images: [],
        sourceUrl: null,
      }
    : undefined;
  const store: Store | undefined = dirStore ?? fallbackStore;

  // 상품 카탈로그 구독 — shopId 확인 후
  const [products, setProducts] = useState<ShopProduct[]>([]);
  useEffect(() => {
    if (!shop?.id) {
      setProducts([]);
      return;
    }
    const unsub = subscribeProducts(shop.id, setProducts);
    return () => unsub();
  }, [shop?.id]);

  // 리뷰 평균/개수를 액션 버튼에 노출하기 위한 구독
  const watchReviews = useReviewsStore((s) => s.watch);
  const unwatchReviews = useReviewsStore((s) => s.unwatch);
  useEffect(() => {
    if (!shopCode) return;
    watchReviews(shopCode);
    return () => unwatchReviews(shopCode);
  }, [shopCode]);

  // 디렉터리에 없고 shop 구독 결과도 못 받은 상태 → 로딩
  if (!dirStore && !shopChecked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="점포" onBack={onBack} />
        <View style={styles.empty}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="점포" onBack={onBack} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>점포 정보를 찾을 수 없습니다.</Text>
          <Button label="홈으로" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const building = store.building as BuildingCode;
  const floor = store.floor as FloorCode;
  const bColor = building ? BuildingColors[building] : BuildingColors.B;
  const catColor = MAIN_CATEGORY_COLOR[store.category];
  const catEmoji = MAIN_CATEGORY_EMOJI[store.category];

  const displayName = shop?.displayName || store.name;
  const phoneRaw = (shop?.phone && shop.phone.trim()) || store.phone;
  const phoneFormatted = phoneRaw
    ? phoneRaw.replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3')
    : null;
  const businessHours = shop?.businessHours?.trim() || null;
  const description = shop?.description?.trim() || store.description;

  const onCall = () => {
    if (!phoneRaw) return;
    Linking.openURL(`tel:${phoneRaw.replace(/\D/g, '')}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={displayName || '점포 상세'} onBack={onBack} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 이미지 카루셀 — 사진 좌상단에 영업 상태 + 영업시간 오버레이 칩 */}
        {(() => {
          const allImages: string[] = [
            ...(shop?.photos ?? []).map((p) => p.url),
            ...store.images,
          ];
          if (allImages.length === 0) return null;
          return (
            <View style={styles.imageWrap}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.imageRow}
              >
                {allImages.map((url, i) => (
                  <Image
                    key={`${i}-${url}`}
                    source={{ uri: proxyImage(url, { w: 800, q: 80 }) }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>

              {/* 사진 오버레이 칩 제거 — 영업상태/시간은 매장정보 카드 안으로 이동 */}
            </View>
          );
        })()}

        {/* 매장 정보 카드 — 알파벳 아이콘 + 매장명/위치 + 우측 전화/문의 버튼 */}
        <View style={styles.infoCard}>
          {building && (
            <View style={[styles.bigBuildingIcon, { backgroundColor: bColor.primary }]}>
              <Text style={[styles.bigBuildingText, { color: bColor.text }]}>{building}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.storeName} numberOfLines={2}>
              {displayName}
            </Text>
            {/* 매장명 바로 밑 — 영업 상태 + 인증 가로 배열 */}
            {shop?.verified === true && (
              <View style={styles.statusRow}>
                <ShopStatusPill shop={shop} size="large" />
                <View style={styles.verifiedBadge}>
                  <Check size={13} color="#1B7A3E" strokeWidth={3} />
                  <Text style={styles.verifiedText}>인증</Text>
                </View>
              </View>
            )}
            <Text style={styles.storeMeta}>
              {building ? `${building}동` : ''}
              {floor ? ` · ${FLOOR_LABEL[floor]}` : ''}
              {store.unit ? ` · ${store.unit}호` : ''}
              {shop && shop.storeCodes.length > 1 ? ` (외 ${shop.storeCodes.length - 1})` : ''}
            </Text>
            {/* 카테고리 chip — 신규 매장은 사장님 등록 카테고리 우선, 디렉터리 매장은 디렉터리 카테고리 */}
            {(() => {
              const dirCat = dirStore ? store.category : null;
              const shopCats = shop?.categories ?? [];
              const showDir = !!dirCat;
              const showShop = !showDir && shopCats.length > 0;
              if (!showDir && !showShop) return null;
              return (
                <View style={styles.chipRow}>
                  {showDir && !!store.category && (
                    <View style={[styles.catChip, { backgroundColor: catColor + '22', borderColor: catColor }]}>
                      {!!catEmoji && (
                        <Text style={[styles.catChipText, { color: catColor }]}>{catEmoji}</Text>
                      )}
                      <Text style={[styles.catChipText, { color: catColor }]} numberOfLines={1}>
                        {store.category}
                      </Text>
                    </View>
                  )}
                  {showDir && !!store.subCategory && (
                    <View style={styles.subChip}>
                      <Text style={styles.subChipText} numberOfLines={1}>{store.subCategory}</Text>
                    </View>
                  )}
                  {showShop && shopCats.slice(0, 3).map((c) => (
                    <View key={c} style={styles.subChip}>
                      <Text style={styles.subChipText} numberOfLines={1}>{PARTS_CATEGORY_LABEL[c] ?? c}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
          <View style={styles.infoCardActions}>
            <View style={styles.infoCardBtnRow}>
              {phoneRaw && (
                <Pressable style={styles.roundIconBtn} onPress={onCall} accessibilityLabel="전화">
                  <Phone size={18} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={styles.roundIconLabel}>전화</Text>
                </Pressable>
              )}
              {FEATURE_MESSENGER_ENABLED && !(shop?.ownerUid && currentUser?.id === shop.ownerUid) && (
                <Pressable
                  style={styles.roundIconBtn}
                  onPress={async () => {
                    // 본인이 사장이 아닌 visitor 라면 premium 락
                    if (!isPremium) {
                      setPaywall({ visible: true, feature: '메신저 (사장님 채팅)' });
                      return;
                    }
                    const isLinked = shop?.verified === true && shop.ownerUid;
                    if (!isLinked) {
                      showInfoAlert(
                        '미연동 매장',
                        '동대문 셰르파에 미연동된 매장이에요.\n사장님께 무료 회원가입 및 연동을 권해주세요!',
                      );
                      return;
                    }
                    if (!currentUser?.id) {
                      showInfoAlert('로그인 필요', '챗 하기는 로그인 후 이용 가능합니다.');
                      return;
                    }
                    try {
                      const chat = await ensureChat({
                        visitorUid: currentUser.id,
                        visitorDisplayName: currentUser.displayName ?? currentUser.email,
                        merchantUid: shop.ownerUid,
                        shopId: shop.id,
                        shopDisplayName: shop.displayName || '매장',
                      });
                      router.push(`/chat/${chat.id}` as any);
                    } catch (e: any) {
                      showInfoAlert('채팅 열기 실패', e?.message ?? '네트워크 오류');
                    }
                  }}
                  accessibilityLabel="챗 하기"
                >
                  <MessageCircle size={18} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={styles.roundIconLabel}>챗 하기</Text>
                </Pressable>
              )}
            </View>
            {/* 전화/챗하기 버튼 아래 — 오늘 영업시간 */}
            {(() => {
              if (!shop?.verified) return null;
              const days: ['sun','mon','tue','wed','thu','fri','sat'] = ['sun','mon','tue','wed','thu','fri','sat'];
              const today = days[new Date().getDay()];
              const entry = shop.businessHoursSchedule?.find((e) => e.day === today);
              let label: string | null = null;
              if (entry) {
                label = entry.enabled ? `오늘 ${entry.start ?? ''}~${entry.end ?? ''}` : '오늘 휴무';
              } else if (businessHours) {
                label = businessHours;
              }
              if (!label) return null;
              return (
                <View style={styles.hoursBelowBtns}>
                  <Clock size={11} color={Colors.textMuted} strokeWidth={2.2} />
                  <Text style={styles.hoursBelowBtnsText} numberOfLines={1}>{label}</Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* 매장설명 카드 */}
        {description && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>매장설명</Text>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}

        {/* 3 버튼: 단골 / 지도 / 리뷰 */}
        <ActionRow
          shopCode={shopCode}
          isPremium={isPremium}
          requestPaywall={(feature) => setPaywall({ visible: true, feature })}
        />

        {/* 결제 수단 배지 — 인증 매장이고 사장님이 등록한 경우만 노출 */}
        {shop && shop.paymentMethods && shop.paymentMethods.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
            <PaymentBadges methods={shop.paymentMethods} emptyText={null} />
          </View>
        )}

        {/* 상품 카탈로그 — 사장님이 등록한 제품 */}
        {shop && products.length > 0 && (
          <View style={catalogStyles.wrap}>
            <View style={catalogStyles.head}>
              <Text style={catalogStyles.title}>상품 ({products.length})</Text>
              {currentUser?.id === shop.ownerUid && (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/shop-products', params: { shopId: shop.id } } as any)
                  }
                >
                  <Text style={catalogStyles.manageLink}>관리</Text>
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={catalogStyles.row}>
              {products.map((p) => (
                <View key={p.id} style={catalogStyles.card}>
                  {p.photos[0]?.url ? (
                    <Image source={{ uri: p.photos[0].url }} style={catalogStyles.cardImg} resizeMode="cover" />
                  ) : (
                    <View style={[catalogStyles.cardImg, catalogStyles.cardImgEmpty]}>
                      <Text style={{ fontSize: 28 }}>📦</Text>
                    </View>
                  )}
                  <Text style={catalogStyles.cardName} numberOfLines={2}>{p.name}</Text>
                  {p.priceText && <Text style={catalogStyles.cardPrice}>{p.priceText}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        {/* 사장님이 본인 매장 들어왔는데 상품이 없을 때 — 빈 카탈로그 + 등록 진입 */}
        {shop && products.length === 0 && currentUser?.id === shop.ownerUid && (
          <View style={catalogStyles.emptyOwner}>
            <Text style={catalogStyles.emptyOwnerText}>아직 등록된 상품이 없어요</Text>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/shop-products', params: { shopId: shop.id } } as any)
              }
              style={catalogStyles.emptyOwnerBtn}
            >
              <Text style={catalogStyles.emptyOwnerBtnText}>+ 상품 등록하기</Text>
            </Pressable>
          </View>
        )}

        {/* 사장님 채팅 CTA — 매장 정보 카드의 [문의] 버튼으로 통합됨. 기존 ChatCta 는 미사용 */}

        {/* 탭: 메모 / 포토 메모 */}
        <View style={styles.tabStrip}>
          {TAB_DEFS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'memo' && (
          <MemoTab
            shopCode={shopCode}
            isPremium={isPremium}
            requestPaywall={() => setPaywall({ visible: true, feature: '메모' })}
          />
        )}
        {tab === 'photos' && (
          <PhotosTab
            shopCode={shopCode}
            isPremium={isPremium}
            requestPaywall={() => setPaywall({ visible: true, feature: '포토 메모' })}
          />
        )}

        {/* 정보 영역 (전화, 영업시간, 위치) */}
        {/* 전화 / 위치 카드 row */}
        <View style={styles.contactCardRow}>
          {phoneFormatted && (
            <Pressable style={styles.contactCard} onPress={onCall}>
              <View style={[styles.contactIconBadge, { backgroundColor: '#E7F2FB' }]}>
                <Phone size={18} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactCardLabel}>전화</Text>
                <Text style={styles.contactCardValue} numberOfLines={1}>{phoneFormatted}</Text>
              </View>
            </Pressable>
          )}
          {(store.location || (building && floor && store.unit)) && (
            <View style={styles.contactCard}>
              <View style={[styles.contactIconBadge, { backgroundColor: '#E5F5EC' }]}>
                <MapPin size={18} color="#1B7A3E" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactCardLabel}>위치</Text>
                <Text style={styles.contactCardValue} numberOfLines={2}>
                  {formatStoreLocation({ ...store, building, floor })}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 챗 하기 — 메신저 활성 시에만 노출. 미연동 매장이면 안내, 본인 매장이면 미노출, premium 락 */}
        {FEATURE_MESSENGER_ENABLED && !(shop?.ownerUid && currentUser?.id === shop.ownerUid) && (
          <Pressable
            style={styles.chatCtaBig}
            onPress={async () => {
              if (!isPremium) {
                setPaywall({ visible: true, feature: '메신저 (사장님 채팅)' });
                return;
              }
              const isLinked = shop?.verified === true && shop.ownerUid;
              if (!isLinked) {
                showInfoAlert(
                  '미연동 매장',
                  '동대문 셰르파에 미연동된 매장이에요.\n사장님께 무료 회원가입 및 연동을 권해주세요!',
                );
                return;
              }
              if (!currentUser?.id) {
                showInfoAlert('로그인 필요', '챗 하기는 로그인 후 이용 가능합니다.');
                return;
              }
              try {
                const chat = await ensureChat({
                  visitorUid: currentUser.id,
                  visitorDisplayName: currentUser.displayName ?? currentUser.email,
                  merchantUid: shop.ownerUid,
                  shopId: shop.id,
                  shopDisplayName: shop.displayName || '매장',
                });
                router.push(`/chat/${chat.id}` as any);
              } catch (e: any) {
                showInfoAlert('채팅 열기 실패', e?.message ?? '네트워크 오류');
              }
            }}
          >
            <MessageCircle size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.chatCtaBigText}>챗 하기</Text>
          </Pressable>
        )}

        {/* 키워드 chip wrap */}
        {store.keywords && parseKeywordTags(store.keywords).length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>키워드</Text>
            <View style={styles.keywordWrap}>
              {parseKeywordTags(store.keywords).map((kw, i) => (
                <Pressable
                  key={i}
                  style={styles.keywordChip}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: kw } })}
                >
                  <Text style={styles.keywordChipText}>#{kw}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 상세 설명은 매장정보 카드 바로 아래로 이동됨 */}
      </ScrollView>

      <PaywallSheet
        visible={paywall.visible}
        feature={paywall.feature}
        onClose={() => setPaywall({ visible: false })}
      />
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────
// 프리미엄 전용 기능 잠금 안내 블록 — 메모 / 포토 메모 탭에서 공용 사용
// ────────────────────────────────────────────────
function PremiumLockBlock({
  title,
  desc,
  onPressInfo,
}: {
  title: string;
  desc: string;
  onPressInfo: () => void;
}) {
  return (
    <View style={lockStyles.wrap}>
      <View style={lockStyles.iconWrap}>
        <Crown size={28} color={Colors.warning} strokeWidth={2.4} />
      </View>
      <Text style={lockStyles.title}>{title}</Text>
      <Text style={lockStyles.desc}>{desc}</Text>
      <Button
        label="프리미엄 안내 보기"
        onPress={onPressInfo}
        style={{ marginTop: 18, paddingHorizontal: 28 }}
      />
    </View>
  );
}

const lockStyles = StyleSheet.create({
  wrap: { padding: 28, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF4D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  desc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});

// ────────────────────────────────────────────────
// 액션 영역: 위 = 관심 매장 등록 (가로 풀폭), 아래 = 위치보기 + 리뷰보기
// ────────────────────────────────────────────────
function ActionRow({
  shopCode,
  isPremium,
  requestPaywall,
}: {
  shopCode: string;
  isPremium: boolean;
  requestPaywall: (feature: string) => void;
}) {
  const favoriteCodes = useFavoritesStore((s) => s.codes);
  const toggleFav = useFavoritesStore((s) => s.toggle);
  const isFav = favoriteCodes.includes(shopCode);
  const agg = useReviewsStore((s) => s.aggBy[shopCode]);
  const dirStore = getStoreByCode(shopCode);

  const onToggleFav = async () => {
    // 관심 매장은 free 사용자도 사용 가능 (락 해제)
    await toggleFav(shopCode);
  };

  const onViewOnMap = () => {
    router.push({
      pathname: '/map-building',
      params: { highlight: shopCode },
    });
  };

  const onViewReviews = () => {
    router.push({
      pathname: '/store/reviews/[code]',
      params: { code: shopCode },
    });
  };

  // 길안내는 destination-summary 가 출발점인데 앱 어디에서도 이리로 들어오는 경로가
  // 없어서 기능 전체가 도달 불가였다. 디렉터리에 없는 신규 등록 매장은 좌표가 없어 제외.
  const onFindRoute = () => {
    if (!dirStore) return;
    router.push({
      pathname: '/route/destination-summary',
      params: {
        building: dirStore.building,
        floor: dirStore.floor,
        unit: dirStore.unit,
        name: dirStore.name,
      },
    });
  };

  const reviewCount = agg?.ratingCount ?? 0;
  const reviewAvg = agg && agg.ratingCount > 0 ? agg.average : null;

  return (
    <View style={styles.actionWrap}>
      <View style={styles.action3Row}>
        <Pressable style={styles.actionCard} onPress={onToggleFav}>
          <Heart
            size={20}
            color={isFav ? '#E63946' : Colors.textMuted}
            fill={isFav ? '#E63946' : 'transparent'}
            strokeWidth={2}
          />
          <Text style={[styles.actionCardLabel, isFav && { color: '#E63946', fontWeight: '800' }]}>
            {isFav ? '관심 해제' : '관심 매장 등록'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionCard} onPress={onViewOnMap}>
          <MapPin size={20} color={Colors.text} strokeWidth={2} />
          <Text style={styles.actionCardLabel}>위치 보기</Text>
        </Pressable>
        <Pressable style={styles.actionCard} onPress={onViewReviews}>
          <View style={styles.actionStarRow}>
            <StarRow value={reviewAvg ?? 0} size={12} muted />
            <Text style={styles.actionStarAvg}>
              {reviewAvg !== null ? reviewAvg.toFixed(1) : '-'}
            </Text>
          </View>
          <Text style={styles.actionCardLabel}>리뷰 {reviewCount}개</Text>
        </Pressable>
      </View>

      {dirStore && <Button label="여기까지 길찾기" onPress={onFindRoute} />}

      {/* hidden — 기존 호환 */}
      <View style={{ display: 'none' }}>
        <Pressable style={styles.reviewBtn} onPress={onViewReviews}>
          <View style={{ flex: 1 }}>
            <View style={styles.reviewBtnTopRow}>
              <StarRow value={reviewAvg ?? 0} size={13} muted />
              <Text style={styles.reviewBtnAvg}>
                {reviewAvg !== null ? reviewAvg.toFixed(1) : '-'}
              </Text>
            </View>
            <Text style={styles.reviewBtnCount}>
              리뷰 {reviewCount}개 보기
            </Text>
          </View>
          <ChevronRight size={20} color={Colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────
// 메모 탭
// ────────────────────────────────────────────────
function MemoTab({
  shopCode,
  isPremium,
  requestPaywall,
}: {
  shopCode: string;
  isPremium: boolean;
  requestPaywall: () => void;
}) {
  const savedMemo = useMemosStore((s) => (shopCode ? s.memos[shopCode] ?? '' : ''));
  const saveMemo = useMemosStore((s) => s.set);
  const [draft, setDraft] = useState(savedMemo);
  const [savedTick, setSavedTick] = useState<number | null>(null);

  useEffect(() => {
    setDraft(savedMemo);
  }, [savedMemo]);

  const onSave = async () => {
    if (!shopCode) return;
    if (!isPremium) {
      requestPaywall();
      return;
    }
    await saveMemo(shopCode, draft);
    const tick = Date.now();
    setSavedTick(tick);
    setTimeout(() => setSavedTick((cur) => (cur === tick ? null : cur)), 1800);
  };

  const dirty = draft !== savedMemo;

  if (!isPremium) {
    return (
      <PremiumLockBlock
        title="메모하기 — 프리미엄 전용"
        desc={'이 매장에 대한 자유 메모를 작성하고\n언제든 다시 확인할 수 있어요.'}
        onPressInfo={requestPaywall}
      />
    );
  }

  return (
    <View style={styles.memoBlock}>
      <View style={styles.memoHeader}>
        <Text style={styles.memoTitle}>메모하기</Text>
        <Pressable
          onPress={onSave}
          disabled={!dirty}
          style={[styles.memoSaveBtn, !dirty && styles.memoSaveBtnDisabled]}
        >
          {savedTick ? (
            <View style={styles.memoSavedRow}>
              <Check size={11} color="#fff" strokeWidth={3} />
              <Text style={styles.memoSaveText}>저장됨</Text>
            </View>
          ) : (
            <Text style={[styles.memoSaveText, !dirty && styles.memoSaveTextDisabled]}>
              {dirty ? '저장' : '변경 없음'}
            </Text>
          )}
        </Pressable>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="이 매장에 대해 메모해 두세요. (예: 가격대, 구매 품목, 담당자 이름)"
        placeholderTextColor={Colors.textMuted}
        multiline
        style={styles.memoInput}
        textAlignVertical="top"
      />
    </View>
  );
}

// ────────────────────────────────────────────────
// 포토 메모 탭
// ────────────────────────────────────────────────
function PhotosTab({
  shopCode,
  isPremium,
  requestPaywall,
}: {
  shopCode: string;
  isPremium: boolean;
  requestPaywall: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const photos = usePhotoMemosStore((s) => s.byShop[shopCode] ?? []);
  const watch = usePhotoMemosStore((s) => s.watch);
  const unwatch = usePhotoMemosStore((s) => s.unwatch);

  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; caption: string } | null>(null);

  useEffect(() => {
    if (!shopCode || !user) return;
    watch(shopCode);
    return () => unwatch(shopCode);
  }, [shopCode, user?.id]);

  if (!user) {
    return (
      <View style={styles.tabEmpty}>
        <Text style={styles.tabEmptyText}>로그인 후 사용 가능합니다.</Text>
        <Button label="로그인" onPress={() => router.push('/(auth)/login')} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (!isPremium) {
    return (
      <PremiumLockBlock
        title="포토 메모 — 프리미엄 전용"
        desc={'스와치·샘플 사진을 매장별로 저장해\n시장에서 빠르게 비교·구매할 수 있어요.'}
        onPressInfo={requestPaywall}
      />
    );
  }

  const atLimit = photos.length >= MAX_PHOTOS_PER_SHOP;

  const upload = async (uri: string) => {
    setBusy(true);
    try {
      await uploadPhotoMemo(shopCode, uri);
    } catch (e) {
      showInfoAlert('업로드 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onAdd = async () => {
    if (!isPremium) {
      requestPaywall();
      return;
    }
    if (atLimit) {
      showInfoAlert('사진 제한', `업체당 최대 ${MAX_PHOTOS_PER_SHOP}장까지 저장할 수 있습니다.`);
      return;
    }
    const pickFromCamera = async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        showInfoAlert('권한 필요', '카메라 사용 권한이 필요합니다.');
        return;
      }
      const r = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (!r.canceled && r.assets[0]) await upload(r.assets[0].uri);
    };
    const pickFromLibrary = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        showInfoAlert('권한 필요', '사진첩 접근 권한이 필요합니다.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!r.canceled && r.assets[0]) await upload(r.assets[0].uri);
    };
    // 카메라/사진첩 2-옵션: showConfirmAlert 의 두 버튼으로 매핑 (confirm=카메라, cancel=사진첩)
    showConfirmAlert('사진 추가', '사진을 어떻게 추가할까요?', pickFromCamera, {
      confirmLabel: '카메라로 촬영',
      cancelLabel: '사진첩에서 선택',
      onCancel: pickFromLibrary,
    });
  };

  const onDelete = (id: string, storagePath: string) => {
    showConfirmAlert(
      '삭제 확인',
      '이 사진을 삭제할까요?',
      async () => {
        try {
          await deletePhotoMemo(shopCode, id, storagePath);
        } catch (e) {
          showInfoAlert('삭제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  return (
    <View style={styles.photosBlock}>
      <View style={styles.photosHeader}>
        <Text style={styles.sectionTitleInline}>
          포토 메모 ({photos.length}/{MAX_PHOTOS_PER_SHOP})
        </Text>
      </View>

      <View style={styles.photoGrid}>
        {photos.map((p) => (
          <View key={p.id} style={styles.photoItem}>
            <Image source={{ uri: p.url }} style={styles.photoImage} resizeMode="cover" />
            <Pressable
              style={styles.photoDeleteBtn}
              onPress={() => onDelete(p.id, p.storagePath)}
              accessibilityLabel="사진 삭제"
            >
              <X size={14} color="#fff" strokeWidth={3} />
            </Pressable>
            <Pressable
              style={styles.photoCaption}
              onPress={() => setEditing({ id: p.id, caption: p.caption })}
            >
              <Text style={styles.photoCaptionText} numberOfLines={2}>
                {p.caption || '캡션 추가'}
              </Text>
            </Pressable>
          </View>
        ))}

        {!atLimit && (
          <Pressable
            style={[styles.photoAddSlot, busy && styles.photoAddSlotBusy]}
            onPress={onAdd}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <View style={styles.photoAddInner}>
                <Plus size={36} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.photoAddLabel}>사진 추가</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {photos.length === 0 && !busy && (
        <Text style={styles.photosHintBelow}>
          스와치, 가격표, 담당자 명함 등을 사진으로 기록해 보세요.
        </Text>
      )}

      {editing && (
        <CaptionEditor
          shopCode={shopCode}
          photoId={editing.id}
          initial={editing.caption}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

function CaptionEditor({
  shopCode,
  photoId,
  initial,
  onClose,
}: {
  shopCode: string;
  photoId: string;
  initial: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updatePhotoMemoCaption(shopCode, photoId, text);
      onClose();
    } catch (e) {
      showInfoAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.captionEditor}>
      <Text style={styles.captionEditorTitle}>캡션 편집</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="예: 옅은 핑크 시폰, 1.5m"
        placeholderTextColor={Colors.textMuted}
        style={styles.captionInput}
        multiline
      />
      <View style={styles.captionEditorActions}>
        <Button label="취소" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label={saving ? '저장 중...' : '저장'} onPress={save} disabled={saving} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────
// 사장님 채팅 CTA — 인증 매장에 1:1 문의 진입
// ────────────────────────────────────────────────
function ChatCta({
  visitorUid,
  visitorDisplayName,
  shop,
}: {
  visitorUid: string;
  visitorDisplayName?: string;
  shop: Shop;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const onOpen = async () => {
    if (busy) return;
    if (!FEATURE_MESSENGER_ENABLED) {
      showInfoAlert(MESSENGER_COMING_SOON_TITLE, MESSENGER_COMING_SOON_BODY);
      return;
    }
    setBusy(true);
    try {
      const chat = await ensureChat({
        visitorUid,
        visitorDisplayName,
        merchantUid: shop.ownerUid,
        shopId: shop.id,
        shopDisplayName: shop.displayName || '매장',
      });
      router.push(`/chat/${chat.id}` as any);
    } catch (e: any) {
      showInfoAlert('채팅 열기 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={chatCtaStyles.wrap}>
      <Pressable
        style={chatCtaStyles.btn}
        onPress={onOpen}
        disabled={busy}
        accessibilityLabel="사장님과 채팅"
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <MessageCircle size={18} color="#fff" strokeWidth={2.4} />
        )}
        <Text style={chatCtaStyles.text}>{t('store.chatWithOwner')}</Text>
      </Pressable>
      <Text style={chatCtaStyles.hint}>
        제품 사진을 보내며 보유 여부를 직접 물어보실 수 있어요.
      </Text>
    </View>
  );
}

const catalogStyles = StyleSheet.create({
  wrap: { marginTop: 12, paddingHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '800', color: Colors.text },
  manageLink: { fontSize: 12, color: Colors.primary, fontWeight: '800' },
  row: { gap: 10, paddingRight: 16 },
  card: {
    width: 130,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: 100, backgroundColor: Colors.background },
  cardImgEmpty: { justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 12, fontWeight: '700', color: Colors.text, paddingHorizontal: 8, paddingTop: 6 },
  cardPrice: { fontSize: 12, color: Colors.primary, fontWeight: '800', paddingHorizontal: 8, paddingTop: 2, paddingBottom: 8 },
  emptyOwner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F0F4FB',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    alignItems: 'center',
    gap: 8,
  },
  emptyOwnerText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  emptyOwnerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  emptyOwnerBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

const chatCtaStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  imageWrap: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  imageRow: { backgroundColor: '#000' },
  image: { width: 380, height: 240 },
  imageOverlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  statusChipOverlay: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoursChipOverlay: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursChipText: { fontSize: 11, color: Colors.text, fontWeight: '700' },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bigBuildingIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigBuildingText: { fontSize: 22, fontWeight: '900' },
  infoCardActions: { gap: 6, alignItems: 'flex-end', justifyContent: 'space-between' },
  infoCardBtnRow: { flexDirection: 'row', gap: 6 },
  hoursBelowBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.divider,
  },
  hoursBelowBtnsText: { fontSize: 10, color: Colors.text, fontWeight: '700' },
  roundIconBtn: {
    width: 52,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  roundIconLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  head: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  buildingBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headPhoneBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  storeName: { flex: 1, fontSize: 19, fontWeight: '800', color: Colors.text, lineHeight: 24 },
  storeMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E0F2E9',
  },
  verifiedText: { fontSize: 13, fontWeight: '800', color: '#1B7A3E' },

  chipRow: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 0,
  },
  catChipText: { fontSize: 13, fontWeight: '700' },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: Colors.divider,
    flexShrink: 0,
  },
  subChipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  actionWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  action3Row: { flexDirection: 'row', gap: 8 },
  actionCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 4,
  },
  actionCardLabel: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  actionStarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionStarAvg: { fontSize: 13, fontWeight: '800', color: Colors.text },
  favLongBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favLongBtnActive: {
    backgroundColor: '#FFE8EC',
    borderColor: '#E63946',
  },
  favLongText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  favLongTextActive: { color: '#E63946' },
  splitRow: { flexDirection: 'row', gap: 8 },
  locBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  locLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  reviewBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  reviewBtnTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewBtnAvg: { fontSize: 13, fontWeight: '800', color: Colors.text },
  reviewBtnCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },

  tabStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: Colors.divider,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.text, fontWeight: '700' },

  memoBlock: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  memoTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  memoSavedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  memoSavedText: { fontSize: 11, color: '#2E8B57', fontWeight: '700' },
  memoInput: {
    minHeight: 280,
    maxHeight: 480,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 12,
    paddingHorizontal: 14,
    lineHeight: 21,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  memoFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  memoSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  memoSaveBtnDisabled: { backgroundColor: Colors.divider },
  memoSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  memoSaveTextDisabled: { color: Colors.textMuted },

  photosBlock: { paddingHorizontal: 16, paddingTop: 12 },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', aspectRatio: 1 },
  photoAddSlot: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddSlotBusy: { opacity: 0.6 },
  photoAddInner: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  photoAddLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  photosHintBelow: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCaption: { padding: 8 },
  photoCaptionText: { fontSize: 12, color: Colors.text },

  captionEditor: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  captionEditorTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: Colors.text },
  captionInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 14,
    color: Colors.text,
  },
  captionEditorActions: { flexDirection: 'row', gap: 8, marginTop: 10 },

  infoSection: { marginTop: 12 },

  contactCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
  },
  contactCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactCardLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  contactCardValue: { fontSize: 13, fontWeight: '800', color: Colors.text, marginTop: 2 },

  chatCtaBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  chatCtaBigText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  sectionCard: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  keywordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  keywordChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  keywordChipText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
  descriptionText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 2 },
  infoValuePhone: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  verifiedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#E0F2E9',
  },
  verifiedNoteText: { fontSize: 12, color: '#1B7A3E', fontWeight: '700' },

  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '700', marginBottom: 8 },
  sectionTitleInline: { fontSize: 13, color: Colors.text, fontWeight: '700' },
  keywordRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  keyword: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.divider, borderRadius: 12 },
  keywordText: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  description: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  tabEmpty: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  tabEmptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  tabEmptyHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
});
