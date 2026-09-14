import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus, Trash2, X } from 'lucide-react-native';
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
import { BusinessHourEntry, DayOfWeek, PartsCategory, PaymentMethod, ShopPhoto } from '@/types';

const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};
const DAY_ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_SCHEDULE: BusinessHourEntry[] = DAY_ORDER.map((d) => ({
  day: d,
  enabled: d !== 'sun',
  start: '09:00',
  end: '18:00',
}));
import { PAYMENT_METHODS } from '@/lib/paymentMethods';
import {
  MAX_SHOP_PHOTOS,
  deleteShopPhoto,
  uploadShopPhoto,
} from '@/lib/shopPhotos';
import { showConfirmAlert } from '@/utils/alerts';
import {
  PARTS_CATEGORY_LABEL,
  PARTS_CATEGORY_ORDER,
} from '@/constants/partsCategories';
import { generateShortId } from '@/utils/shortId';

type SearchMode = 'unit' | 'name';

export default function MyShopEditScreen() {
  const params = useLocalSearchParams<{ id?: string; new?: string }>();
  const shopId = typeof params.id === 'string' ? params.id : undefined;
  const isEdit = !!shopId;
  const isNewMode = params.new === '1';

  const user = useAuthStore((s) => s.user);
  const isMerchant = user?.role === 'merchant' && user?.status === 'active';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [storeCodes, setStoreCodes] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<PartsCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [photos, setPhotos] = useState<ShopPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [schedule, setSchedule] = useState<BusinessHourEntry[]>(DEFAULT_SCHEDULE);

  const toggleCategory = (c: PartsCategory) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  // 검색 모드 (Phase 1만 사용)
  const [searchMode, setSearchMode] = useState<SearchMode>('unit');
  const [searchQuery, setSearchQuery] = useState('');

  // ?new=1 로 진입했고 storeCodes 가 비어있으면 자동으로 5자리 코드 부여
  useEffect(() => {
    if (isNewMode && !isEdit && storeCodes.length === 0) {
      setStoreCodes([generateShortId()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewMode, isEdit]);

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
        setCategories(shop.categories ?? []);
        setPaymentMethods(shop.paymentMethods ?? []);
        setPhotos(shop.photos ?? []);
        if (shop.businessHoursSchedule && shop.businessHoursSchedule.length > 0) {
          // 누락된 요일은 기본 비활성으로 보충
          const map = new Map(shop.businessHoursSchedule.map((e) => [e.day, e]));
          setSchedule(DAY_ORDER.map((d) => map.get(d) ?? { day: d, enabled: false, start: '09:00', end: '18:00' }));
        }
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

  const onAddPhoto = async () => {
    if (!shopId) {
      showInfoAlert('매장 저장 필요', '먼저 매장을 등록하고 다시 들어와서 사진을 올려 주세요.');
      return;
    }
    if (photos.length >= MAX_SHOP_PHOTOS) {
      showInfoAlert('업로드 한도', `매장당 최대 ${MAX_SHOP_PHOTOS}장까지 업로드 가능합니다.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showInfoAlert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setPhotoBusy(true);
    try {
      const p = await uploadShopPhoto(shopId, uri);
      setPhotos((prev) => [...prev, p]);
    } catch (e: any) {
      showInfoAlert('업로드 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = (p: ShopPhoto) => {
    if (!shopId) return;
    showConfirmAlert(
      '사진 삭제',
      '이 사진을 매장 갤러리에서 제거할까요?',
      async () => {
        setPhotoBusy(true);
        try {
          await deleteShopPhoto(shopId, p);
          setPhotos((prev) => prev.filter((x) => x.storagePath !== p.storagePath));
        } catch (e: any) {
          showInfoAlert('삭제 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setPhotoBusy(false);
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
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
          businessHoursSchedule: schedule,
          description: description.trim(),
          categories,
          paymentMethods,
        });
      } else {
        await createShop({
          ownerUid: user.id,
          storeCodes,
          displayName: displayName.trim(),
          phone: phone.trim(),
          businessHours: hours.trim(),
          businessHoursSchedule: schedule,
          description: description.trim(),
          categories,
          paymentMethods,
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={isEdit ? '매장 편집' : '내 매장 매칭'} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={isEdit ? '매장 편집' : '내 매장 매칭'} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const matchedFirst = storeCodes.length > 0 ? getStoreByCode(storeCodes[0]) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

              {/* 디렉터리에 없는 매장 — 신규 등록 진입 */}
              <View style={styles.newRegisterWrap}>
                <Text style={styles.newRegisterHint}>
                  찾는 매장이 디렉터리에 없으신가요?
                </Text>
                <Pressable
                  style={styles.newRegisterBtn}
                  onPress={() => {
                    setStoreCodes([generateShortId()]);
                    setSearchQuery('');
                  }}
                >
                  <Plus size={16} color={Colors.primary} strokeWidth={2.4} />
                  <Text style={styles.newRegisterBtnText}>신규 매장 등록</Text>
                </Pressable>
                <Text style={styles.newRegisterDetail}>
                  매장 정보(상호·전화·소개 등)를 직접 입력해 등록할 수 있습니다.
                  운영자 검수 후 디렉터리에 반영될 수 있습니다.
                </Text>
              </View>
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
                        <X size={14} color={Colors.textMuted} strokeWidth={2.5} />
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
                      <View style={styles.resultAddRow}>
                        <Plus size={14} color={Colors.primary} strokeWidth={2.5} />
                        <Text style={styles.resultAdd}>추가</Text>
                      </View>
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
              <Text style={styles.sectionLabel}>영업시간</Text>
              <Text style={styles.sectionHint}>
                요일별로 영업 여부 체크 + 시작/종료 시각을 입력하세요. 미체크 요일은 휴무로 표시됩니다.
              </Text>
              <View style={styles.scheduleWrap}>
                {schedule.map((entry, idx) => (
                  <View key={entry.day} style={styles.scheduleRow}>
                    <Pressable
                      onPress={() =>
                        setSchedule((prev) =>
                          prev.map((e, i) =>
                            i === idx ? { ...e, enabled: !e.enabled } : e,
                          ),
                        )
                      }
                      style={[
                        styles.scheduleDayBtn,
                        entry.enabled && styles.scheduleDayBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scheduleDayText,
                          entry.enabled && styles.scheduleDayTextActive,
                        ]}
                      >
                        {DAY_LABELS[entry.day]}
                      </Text>
                    </Pressable>
                    <RNTextInput
                      value={entry.start ?? ''}
                      onChangeText={(v) =>
                        setSchedule((prev) =>
                          prev.map((e, i) => (i === idx ? { ...e, start: v } : e)),
                        )
                      }
                      placeholder="09:00"
                      placeholderTextColor={Colors.textMuted}
                      editable={entry.enabled}
                      style={[styles.scheduleInput, !entry.enabled && styles.scheduleInputDisabled]}
                      maxLength={5}
                    />
                    <Text style={styles.scheduleSep}>~</Text>
                    <RNTextInput
                      value={entry.end ?? ''}
                      onChangeText={(v) =>
                        setSchedule((prev) =>
                          prev.map((e, i) => (i === idx ? { ...e, end: v } : e)),
                        )
                      }
                      placeholder="18:00"
                      placeholderTextColor={Colors.textMuted}
                      editable={entry.enabled}
                      style={[styles.scheduleInput, !entry.enabled && styles.scheduleInputDisabled]}
                      maxLength={5}
                    />
                    {!entry.enabled && <Text style={styles.scheduleClosed}>휴무</Text>}
                  </View>
                ))}
              </View>
              <View style={{ marginBottom: 14 }}>
                <View style={styles.descLabelRow}>
                  <Text style={styles.descLabel}>매장 소개 / 취급 품목</Text>
                  <Pressable
                    onPress={() => Keyboard.dismiss()}
                    hitSlop={10}
                    style={styles.descDoneBtn}
                  >
                    <Text style={styles.descDoneText}>완료</Text>
                  </Pressable>
                </View>
                <RNTextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="우리 매장은… 어떤 원단을 취급하고… 어떤 부자재를…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={styles.descInput}
                />
              </View>

              <View style={{ height: 8 }} />
              <Text style={styles.sectionLabel}>취급 카테고리</Text>
              <Text style={styles.sectionHint}>
                선택한 카테고리의 부자재 찾기 요청만 "내 분야" 필터로 받아볼 수 있습니다. (복수 선택)
              </Text>
              <View style={styles.categoryGrid}>
                {PARTS_CATEGORY_ORDER.map((c) => {
                  const active = categories.includes(c);
                  return (
                    <Pressable
                      key={c}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => toggleCategory(c)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {PARTS_CATEGORY_LABEL[c]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ height: 16 }} />
              <Text style={styles.sectionLabel}>결제 수단</Text>
              <Text style={styles.sectionHint}>
                받는 결제 수단을 모두 선택하세요. 매장 상세에 배지로 노출됩니다.
              </Text>
              <View style={styles.categoryGrid}>
                {PAYMENT_METHODS.map((p) => {
                  const active = paymentMethods.includes(p.key);
                  return (
                    <Pressable
                      key={p.key}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() =>
                        setPaymentMethods((prev) =>
                          prev.includes(p.key)
                            ? prev.filter((x) => x !== p.key)
                            : [...prev, p.key],
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {p.emoji} {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ height: 16 }} />
              <Text style={styles.sectionLabel}>매장 사진</Text>
              <Text style={styles.sectionHint}>
                매장 / 상품 / 스와치 사진을 올려 매장 상세에 노출하세요. 최대 {MAX_SHOP_PHOTOS}장.
                {!isEdit ? ' (매장 등록 후 다시 들어오면 업로드 가능)' : ''}
              </Text>
              <View style={styles.photoGrid}>
                {photos.map((p) => (
                  <View key={p.storagePath} style={styles.photoCell}>
                    <Image source={{ uri: p.url }} style={styles.photoImg} />
                    <Pressable
                      style={styles.photoRemove}
                      onPress={() => onRemovePhoto(p)}
                      hitSlop={6}
                      disabled={photoBusy}
                    >
                      <Trash2 size={14} color="#fff" strokeWidth={2.4} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_SHOP_PHOTOS && (
                  <Pressable
                    style={[styles.photoCell, styles.photoAdd]}
                    onPress={onAddPhoto}
                    disabled={photoBusy}
                  >
                    {photoBusy ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <View style={styles.photoAddInner}>
                        <Camera size={22} color={Colors.primary} strokeWidth={2} />
                        <Text style={styles.photoAddText}>사진 추가</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </View>

              <View style={{ height: 16 }} />
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
  resultAddRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultAdd: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  noResult: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: {
    width: '31.5%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  categoryChipTextActive: { color: '#fff' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoCell: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAdd: {
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAddInner: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  photoAddText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  newRegisterWrap: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#F0F4FB',
    gap: 8,
    alignItems: 'center',
  },
  newRegisterHint: { fontSize: 12, color: Colors.textMuted },
  newRegisterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  newRegisterBtnText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  newRegisterDetail: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  scheduleWrap: { gap: 6, marginTop: 4, marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleDayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleDayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  scheduleDayText: { fontSize: 13, fontWeight: '800', color: Colors.textMuted },
  scheduleDayTextActive: { color: '#fff' },
  scheduleInput: {
    width: 76,
    height: 42,
    paddingHorizontal: 10,
    paddingVertical: 0,
    lineHeight: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  scheduleInputDisabled: { backgroundColor: Colors.divider, color: Colors.textMuted },
  scheduleSep: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
  scheduleClosed: { fontSize: 11, color: Colors.danger, fontWeight: '800', marginLeft: 'auto' },

  descLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  descLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  descDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  descDoneText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  descInput: {
    minHeight: 110,
    maxHeight: 240,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
});
