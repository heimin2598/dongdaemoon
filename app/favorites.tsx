import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Heart, QrCode, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { QrScanner } from '@/components/common/QrScanner';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { getStoreByCode } from '@/data/stores';
import { Store } from '@/data/stores/types';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { getShopByStoreCode } from '@/lib/shops';
import { decodeQr } from '@/lib/qrPayload';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';

export default function FavoritesScreen() {
  const codes = useFavoritesStore((s) => s.codes);
  const reorder = useFavoritesStore((s) => s.reorder);
  const remove = useFavoritesStore((s) => s.remove);

  // 디렉터리에 없는 신규 매장(5자리 코드) 은 shops 컬렉션에서 조회해 합치기
  const [shopFallbacks, setShopFallbacks] = useState<Record<string, Store>>({});
  useEffect(() => {
    const missing = codes.filter((c) => !getStoreByCode(c) && !shopFallbacks[c]);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(
      missing.map(async (c) => {
        try {
          const shop = await getShopByStoreCode(c);
          if (!shop) return null;
          const fb: Store = {
            id: -1,
            code: c,
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
          };
          return [c, fb] as const;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (!alive) return;
      const next: Record<string, Store> = {};
      for (const r of rows) if (r) next[r[0]] = r[1];
      if (Object.keys(next).length > 0) {
        setShopFallbacks((prev) => ({ ...prev, ...next }));
      }
    });
    return () => {
      alive = false;
    };
  }, [codes, shopFallbacks]);

  const stores = useMemo(
    () =>
      codes
        .map((c) => getStoreByCode(c) ?? shopFallbacks[c])
        .filter((x): x is Store => !!x),
    [codes, shopFallbacks],
  );

  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = (raw: string) => {
    setScannerOpen(false);
    const payload = decodeQr(raw);
    if (!payload) {
      showInfoAlert('인식 실패', '셰르파 QR 형식이 아닙니다.');
      return;
    }
    if (payload.t !== 's') {
      showInfoAlert('매장 QR 아님', '매장 QR 만 스캔할 수 있습니다.');
      return;
    }
    const code = payload.c;
    if (!code) {
      showInfoAlert('매장 정보 부족', '매장 코드가 포함되어 있지 않습니다.');
      return;
    }
    router.push(`/store/${encodeURIComponent(code)}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="관심 매장"
        subtitle={stores.length > 0 ? `총 ${stores.length}개 · ☰ 드래그로 순서 변경` : undefined}
      />

      {stores.length === 0 ? (
        <View style={styles.empty}>
          <Heart size={64} color={Colors.divider} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>관심 매장이 없어요</Text>
          <Text style={styles.emptyDesc}>매장 상세에서 "관심 매장 등록" 을 눌러 보세요.</Text>
          <Button
            label="매장 찾으러 가기"
            onPress={() => router.push('/(tabs)/search')}
            style={{ marginTop: 16, paddingHorizontal: 24 }}
          />
          <Button
            label="매장 QR 스캔하기"
            variant="secondary"
            onPress={() => setScannerOpen(true)}
            style={{ marginTop: 10, paddingHorizontal: 24 }}
          />
        </View>
      ) : (
        <>
          <View style={styles.toolbar}>
            <Pressable style={styles.toolbarBtn} onPress={() => setScannerOpen(true)}>
              <QrCode size={16} color={Colors.primary} strokeWidth={2.4} />
              <Text style={styles.toolbarBtnText}>매장 QR 스캔하기</Text>
            </Pressable>
          </View>
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
                    showConfirmAlert('관심 매장 삭제', msg, () => remove(c), {
                      confirmLabel: '삭제',
                      destructive: true,
                    });
                  }}
                />
              )}
            />
          </GestureHandlerRootView>
        </>
      )}

      <QrScanner
        visible={scannerOpen}
        onScan={handleScan}
        onClose={() => setScannerOpen(false)}
      />
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
  const location = s.building
    ? `${s.building}동 ${floorLabel}${s.unit ? ` ${s.unit}호` : ''}`
    : '신규 등록 매장';

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
        <X size={18} color={Colors.textMuted} strokeWidth={2.5} />
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

  toolbar: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end' },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  toolbarBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },

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
