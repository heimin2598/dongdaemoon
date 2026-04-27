import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { PhoneIcon } from '@/components/common/PhoneIcon';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { getStoreByCode, parseKeywordTags } from '@/data/stores';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useMemosStore } from '@/stores/memosStore';
import { MAIN_CATEGORY_COLOR, MAIN_CATEGORY_EMOJI } from '@/data/stores/types';
import { BuildingCode, FloorCode, Shop } from '@/types';
import { subscribeShopByStoreCode } from '@/lib/shops';

export default function StoreDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const store = code ? getStoreByCode(decodeURIComponent(code)) : undefined;

  const favoriteCodes = useFavoritesStore((s) => s.codes);
  const toggleFav = useFavoritesStore((s) => s.toggle);
  const isFav = store?.code ? favoriteCodes.includes(store.code) : false;

  const savedMemo = useMemosStore((s) => (store?.code ? s.memos[store.code] ?? '' : ''));
  const saveMemo = useMemosStore((s) => s.set);
  const [memoDraft, setMemoDraft] = useState(savedMemo);
  const [memoSavedTick, setMemoSavedTick] = useState<number | null>(null);

  // 사장님이 등록한 overlay 정보 실시간 구독
  const [shop, setShop] = useState<Shop | null>(null);
  useEffect(() => {
    if (!store?.code) return;
    const unsub = subscribeShopByStoreCode(store.code, setShop);
    return () => unsub();
  }, [store?.code]);

  useEffect(() => {
    setMemoDraft(savedMemo);
  }, [savedMemo]);

  if (!store) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="점포" />
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

  // overlay 우선순위: 사장님이 등록한 정보 > 정적 데이터
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

  const onViewOnMap = () => {
    router.push({
      pathname: '/map-building',
      params: { highlight: store.code ?? '' },
    });
  };

  const onSaveMemo = async () => {
    if (!store.code) return;
    await saveMemo(store.code, memoDraft);
    const tick = Date.now();
    setMemoSavedTick(tick);
    // 1.8초 후 "저장됨" 라벨 숨김
    setTimeout(() => {
      setMemoSavedTick((cur) => (cur === tick ? null : cur));
    }, 1800);
  };

  const memoDirty = memoDraft !== savedMemo;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={displayName || '점포 상세'} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {store.images.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageRow}
          >
            {store.images.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.image} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* 헤더 */}
        <View style={styles.head}>
          <View style={styles.headTopRow}>
            {building && (
              <View style={[styles.buildingBadge, { backgroundColor: bColor.primary }]}>
                <Text style={{ color: bColor.text, fontWeight: '800' }}>{building}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.storeName} numberOfLines={2}>{displayName}</Text>
                {shop && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ 인증 매장</Text>
                  </View>
                )}
              </View>
              <Text style={styles.storeMeta}>
                {building}동 · {floor && FLOOR_LABEL[floor]} · {store.unit}호
                {shop && shop.storeCodes.length > 1 ? ` (외 ${shop.storeCodes.length - 1}호)` : ''}
              </Text>
            </View>
            {phoneRaw && (
              <Pressable
                style={styles.headPhoneBtn}
                onPress={onCall}
                accessibilityLabel="전화 걸기"
              >
                <PhoneIcon size={22} color="#fff" />
              </Pressable>
            )}
          </View>
          <View style={styles.chipRow}>
            <View style={[styles.catChip, { backgroundColor: catColor + '22', borderColor: catColor }]}>
              <Text style={[styles.catChipText, { color: catColor }]}>
                {catEmoji} {store.category}
              </Text>
            </View>
            {store.subCategory && (
              <View style={styles.subChip}>
                <Text style={styles.subChipText}>{store.subCategory}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 액션: 2줄 배치 */}
        <View style={styles.actionBlock}>
          <Pressable
            style={[styles.favRowBtn, isFav && styles.favRowBtnActive]}
            onPress={() => store.code && toggleFav(store.code)}
          >
            <Text style={styles.favRowIcon}>{isFav ? '❤️' : '🤍'}</Text>
            <Text style={[styles.favRowText, isFav && styles.favRowTextActive]}>
              {isFav ? '관심 매장 해제' : '관심 매장 등록'}
            </Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Button label="지도에서 보기" variant="secondary" onPress={onViewOnMap} style={{ flex: 1 }} />
          </View>
        </View>

        {/* 메모 박스 */}
        <View style={styles.memoBlock}>
          <View style={styles.memoHeader}>
            <Text style={styles.memoTitle}>메모하기</Text>
            {memoSavedTick && <Text style={styles.memoSavedText}>저장됨 ✓</Text>}
          </View>
          <TextInput
            value={memoDraft}
            onChangeText={setMemoDraft}
            placeholder="이 매장에 대해 메모해 두세요. (예: 가격대, 구매 품목, 담당자 이름)"
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.memoInput}
            textAlignVertical="top"
          />
          <View style={styles.memoFooter}>
            <Pressable
              onPress={onSaveMemo}
              disabled={!memoDirty}
              style={[styles.memoSaveBtn, !memoDirty && styles.memoSaveBtnDisabled]}
            >
              <Text style={[styles.memoSaveText, !memoDirty && styles.memoSaveTextDisabled]}>
                {memoDirty ? '저장' : savedMemo ? '변경 없음' : '저장'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 전화번호 */}
        {phoneFormatted && (
          <Pressable style={styles.infoRow} onPress={onCall}>
            <Text style={styles.infoIcon}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>전화</Text>
              <Text style={styles.infoValuePhone}>{phoneFormatted}</Text>
            </View>
            <Text style={styles.infoArrow}>›</Text>
          </Pressable>
        )}

        {/* 영업시간 (사장님 등록) */}
        {businessHours && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>영업시간</Text>
              <Text style={styles.infoValue}>{businessHours}</Text>
            </View>
          </View>
        )}

        {/* 상세 위치 */}
        {store.location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>위치</Text>
              <Text style={styles.infoValue}>{store.location}</Text>
            </View>
          </View>
        )}

        {/* 인증 매장 안내 */}
        {shop && (
          <View style={styles.verifiedNote}>
            <Text style={styles.verifiedNoteText}>
              ✓ 사장님이 직접 등록한 최신 정보입니다.
            </Text>
          </View>
        )}

        {/* 키워드 */}
        {store.keywords && parseKeywordTags(store.keywords).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>키워드</Text>
            <View style={styles.keywordRow}>
              {parseKeywordTags(store.keywords).map((kw, i) => (
                <Pressable
                  key={i}
                  style={styles.keyword}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: kw } })}
                >
                  <Text style={styles.keywordText}>#{kw}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 상세 설명 (사장님 등록 우선) */}
        {description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              상세 설명 {shop?.description?.trim() ? '(사장님 등록)' : ''}
            </Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  imageRow: { backgroundColor: '#000' },
  image: { width: 380, height: 260, marginRight: 0 },
  head: { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  buildingBadge: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
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
  headPhoneIcon: { fontSize: 20 },
  storeName: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.text },
  storeMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E0F2E9',
  },
  verifiedText: { fontSize: 11, fontWeight: '800', color: '#1B7A3E' },
  verifiedNote: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#E0F2E9',
  },
  verifiedNoteText: { fontSize: 12, color: '#1B7A3E', fontWeight: '700', textAlign: 'center' },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '700' },
  subChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.divider },
  subChipText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  actionBlock: { padding: 16, gap: 10 },
  favRowBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favRowBtnActive: {
    backgroundColor: '#FFE8EC',
    borderColor: '#E63946',
  },
  favRowIcon: { fontSize: 18 },
  favRowText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  favRowTextActive: { color: '#E63946' },
  actionRow: { flexDirection: 'row', gap: 8 },

  memoBlock: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFDEB',
    borderWidth: 1,
    borderColor: '#F3E9A0',
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  memoTitle: { fontSize: 12, fontWeight: '700', color: '#8B6B00' },
  memoSavedText: { fontSize: 11, color: '#2E8B57', fontWeight: '700' },
  memoInput: {
    minHeight: 160,
    maxHeight: 320,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 8,
    lineHeight: 20,
  },
  memoFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  memoSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  memoSaveBtnDisabled: { backgroundColor: Colors.divider },
  memoSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  memoSaveTextDisabled: { color: Colors.textMuted },

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
  infoIcon: { fontSize: 18 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 2 },
  infoValuePhone: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  infoArrow: { fontSize: 20, color: Colors.textMuted },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '700', marginBottom: 8 },
  keywordRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  keyword: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.divider, borderRadius: 12 },
  keywordText: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  description: { fontSize: 14, color: Colors.text, lineHeight: 22 },
});
