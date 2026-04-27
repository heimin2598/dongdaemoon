import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, BuildingColors } from '@/constants/colors';
import { searchStores, getStoresByCategory, getStoresBySubCategory, CATEGORY_TREE, countStores, parseKeywordTags } from '@/data/stores';
import { MAIN_CATEGORIES, MAIN_CATEGORY_COLOR, MAIN_CATEGORY_EMOJI, MainCategory, Store } from '@/data/stores/types';
import { FLOOR_LABEL } from '@/constants/floors';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSearchStore } from '@/stores/searchStore';

type Mode = 'all' | 'category';

export default function SearchTab() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [mode, setMode] = useState<Mode>('all');
  const [activeCat, setActiveCat] = useState<MainCategory | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const pushQuery = useSearchStore((s) => s.pushQuery);
  const recentQueries = useSearchStore((s) => s.recentQueries);

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      setMode('all');
      pushQuery(params.q);
    }
  }, [params.q, pushQuery]);

  const total = useMemo(() => countStores(), []);

  const storeResults = useMemo<Store[]>(() => {
    if (query.trim()) return searchStores(query, 100);
    if (activeSub) return getStoresBySubCategory(activeSub);
    if (activeCat) return getStoresByCategory(activeCat);
    return [];
  }, [query, activeCat, activeSub]);

  const hasActiveFilter = !!query.trim() || !!activeCat || !!activeSub;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setMode('all'); }}
            placeholder={`전체 ${total.toLocaleString()}개 점포 검색 · 상호명, 품목, 호수, 전화`}
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => pushQuery(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Text style={styles.clearIcon}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, mode === 'all' && styles.modeTabActive]}
          onPress={() => { setMode('all'); setActiveCat(null); setActiveSub(null); }}
        >
          <Text style={[styles.modeTabText, mode === 'all' && styles.modeTabTextActive]}>검색</Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, mode === 'category' && styles.modeTabActive]}
          onPress={() => { setMode('category'); setQuery(''); }}
        >
          <Text style={[styles.modeTabText, mode === 'category' && styles.modeTabTextActive]}>카테고리</Text>
        </Pressable>
      </View>

      {mode === 'category' && !activeCat && (
        <ScrollView contentContainerStyle={styles.categoryGrid}>
          <Text style={styles.hint}>대카테고리를 선택하세요</Text>
          <View style={styles.catCards}>
            {MAIN_CATEGORIES.map((c) => {
              const color = MAIN_CATEGORY_COLOR[c];
              const emoji = MAIN_CATEGORY_EMOJI[c];
              const count = getStoresByCategory(c).length;
              return (
                <Pressable
                  key={c}
                  style={[styles.catCard, { borderColor: color }]}
                  onPress={() => { setActiveCat(c); setActiveSub(null); }}
                >
                  <Text style={styles.catEmoji}>{emoji}</Text>
                  <Text style={[styles.catName, { color }]}>{c}</Text>
                  <Text style={styles.catCount}>{count.toLocaleString()}개</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {mode === 'category' && activeCat && (
        <View style={{ flex: 1 }}>
          <View style={styles.catHeader}>
            <Pressable onPress={() => { setActiveCat(null); setActiveSub(null); }} hitSlop={10}>
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>
            <Text style={styles.catHeaderTitle}>
              {MAIN_CATEGORY_EMOJI[activeCat]} {activeCat}
              {activeSub && ` · ${activeSub}`}
            </Text>
          </View>

          <View style={styles.subRowWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subRow}
            >
              <Pressable
                onPress={() => setActiveSub(null)}
                style={[styles.subChip, !activeSub && styles.subChipActive]}
              >
                <Text style={[styles.subChipText, !activeSub && styles.subChipTextActive]}>전체</Text>
              </Pressable>
              {(CATEGORY_TREE[activeCat] ?? []).map((sub) => {
                const active = activeSub === sub;
                return (
                  <Pressable
                    key={sub}
                    onPress={() => setActiveSub(sub)}
                    style={[styles.subChip, active && styles.subChipActive]}
                  >
                    <Text style={[styles.subChipText, active && styles.subChipTextActive]}>{sub}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <StoreList stores={storeResults} />
        </View>
      )}

      {mode === 'all' && (
        <>
          {!hasActiveFilter && (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {recentQueries.length > 0 && (
                <View style={{ padding: 16 }}>
                  <Text style={styles.hint}>최근 검색</Text>
                  <View style={styles.chipRow}>
                    {recentQueries.slice(0, 10).map((q) => (
                      <Pressable key={q} style={styles.recentChip} onPress={() => setQuery(q)}>
                        <Text style={styles.recentChipText}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <View style={{ padding: 16, paddingTop: recentQueries.length ? 0 : 16 }}>
                <Text style={styles.hint}>추천 검색어</Text>
                <View style={styles.chipRow}>
                  {['원단', '부자재', '침구', '식당가', '카페', '화장실', 'ATM', '약국', '무신사'].map((q) => (
                    <Pressable key={q} style={styles.recentChip} onPress={() => setQuery(q)}>
                      <Text style={styles.recentChipText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}
          {hasActiveFilter && <StoreList stores={storeResults} />}
        </>
      )}
    </SafeAreaView>
  );
}

function StoreList({ stores }: { stores: Store[] }) {
  const favoriteCodes = useFavoritesStore((s) => s.codes);
  if (stores.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>결과가 없습니다.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={stores}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item: s }) => {
        const bColor = s.building ? BuildingColors[s.building] : BuildingColors.B;
        const catColor = MAIN_CATEGORY_COLOR[s.category];
        const tags = parseKeywordTags(s.keywords);
        const floorLabel = s.floor ? FLOOR_LABEL[s.floor] : '';
        const isFav = !!s.code && favoriteCodes.includes(s.code);
        return (
          <Pressable
            style={styles.row}
            onPress={() => s.code && router.push({ pathname: '/store/[code]', params: { code: s.code } })}
          >
            <View style={[styles.locationBadge, { backgroundColor: bColor.primary }]}>
              <Text style={[styles.locText, { color: bColor.text }]} numberOfLines={1}>
                {s.building}동 {floorLabel}{s.unit ? ` ${s.unit}호` : ''}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={2}>
                {s.name}
                {isFav ? <Text style={styles.favHeart}> ❤️</Text> : null}
              </Text>
              <View style={styles.tagRow}>
                <View style={[styles.catTag, { backgroundColor: catColor + '22', borderColor: catColor }]}>
                  <Text style={[styles.catTagText, { color: catColor }]}>{s.category}</Text>
                </View>
                {s.subCategory ? (
                  <View style={styles.subTag}>
                    <Text style={styles.subTagText}>{s.subCategory}</Text>
                  </View>
                ) : null}
                {tags.slice(0, 4).map((t) => (
                  <View key={t} style={styles.kwTag}>
                    <Text style={styles.kwTagText}>#{t}</Text>
                  </View>
                ))}
                {tags.length > 4 && (
                  <View style={styles.kwTag}>
                    <Text style={styles.kwTagText}>+{tags.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  searchWrap: { padding: 16, paddingBottom: 0 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { marginRight: 8, fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  clearIcon: { fontSize: 22, color: Colors.textMuted, paddingHorizontal: 6 },
  modeTabs: { flexDirection: 'row', padding: 12, gap: 8 },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  modeTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeTabText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  modeTabTextActive: { color: Colors.textInverse },
  hint: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', marginBottom: 10 },
  categoryGrid: { padding: 16 },
  catCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  catEmoji: { fontSize: 30, marginBottom: 6 },
  catName: { fontSize: 15, fontWeight: '800' },
  catCount: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  catHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backChevron: { fontSize: 28, color: Colors.text, fontWeight: '300' },
  catHeaderTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  subRowWrap: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  subRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, alignItems: 'center' },
  subChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  subChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subChipText: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  subChipTextActive: { color: Colors.textInverse },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recentChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  recentChipText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  sep: { height: 1, backgroundColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  locationBadge: {
    minWidth: 140,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  rowName: { fontSize: 17, fontWeight: '800', color: Colors.text, lineHeight: 22 },
  favHeart: { fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  catTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  catTagText: { fontSize: 11, fontWeight: '700' },
  subTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.divider },
  subTagText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  kwTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: '#EAF1FB' },
  kwTagText: { fontSize: 10, fontWeight: '600', color: '#2E5CAD' },
  arrow: { fontSize: 22, color: Colors.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 13, color: Colors.textMuted },
});
