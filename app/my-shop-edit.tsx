import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import {
  createShop,
  getShop,
  getShopByStoreCode,
  updateShop,
} from '@/lib/shops';
import { getStoreByCode, searchStores } from '@/data/stores';
import { showInfoAlert } from '@/utils/alerts';
import { Store } from '@/data/stores/types';

type SearchMode = 'unit' | 'name';

export default function MyShopEditScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const shopId = typeof params.id === 'string' ? params.id : undefined;
  const isEdit = !!shopId;

  const user = useAuthStore((s) => s.user);
  const isMerchant = user?.role === 'merchant' && user?.status === 'active';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [storeCodes, setStoreCodes] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  // 검색 모드 (Phase 1만 사용)
  const [searchMode, setSearchMode] = useState<SearchMode>('unit');
  const [searchQuery, setSearchQuery] = useState('');

  // Phase 2: 추가 호수 검색 (호수만)
  const [addUnitQuery, setAddUnitQuery] = useState('');

  useEffect(() => {
    if (user && !isMerchant) {
      showInfoAlert('접근 권한 없음', '매장 사장님 전용 페이지입니다.', () => router.back());
    }
  }, [user, isMerchant]);

  useEffect(() => {
    if (!isEdit || !shopId) return;
    let alive = true;
    (async () => {
      try {
        const shop = await getShop(shopId);
        if (!alive || !shop) return;
        if (shop.ownerUid !== user?.id) {
          showInfoAlert('접근 권한 없음', '본인이 등록한 매장만 수정할 수 있습니다.', () => router.back());
          return;
        }
        setStoreCodes(shop.storeCodes);
        setDisplayName(shop.displayName);
        setPhone(shop.phone);
        setHours(shop.businessHours);
        setDescription(shop.description);
      } catch (e: any) {
        showInfoAlert('불러오기 실패', e?.message ?? '잠시 후 다시 시도해 주세요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, shopId, user?.id]);

  const phase1Results = useMemo<Store[]>(() => {
    const q = searchQuery.trim();
    if (q.length < 1) return [];
    const all = searchStores(q, 50);
    if (searchMode === 'unit') {
      const digits = q.replace(/\D/g, '');
      if (!digits) return [];
      return all
        .filter((s) => s.code && s.unit && String(s.unit).includes(digits))
        .slice(0, 12);
    }
    // 상호명 검색 — 상호명에 포함된 결과만
    const lq = q.toLowerCase();
    return all
      .filter((s) => s.code && (s.name || '').toLowerCase().includes(lq))
      .slice(0, 12);
  }, [searchQuery, searchMode]);

  const phase2Results = useMemo<Store[]>(() => {
    const q = addUnitQuery.trim();
    if (q.length < 1) return [];
    const digits = q.replace(/\D/g, '');
    if (!digits) return [];
    return searchStores(q, 50)
      .filter(
        (s) =>
          s.code && s.unit && String(s.unit).includes(digits) && !storeCodes.includes(s.code),
      )
      .slice(0, 10);
  }, [addUnitQuery, storeCodes]);

  // 첫 매칭 — 정적 매장 데이터에서 displayName/phone을 자동 채움
  const onFirstMatch = async (s: Store) => {
    if (!s.code) return;
    const conflict = await checkConflict(s.code);
    if (conflict) return;
    setStoreCodes([s.code]);
    setDisplayName(s.name || '');
    setPhone(s.phone || '');
    setSearchQuery('');
  };

  // 추가 호수 — 정보는 그대로
  const onAddMoreCode = async (s: Store) => {
    if (!s.code) return;
    const conflict = await checkConflict(s.code);
    if (conflict) return;
    setStoreCodes((prev) => (prev.includes(s.code!) ? prev : [...prev, s.code!]));
    setAddUnitQuery('');
  };

  const checkConflict = async (code: string): Promise<boolean> => {
    try {
      const existing = await getShopByStoreCode(code);
      if (existing && existing.id !== shopId) {
        showInfoAlert(
          '이미 등록된 호수',
          existing.ownerUid === user?.id
            ? '본인의 다른 매장에 이미 등록된 호수입니다.\n그 매장을 먼저 편집/삭제하세요.'
            : '다른 사장님이 이미 등록한 호수입니다.\n잘못된 등록인 경우 관리자에 문의해 주세요.',
        );
        return true;
      }
    } catch {
      // 권한/네트워크 오류는 통과
    }
    return false;
  };

  const onRemoveCode = (code: string) => {
    setStoreCodes((prev) => prev.filter((c) => c !== code));
  };

  const onSave = async () => {
    if (storeCodes.length === 0) {
      showInfoAlert('매장 매칭 필요', '먼저 본인 매장을 검색해서 매칭해 주세요.');
      return;
    }
    if (!displayName.trim()) {
      showInfoAlert('매장명 필요', '매장 이름을 입력해 주세요.');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      if (isEdit && shopId) {
        await updateShop(shopId, {
          storeCodes,
          displayName: displayName.trim(),
          phone: phone.trim(),
          businessHours: hours.trim(),
          description: description.trim(),
        });
      } else {
        await createShop({
          ownerUid: user.id,
          storeCodes,
          displayName: displayName.trim(),
          phone: phone.trim(),
          businessHours: hours.trim(),
          description: description.trim(),
        });
      }
      router.back();
    } catch (e: any) {
      showInfoAlert('저장 실패', e?.message ?? '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (!isMerchant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={isEdit ? '매장 편집' : '내 매장 매칭'} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={isEdit ? '매장 편집' : '내 매장 매칭'} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const matchedFirst = storeCodes.length > 0 ? getStoreByCode(storeCodes[0]) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={isEdit ? '매장 편집' : '내 매장 매칭'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ─────────────────────────────────────────────
              Phase 1: 첫 매칭 — storeCodes 비어있을 때만 노출
              ───────────────────────────────────────────── */}
          {storeCodes.length === 0 && (
            <>
              <Text style={styles.sectionLabel}>내 매장 찾기</Text>
              <Text style={styles.sectionHint}>
                동대문 종합시장의 점포 디렉터리에서 본인 매장을 찾아 매칭하세요.
                매칭 후 매장 정보(전화·영업시간·소개)를 편집할 수 있습니다.
              </Text>

              {/* 검색 모드 선택 */}
              <View style={styles.toggleRow}>
                <ToggleBtn
                  label="호수로 검색"
                  active={searchMode === 'unit'}
                  onPress={() => {
                    setSearchMode('unit');
                    setSearchQuery('');
                  }}
                />
                <ToggleBtn
                  label="상호명으로 검색"
                  active={searchMode === 'name'}
                  onPress={() => {
                    setSearchMode('name');
                    setSearchQuery('');
                  }}
                />
              </View>

              <TextInput
                label={searchMode === 'unit' ? '호수 번호' : '상호명'}
                placeholder={searchMode === 'unit' ? '예: 215, 3156' : '예: 헤이민레이스'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                keyboardType={searchMode === 'unit' ? 'number-pad' : 'default'}
              />

              {phase1Results.length > 0 ? (
                <View style={styles.resultsBox}>
                  {phase1Results.map((s) => (
                    <Pressable
                      key={s.code ?? String(s.id)}
                      style={styles.resultRow}
                      onPress={() => onFirstMatch(s)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {s.building}동 · {s.floor} · {s.unit}호
                          {s.subCategory ? ` · ${s.subCategory}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.resultAdd}>매칭</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                searchQuery.trim().length > 0 && (
                  <Text style={styles.noResult}>검색 결과가 없습니다.</Text>
                )
              )}
            </>
          )}

          {/* ─────────────────────────────────────────────
              Phase 2: 매칭 후 — 추가 호수 + 정보 수정
              ───────────────────────────────────────────── */}
          {storeCodes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                매칭된 호수 {storeCodes.length > 1 && `(${storeCodes.length}개)`}
              </Text>
              <Text style={styles.sectionHint}>
                같은 매장이 여러 호수를 사용하시면 아래에서 호수를 추가하세요.
              </Text>

              <View style={styles.codeListWrap}>
                {storeCodes.map((code, idx) => {
                  const s = getStoreByCode(code);
                  return (
                    <View key={code} style={styles.codeChip}>
                      <Text style={styles.codeChipText}>
                        {s ? `${s.building}동 ${s.floor} ${s.unit}호` : code}
                        {idx === 0 ? ' · 대표' : ''}
                      </Text>
                      <Pressable onPress={() => onRemoveCode(code)} hitSlop={8}>
                        <Text style={styles.codeChipRemove}>×</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* 호수 추가 */}
              <TextInput
                label="호수 검색 추가"
                placeholder={
                  matchedFirst?.name
                    ? `예: ${matchedFirst.unit}호 외에 217호도 사용 중이라면 217 입력`
                    : '예: 217'
                }
                value={addUnitQuery}
                onChangeText={setAddUnitQuery}
                keyboardType="number-pad"
              />
              {phase2Results.length > 0 && (
                <View style={styles.resultsBox}>
                  {phase2Results.map((s) => (
                    <Pressable
                      key={s.code ?? String(s.id)}
                      style={styles.resultRow}
                      onPress={() => onAddMoreCode(s)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {s.building}동 · {s.floor} · {s.unit}호
                        </Text>
                      </View>
                      <Text style={styles.resultAdd}>+ 추가</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={{ height: 16 }} />

              <Text style={styles.sectionLabel}>매장 정보</Text>
              <Text style={styles.sectionHint}>
                방문자에게 노출되는 정보입니다. 매칭 시 자동으로 채워진 항목도 자유롭게 수정 가능.
              </Text>

              <TextInput
                label="매장명 *"
                placeholder="방문자에게 표시될 매장 이름"
                value={displayName}
                onChangeText={setDisplayName}
              />
              <TextInput
                label="전화번호"
                placeholder="02-1234-5678 또는 010-..."
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <TextInput
                label="영업시간"
                placeholder="예: 월-토 09:00-18:00 / 일요일 휴무"
                value={hours}
                onChangeText={setHours}
              />
              <TextInput
                label="매장 소개 / 취급 품목"
                placeholder="우리 매장은… 어떤 원단을 취급하고… 어떤 부자재를…"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />

              <View style={{ height: 8 }} />
              <Button label={isEdit ? '저장' : '등록'} onPress={onSave} loading={saving} />
            </>
          )}

          <View style={{ height: 8 }} />
          <Button
            label="취소"
            variant="secondary"
            onPress={() => router.back()}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToggleBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleBtn,
        active && styles.toggleBtnActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 8, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 12, lineHeight: 17 },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  toggleLabelActive: { color: '#fff' },

  codeListWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  codeChipText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  codeChipRemove: { fontSize: 16, color: '#fff', fontWeight: '900', lineHeight: 16 },

  resultsBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 8,
  },
  resultName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  resultMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  resultAdd: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  noResult: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },
});
