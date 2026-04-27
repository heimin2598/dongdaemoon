import React, { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { getStoreByCode } from '@/data/stores';
import { Store } from '@/data/stores/types';
import { useFavoritesStore } from '@/stores/favoritesStore';

export default function FavoritesScreen() {
  const codes = useFavoritesStore((s) => s.codes);
  const reorder = useFavoritesStore((s) => s.reorder);
  const remove = useFavoritesStore((s) => s.remove);

  const stores = useMemo(
    () =>
      codes
        .map((c) => getStoreByCode(c))
        .filter((x): x is Store => !!x),
    [codes],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="관심 매장"
        subtitle={stores.length > 0 ? `총 ${stores.length}개 · ☰ 드래그로 순서 변경` : undefined}
      />

      {stores.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🤍</Text>
          <Text style={styles.emptyTitle}>관심 매장이 없어요</Text>
          <Text style={styles.emptyDesc}>매장 상세에서 "관심 매장 등록" 을 눌러 보세요.</Text>
          <Button
            label="매장 찾으러 가기"
            onPress={() => router.push('/(tabs)/search')}
            style={{ marginTop: 16, paddingHorizontal: 24 }}
          />
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DraggableFlatList
            data={stores}
            keyExtractor={(s) => s.code ?? String(s.id)}
            onDragEnd={({ data }) => {
              reorder(data.map((s) => s.code!).filter(Boolean));
            }}
            activationDistance={5}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={(params) => (
              <FavoriteRow
                {...params}
                onRemove={(c, name) => {
                  const msg = name
                    ? `"${name}" 을(를) 관심 매장 리스트에서 삭제하시겠습니까?`
                    : '관심 매장 리스트에서 삭제하시겠습니까?';
                  if (Platform.OS === 'web') {
                    // react-native-web의 Alert는 불안정 — 브라우저 confirm 사용
                    // eslint-disable-next-line no-alert
                    if (typeof window !== 'undefined' && window.confirm(msg)) {
                      remove(c);
                    }
                    return;
                  }
                  Alert.alert('관심 매장 삭제', msg, [
                    { text: '취소', style: 'cancel' },
                    { text: '삭제', style: 'destructive', onPress: () => remove(c) },
                  ]);
                }}
              />
            )}
          />
        </GestureHandlerRootView>
      )}
    </SafeAreaView>
  );
}

function FavoriteRow({
  item: s,
  drag,
  isActive,
  onRemove,
}: RenderItemParams<Store> & { onRemove: (code: string, name?: string) => void }) {
  const bColor = s.building ? BuildingColors[s.building] : BuildingColors.B;
  const floorLabel = s.floor ? FLOOR_LABEL[s.floor] : '';
  const location = `${s.building}동 ${floorLabel}${s.unit ? ` ${s.unit}호` : ''}`;

  return (
    <View style={[styles.band, isActive && styles.bandActive]}>
      <View style={[styles.colorStrip, { backgroundColor: bColor.primary }]} />

      <Pressable
        style={styles.bandContent}
        onPress={() => s.code && router.push({ pathname: '/store/[code]', params: { code: s.code } })}
      >
        <Text style={styles.bandName} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.bandLocation} numberOfLines={1}>{location}</Text>
      </Pressable>

      {/* 삭제 버튼 (X) */}
      <Pressable
        onPress={() => s.code && onRemove(s.code, s.name)}
        hitSlop={6}
        style={styles.deleteBtn}
        accessibilityLabel="관심 매장에서 제거"
      >
        <Text style={styles.deleteBtnText}>✕</Text>
      </Pressable>

      {/* 드래그 핸들 (☰) — onPressIn으로 드래그 시작 */}
      <Pressable
        onPressIn={drag}
        delayLongPress={0}
        hitSlop={4}
        style={styles.dragHandle}
        accessibilityLabel="순서 변경"
      >
        <View style={styles.dragLine} />
        <View style={styles.dragLine} />
        <View style={styles.dragLine} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  band: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 58,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  bandActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F6FF',
  },
  colorStrip: { width: 5 },
  bandContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 2,
  },
  bandName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  bandLocation: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  deleteBtn: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.divider,
  },
  deleteBtnText: { fontSize: 16, color: Colors.textMuted, fontWeight: '700' },

  dragHandle: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderLeftWidth: 1,
    borderLeftColor: Colors.divider,
    // @ts-ignore — web only
    cursor: 'grab',
  },
  dragLine: {
    width: 20,
    height: 2,
    backgroundColor: Colors.textMuted,
    borderRadius: 1,
  },
});
