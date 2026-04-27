import React, { useEffect, useState } from 'react';
import {
  FlatList,
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
import { Colors, BuildingColors } from '@/constants/colors';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useAuthStore } from '@/stores/authStore';
import { BUILDING_ORDER } from '@/constants/buildings';
import { getStoreByCode } from '@/data/stores';
import { APPROVAL_PENDING_FLAG } from '@/constants/approval';
import { showInfoAlert } from '@/utils/alerts';
import { subscribeMyShops } from '@/lib/shops';
import { Shop } from '@/types';

const QUICK_ACTIONS: Array<{ key: string; label: string; emoji: string; query: string }> = [
  { key: 'store_name', label: '상호 찾기', emoji: '🔎', query: '' },
  { key: 'fabric', label: '원단', emoji: '🧵', query: '원단' },
  { key: 'accessory', label: '부자재', emoji: '🪡', query: '부자재' },
  { key: 'thread', label: '실', emoji: '🧶', query: '실' },
  { key: 'lace', label: '레이스', emoji: '✨', query: '레이스' },
  { key: 'facility', label: '편의시설', emoji: '🏧', query: '편의시설' },
  { key: 'food', label: '식당가', emoji: '🍱', query: '식당가' },
  { key: 'cafe', label: '카페', emoji: '☕', query: '카페' },
];

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const recentQueries = useSearchStore((s) => s.recentQueries);
  const setBuilding = useMapStore((s) => s.setBuilding);
  const setFloor = useMapStore((s) => s.setFloor);
  const favoriteCodes = useFavoritesStore((s) => s.codes);
  const user = useAuthStore((s) => s.user);
  const [myShops, setMyShops] = useState<Shop[]>([]);
  const favoriteStores = favoriteCodes
    .map((c) => getStoreByCode(c))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';

  // 사장님은 본인 shops를 실시간 구독 — 등록 매장 수, 환영 배너에 사용
  useEffect(() => {
    if (!isMerchantActive || !user?.id) return;
    const unsub = subscribeMyShops(user.id, setMyShops);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView>
        <View style={styles.hero}>
          <Text style={styles.greet}>어디를 찾으시나요?</Text>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="예: 헤이민레이스, 원단, 화장실, A3156호"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => submitSearch(query)}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Text style={styles.clearIcon}>×</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 사장님 환영 배너 */}
        {isMerchantActive && (
          <Pressable style={styles.merchantBanner} onPress={() => router.push('/my-shops')}>
            <View style={styles.merchantIconWrap}>
              <Text style={styles.merchantIcon}>🏬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.merchantHello}>
                안녕하세요, {user?.displayName ?? '사장님'} 사장님
              </Text>
              <Text style={styles.merchantSub}>
                {myShops.length === 0
                  ? '내 매장 검색해서 매칭하기'
                  : `매칭된 매장 ${myShops.length}개 · 정보 관리하기`}
              </Text>
            </View>
            <Text style={styles.merchantArrow}>›</Text>
          </Pressable>
        )}

        {/* 관심 매장 진입 바 */}
        <Pressable style={styles.favBar} onPress={() => router.push('/favorites')}>
          <Text style={styles.favBarIcon}>❤️</Text>
          <Text style={styles.favBarLabel}>관심 매장</Text>
          <Text style={styles.favBarCount}>{favoriteStores.length}개</Text>
          <Text style={styles.favBarArrow}>›</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>빠른 검색</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((a) => (
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
                <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

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
          <Text style={styles.floorCtaArrow}>›</Text>
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

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
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
