import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { subscribeMyShops, deleteShop } from '@/lib/shops';
import { getStoreByCode } from '@/data/stores';
import { showInfoAlert } from '@/utils/alerts';
import { Shop } from '@/types';
import { Platform, Alert } from 'react-native';

export default function MyShopsScreen() {
  const user = useAuthStore((s) => s.user);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isMerchant = user?.role === 'merchant' && user?.status === 'active';

  useEffect(() => {
    if (!isMerchant || !user?.id) {
      setLoading(false);
      return;
    }
    const unsub = subscribeMyShops(user.id, (list) => {
      setShops(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isMerchant, user?.id]);

  // 어드민/방문자 차단
  useEffect(() => {
    if (user && !isMerchant) {
      showInfoAlert('접근 권한 없음', '매장 사장님 전용 페이지입니다.', () => router.back());
    }
  }, [user, isMerchant]);

  const confirmDelete = (shop: Shop) => {
    const title = '매장 삭제';
    const msg = `"${shop.displayName || '이름 없음'}" 매장 정보를 삭제할까요?\n방문자에게 노출되던 사장님 등록 정보가 사라집니다.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${msg}`)) {
        doDelete(shop);
      }
    } else {
      Alert.alert(title, msg, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => doDelete(shop) },
      ]);
    }
  };

  const doDelete = async (shop: Shop) => {
    setBusyId(shop.id);
    try {
      await deleteShop(shop.id);
    } catch (e: any) {
      showInfoAlert('삭제 실패', e?.message ?? '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isMerchant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="내 매장 관리" />
        <View style={styles.center}><Text style={styles.muted}>접근 권한이 없습니다.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="내 매장 관리" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerNote}>
          동대문 종합시장 디렉터리에서 본인 매장을 찾아 매칭하면, 방문자가 매장 정보를 볼 때
          사장님이 직접 입력한 최신 전화번호·영업시간·소개가 노출됩니다.
          {'\n\n'}• 한 사장님이 여러 매장을 매칭 등록할 수 있습니다.
          {'\n'}• 한 매장이 여러 호수를 함께 사용하는 경우, 매칭 후 "호수 검색 추가"로 호수를 더해 주세요.
        </Text>

        <Button
          label="+ 내 매장 검색해서 매칭하기"
          onPress={() => router.push('/my-shop-edit')}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : shops.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏬</Text>
            <Text style={styles.emptyTitle}>아직 매칭된 매장이 없습니다</Text>
            <Text style={styles.emptyDesc}>
              위의 "내 매장 검색해서 매칭하기" 버튼을 눌러
              {'\n'}동대문 종합시장 디렉터리에서 본인 매장을 찾아 매칭해 주세요.
            </Text>
          </View>
        ) : (
          shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              busy={busyId === shop.id}
              onEdit={() => router.push({ pathname: '/my-shop-edit', params: { id: shop.id } })}
              onDelete={() => confirmDelete(shop)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShopCard({
  shop,
  busy,
  onEdit,
  onDelete,
}: {
  shop: Shop;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName} numberOfLines={2}>
          {shop.displayName || '(매장 이름 없음)'}
        </Text>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✓ 인증</Text>
        </View>
      </View>

      {/* 호수 리스트 */}
      <View style={styles.codesWrap}>
        {shop.storeCodes.map((code) => {
          const s = getStoreByCode(code);
          return (
            <View key={code} style={styles.codeChip}>
              <Text style={styles.codeChipText}>
                {s ? `${s.building}동 ${s.floor} ${s.unit}호` : code}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 메타 */}
      {(shop.phone || shop.businessHours) && (
        <View style={styles.metaWrap}>
          {shop.phone && (
            <Text style={styles.metaLine}>📞 {shop.phone}</Text>
          )}
          {shop.businessHours && (
            <Text style={styles.metaLine}>⏰ {shop.businessHours}</Text>
          )}
        </View>
      )}

      {shop.description && (
        <Text style={styles.descLine} numberOfLines={2}>{shop.description}</Text>
      )}

      <View style={styles.actions}>
        <Button label="편집" variant="secondary" onPress={onEdit} loading={busy} style={{ flex: 1 }} />
        <Button label="삭제" variant="danger" onPress={onDelete} loading={busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  headerNote: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: Colors.textMuted, fontSize: 13 },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  verifiedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#E0F2E9' },
  verifiedText: { fontSize: 11, fontWeight: '800', color: '#1B7A3E' },
  codesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  codeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.divider,
  },
  codeChipText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  metaWrap: { gap: 4 },
  metaLine: { fontSize: 13, color: Colors.text },
  descLine: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
