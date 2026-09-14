import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, ImageOff, Plus, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import {
  BANNER_KIND_LABEL,
  BannerKind,
  HomeBanner,
  deleteBanner,
  isBannerLive,
  subscribeAllBanners,
  updateBanner,
} from '@/lib/homeBanners';
import {
  BannerDisplayMode,
  setBannerDisplayMode,
  subscribeBannerSettings,
} from '@/lib/bannerSettings';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';

type FilterMode = 'live' | 'hidden';

export default function AdminBannersScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: BannerKind = params.kind === 'search' ? 'search' : 'home';
  const kindLabel = BANNER_KIND_LABEL[kind];

  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  const [list, setList] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('live');
  const [displayMode, setDisplayMode] = useState<BannerDisplayMode>('fixed');

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAllBanners(kind, (items) => {
      setList(items);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin, kind]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeBannerSettings(kind, (s) => setDisplayMode(s.displayMode));
    return () => unsub();
  }, [isAdmin, kind]);

  const onToggleDisplayMode = async (next: BannerDisplayMode) => {
    if (next === displayMode) return;
    try {
      await setBannerDisplayMode(kind, next);
    } catch (e) {
      showInfoAlert('변경 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'live') return list.filter((b) => isBannerLive(b));
    return list.filter((b) => !isBannerLive(b));
  }, [list, filter]);

  const onMove = async (banner: HomeBanner, dir: -1 | 1) => {
    // 같은 필터 안에서 순서 교환
    const idx = filtered.findIndex((b) => b.id === banner.id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= filtered.length) return;
    const target = filtered[targetIdx];
    try {
      await Promise.all([
        updateBanner(kind, banner.id, { order: target.order }),
        updateBanner(kind, target.id, { order: banner.order }),
      ]);
    } catch (e) {
      showInfoAlert('순서 변경 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = (banner: HomeBanner) => {
    showConfirmAlert(
      '배너 삭제',
      `"${banner.mainCopy || '(제목 없음)'}" 배너를 삭제할까요?`,
      async () => {
        try {
          await deleteBanner(kind, banner.id, banner.imageStoragePath);
        } catch (e) {
          showInfoAlert('삭제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={`${kindLabel} 관리`} />
        <View style={styles.center}>
          <Text style={styles.deny}>운영자 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={`${kindLabel} 관리`}
        rightSlot={
          <Pressable
            hitSlop={10}
            onPress={() =>
              router.push({ pathname: '/admin-banner-edit', params: { kind } })
            }
          >
            <Text style={styles.addText}>+ 추가</Text>
          </Pressable>
        }
      />

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterBtn, filter === 'live' && styles.filterBtnActive]}
          onPress={() => setFilter('live')}
        >
          <Text style={[styles.filterText, filter === 'live' && styles.filterTextActive]}>
            노출중
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, filter === 'hidden' && styles.filterBtnActive]}
          onPress={() => setFilter('hidden')}
        >
          <Text style={[styles.filterText, filter === 'hidden' && styles.filterTextActive]}>
            미노출중
          </Text>
        </Pressable>
      </View>

      {/* 노출 순서 모드 — 사용자가 보는 순서를 결정 */}
      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>노출 순서</Text>
        <View style={styles.modeBtnGroup}>
          <Pressable
            style={[styles.modeBtn, displayMode === 'fixed' && styles.modeBtnActive]}
            onPress={() => onToggleDisplayMode('fixed')}
          >
            <Text
              style={[
                styles.modeBtnText,
                displayMode === 'fixed' && styles.modeBtnTextActive,
              ]}
            >
              고정 순서
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, displayMode === 'random' && styles.modeBtnActive]}
            onPress={() => onToggleDisplayMode('random')}
          >
            <Text
              style={[
                styles.modeBtnText,
                displayMode === 'random' && styles.modeBtnTextActive,
              ]}
            >
              랜덤
            </Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.modeHint}>
        {displayMode === 'random'
          ? '사용자가 진입할 때마다 배너 순서가 무작위로 섞입니다.'
          : '위/아래 화살표로 정한 순서대로 노출됩니다.'}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyWrap : styles.listWrap
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {filter === 'live' ? '노출 중인 배너가 없습니다.' : '미노출 배너가 없습니다.'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <View style={styles.orderCol}>
                <Pressable
                  style={styles.orderBtn}
                  onPress={() => onMove(item, -1)}
                  disabled={index === 0}
                  hitSlop={8}
                >
                  <ChevronUp size={14} color={index === 0 ? Colors.border : Colors.textMuted} strokeWidth={2.4} />
                </Pressable>
                <View style={styles.orderDots}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <Pressable
                  style={styles.orderBtn}
                  onPress={() => onMove(item, 1)}
                  disabled={index === filtered.length - 1}
                  hitSlop={8}
                >
                  <ChevronDown
                    size={14}
                    color={index === filtered.length - 1 ? Colors.border : Colors.textMuted}
                    strokeWidth={2.4}
                  />
                </Pressable>
              </View>

              <Pressable
                style={styles.thumb}
                onPress={() =>
                  router.push({
                    pathname: '/admin-banner-edit',
                    params: { id: item.id, kind },
                  })
                }
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                ) : (
                  <View style={[styles.thumbImg, styles.thumbEmpty]}>
                    <ImageOff size={18} color={Colors.textMuted} strokeWidth={2} />
                  </View>
                )}
              </Pressable>

              <Pressable
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: '/admin-banner-edit',
                    params: { id: item.id, kind },
                  })
                }
              >
                <Text style={styles.mainCopy} numberOfLines={1}>
                  {item.mainCopy || '(제목 없음)'}
                </Text>
                <Text style={styles.subCopy} numberOfLines={1}>
                  {item.subCopy || '내용을 입력하세요'}
                </Text>
                <Text style={isBannerLive(item) ? styles.liveBadge : styles.hiddenBadge}>
                  {isBannerLive(item) ? '✓ 노출' : '○ 미노출'}
                </Text>
              </Pressable>

              <Pressable style={styles.removeBtn} onPress={() => onDelete(item)} hitSlop={8}>
                <X size={18} color={Colors.textMuted} strokeWidth={2.4} />
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            <Pressable
              style={styles.addCard}
              onPress={() =>
                router.push({ pathname: '/admin-banner-edit', params: { kind } })
              }
            >
              <Plus size={18} color="#fff" strokeWidth={2.6} />
              <Text style={styles.addCardText}>새 배너 추가</Text>
            </Pressable>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  deny: { fontSize: 14, color: Colors.textMuted },
  addText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterBtn: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  filterTextActive: { color: '#fff' },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  modeLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  modeBtnGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.surface },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  modeBtnTextActive: { color: '#fff' },
  modeHint: {
    fontSize: 11,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },

  listWrap: { padding: 16, gap: 8, paddingBottom: 32 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { fontSize: 13, color: Colors.textMuted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCol: { alignItems: 'center', justifyContent: 'space-between', height: 60 },
  orderBtn: {
    width: 22,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderDots: { gap: 2, alignItems: 'center' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.border },

  thumb: { width: 56, height: 56, borderRadius: 6, overflow: 'hidden', backgroundColor: Colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },

  mainCopy: { fontSize: 14, fontWeight: '800', color: Colors.text },
  subCopy: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  liveBadge: { fontSize: 11, color: Colors.success, fontWeight: '700', marginTop: 4 },
  hiddenBadge: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', marginTop: 4 },

  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 52,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  addCardText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
