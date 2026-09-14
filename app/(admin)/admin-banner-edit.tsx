import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showInfoAlert } from '@/utils/alerts';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Check, ChevronRight, ImagePlus } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ImageCropper } from '@/components/common/ImageCropper';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import {
  BANNER_COPY_COLORS,
  BANNER_KIND_LABEL,
  BannerKind,
  DEFAULT_MAIN_COLOR,
  DEFAULT_SUB_COLOR,
  HomeBanner,
  createBanner,
  getBanner,
  subscribeAllBanners,
  updateBanner,
  uploadBannerImage,
} from '@/lib/homeBanners';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function parseDateStartMs(s: string): number | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}

function parseDateEndMs(s: string): number | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}

function msToDateStr(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminBannerEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const kind: BannerKind = params.kind === 'search' ? 'search' : 'home';
  const kindLabel = BANNER_KIND_LABEL[kind];
  const isEdit = !!id;
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // form fields
  const [imageUri, setImageUri] = useState<string | null>(null);   // 신규 선택된 로컬 URI (크롭 후)
  const [imageUrl, setImageUrl] = useState<string | null>(null);   // 기존 storage URL
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [pendingCropUri, setPendingCropUri] = useState<string | null>(null); // 크롭 모달 입력
  const [subCopy, setSubCopy] = useState('내용을 입력하세요');
  const [mainCopy, setMainCopy] = useState('새 배너');
  const [subColor, setSubColor] = useState<string>(DEFAULT_SUB_COLOR);
  const [mainColor, setMainColor] = useState<string>(DEFAULT_MAIN_COLOR);
  const [landingUrl, setLandingUrl] = useState('');
  const [startsAtStr, setStartsAtStr] = useState('');
  const [endsAtStr, setEndsAtStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');
  const [active, setActive] = useState(true);

  const [allBanners, setAllBanners] = useState<HomeBanner[]>([]);

  // 전체 배너 한 번 받아와서 order 자동 계산용
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAllBanners(kind, setAllBanners);
    return () => unsub();
  }, [isAdmin, kind]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let alive = true;
    (async () => {
      try {
        const b = await getBanner(kind, id);
        if (!alive || !b) return;
        setSubCopy(b.subCopy);
        setMainCopy(b.mainCopy);
        setSubColor(b.subColor || DEFAULT_SUB_COLOR);
        setMainColor(b.mainColor || DEFAULT_MAIN_COLOR);
        setLandingUrl(b.landingUrl);
        setImageUrl(b.imageUrl ?? null);
        setImageStoragePath(b.imageStoragePath ?? null);
        setStartsAtStr(msToDateStr(b.startsAt));
        setEndsAtStr(msToDateStr(b.endsAt));
        setStartTimeStr(b.startTimeOfDay ?? '');
        setEndTimeStr(b.endTimeOfDay ?? '');
        setActive(b.active);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, id, kind]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      showInfoAlert('권한 필요', '사진첩 접근 권한이 필요합니다.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!r.canceled && r.assets[0]) {
      setPendingCropUri(r.assets[0].uri);
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      showInfoAlert('권한 필요', '카메라 권한이 필요합니다.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled && r.assets[0]) {
      setPendingCropUri(r.assets[0].uri);
    }
  };

  const previewImageUri = imageUri ?? imageUrl;

  const validate = (): string | null => {
    if (!subCopy.trim()) return '서브 카피를 입력하세요.';
    if (!mainCopy.trim()) return '메인 카피를 입력하세요.';
    if (startsAtStr && parseDateStartMs(startsAtStr) === null) return '시작일 형식이 올바르지 않습니다 (예: 2026-05-01).';
    if (endsAtStr && parseDateEndMs(endsAtStr) === null) return '종료일 형식이 올바르지 않습니다.';
    if (startTimeStr && !TIME_RE.test(startTimeStr)) return '시작시간 형식이 올바르지 않습니다 (예: 09:00).';
    if (endTimeStr && !TIME_RE.test(endTimeStr)) return '종료시간 형식이 올바르지 않습니다.';
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      showInfoAlert('확인 필요', err);
      return;
    }
    setSaving(true);
    try {
      const startsAt = startsAtStr ? parseDateStartMs(startsAtStr) : null;
      const endsAt = endsAtStr ? parseDateEndMs(endsAtStr) : null;
      const startTimeOfDay = startTimeStr.trim() || null;
      const endTimeOfDay = endTimeStr.trim() || null;

      let bannerId = id ?? null;
      let nextImageUrl = imageUrl ?? '';
      let nextStoragePath = imageStoragePath ?? '';

      if (!bannerId) {
        // 신규 — 우선 doc 생성 후 이미지 업로드
        const maxOrder = allBanners.reduce(
          (acc, b) => (b.order > acc ? b.order : acc),
          -1,
        );
        bannerId = await createBanner(kind, {
          subCopy: subCopy.trim(),
          mainCopy: mainCopy.trim(),
          subColor,
          mainColor,
          landingUrl: landingUrl.trim(),
          order: maxOrder + 1,
          active,
          startsAt,
          endsAt,
          startTimeOfDay,
          endTimeOfDay,
        });
      }

      if (imageUri) {
        const up = await uploadBannerImage(kind, bannerId, imageUri);
        nextImageUrl = up.url;
        nextStoragePath = up.storagePath;
      }

      await updateBanner(kind, bannerId, {
        subCopy: subCopy.trim(),
        mainCopy: mainCopy.trim(),
        subColor,
        mainColor,
        landingUrl: landingUrl.trim(),
        imageUrl: nextImageUrl,
        imageStoragePath: nextStoragePath,
        active,
        startsAt,
        endsAt,
        startTimeOfDay,
        endTimeOfDay,
      });

      router.back();
    } catch (e) {
      showInfoAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const previewBanner = useMemo(
    () => ({
      id: id ?? 'preview',
      subCopy: subCopy || '서브카피',
      mainCopy: mainCopy || '메인카피',
      subColor,
      mainColor,
      imageUrl: previewImageUri,
    }),
    [id, subCopy, mainCopy, subColor, mainColor, previewImageUri],
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={`${kindLabel} 편집`} />
        <View style={styles.center}>
          <Text style={styles.deny}>운영자 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title={`${kindLabel} 편집`} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={`${kindLabel} 편집`} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* 배너 이미지 */}
          <Text style={styles.sectionTitle}>배너 이미지</Text>
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            {previewImageUri ? (
              <Image source={{ uri: previewImageUri }} style={styles.pickedImg} />
            ) : (
              <View style={styles.imagePickerEmpty}>
                <Camera size={28} color={Colors.textMuted} strokeWidth={1.8} />
                <Text style={styles.imagePickerText}>이미지 선택</Text>
              </View>
            )}
          </Pressable>
          {previewImageUri && (
            <View style={styles.imageActions}>
              <Pressable style={styles.imageActionBtn} onPress={pickImage}>
                <ImagePlus size={16} color={Colors.primary} strokeWidth={2.2} />
                <Text style={styles.imageActionText}>사진첩</Text>
              </Pressable>
              <Pressable style={styles.imageActionBtn} onPress={pickCamera}>
                <Camera size={16} color={Colors.primary} strokeWidth={2.2} />
                <Text style={styles.imageActionText}>카메라</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.hint}>
            배너 비율은 약 2.7:1 (가로:세로) 입니다. 권장 이미지 크기:{'\n'}
            • 1080 × 400 (권장, 가장 균형){'\n'}
            • 1200 × 440 (조금 더 고해상도){'\n'}
            • 1500 × 555 (최고 해상도)
          </Text>

          {/* 서브 카피 */}
          <Text style={styles.sectionTitle}>서브 카피 (첫 줄)</Text>
          <TextInput
            value={subCopy}
            onChangeText={setSubCopy}
            placeholder="내용을 입력하세요"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.hint}>메인 카피 바로 위에 작은 글씨로 노출</Text>
          <ColorPicker label="서브 카피 색상" value={subColor} onChange={setSubColor} />

          {/* 메인 카피 */}
          <Text style={styles.sectionTitle}>메인 카피 (두 번째 줄)</Text>
          <TextInput
            value={mainCopy}
            onChangeText={setMainCopy}
            placeholder="새 배너"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.hint}>큰 굵은 글씨로 노출되는 핵심 메시지 (1~2줄 권장)</Text>
          <ColorPicker label="메인 카피 색상" value={mainColor} onChange={setMainColor} />

          {/* 랜딩 URL */}
          <Text style={styles.sectionTitle}>랜딩 URL</Text>
          <TextInput
            value={landingUrl}
            onChangeText={setLandingUrl}
            placeholder="https:// ... 배너 클릭 시 이동할 페이지"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />

          {/* 노출 일정 */}
          <Text style={styles.sectionTitle}>노출 일정</Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>시작일 (YYYY-MM-DD)</Text>
              <TextInput
                value={startsAtStr}
                onChangeText={setStartsAtStr}
                placeholder="2026-05-01"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>종료일</Text>
              <TextInput
                value={endsAtStr}
                onChangeText={setEndsAtStr}
                placeholder="2026-05-31"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>노출 시작시간 (HH:mm)</Text>
              <TextInput
                value={startTimeStr}
                onChangeText={setStartTimeStr}
                placeholder="09:00"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>노출 종료시간</Text>
              <TextInput
                value={endTimeStr}
                onChangeText={setEndTimeStr}
                placeholder="22:00"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <Text style={styles.hint}>빈 값이면 항상 노출. 시간만 채우면 매일 그 시간대에 노출.</Text>

          {/* 노출 활성화 */}
          <Pressable
            style={[styles.activeToggle, active && styles.activeToggleOn]}
            onPress={() => setActive((v) => !v)}
          >
            {active && <Check size={18} color="#fff" strokeWidth={2.6} />}
            <Text style={styles.activeToggleText}>
              {active ? '노출 활성화됨' : '노출 비활성화됨'}
            </Text>
          </Pressable>

          {/* 최종 미리보기 */}
          <Text style={styles.sectionTitle}>최종 미리보기</Text>
          <Text style={styles.hint}>실제 홈에서 노출될 모양과 동일합니다.</Text>
          <View style={styles.previewWrap}>
            <BannerPreviewCard banner={previewBanner} />
          </View>
          <Text style={styles.hint}>랜딩 URL을 입력하면 배너 클릭 시 이동합니다.</Text>

          {/* 저장 */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>저장하기</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 이미지 크롭 모달 — 사진 선택 직후 자동으로 열림 */}
      <ImageCropper
        visible={!!pendingCropUri}
        sourceUri={pendingCropUri}
        aspectRatio={2.7}
        outputWidth={1200}
        onCancel={() => setPendingCropUri(null)}
        onConfirm={(uri) => {
          setImageUri(uri);
          setPendingCropUri(null);
        }}
      />
    </SafeAreaView>
  );
}

function BannerPreviewCard({
  banner,
}: {
  banner: {
    subCopy: string;
    mainCopy: string;
    subColor: string;
    mainColor: string;
    imageUrl?: string | null;
  };
}) {
  return (
    <View style={previewStyles.card}>
      {banner.imageUrl ? (
        <Image source={{ uri: banner.imageUrl }} style={previewStyles.bg} resizeMode="cover" />
      ) : null}
      <View style={previewStyles.counterWrap}>
        <Text style={previewStyles.counter}>1 / 1</Text>
      </View>
      <View style={previewStyles.copyWrap}>
        <Text style={[previewStyles.subCopy, { color: banner.subColor }]} numberOfLines={1}>
          {banner.subCopy}
        </Text>
        <View style={previewStyles.mainRow}>
          <Text
            style={[previewStyles.mainCopy, { color: banner.mainColor }]}
            numberOfLines={2}
          >
            {banner.mainCopy}
          </Text>
          <ChevronRight size={20} color={banner.mainColor} strokeWidth={2.4} />
        </View>
      </View>
    </View>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={pickerStyles.wrap}>
      <Text style={pickerStyles.label}>{label}</Text>
      <View style={pickerStyles.row}>
        {BANNER_COPY_COLORS.map((c) => {
          const active = value.toLowerCase() === c.value.toLowerCase();
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.value)}
              style={[
                pickerStyles.swatch,
                { backgroundColor: c.value },
                active && pickerStyles.swatchActive,
              ]}
              accessibilityLabel={c.label}
            >
              {active && (
                <View
                  style={[
                    pickerStyles.swatchCheck,
                    {
                      backgroundColor:
                        c.value.toLowerCase() === '#ffffff' ? '#000' : '#fff',
                    },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  deny: { fontSize: 14, color: Colors.textMuted },

  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 6, lineHeight: 18 },

  imagePicker: {
    height: 160,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imagePickerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  imagePickerText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  pickedImg: { width: '100%', height: '100%' },
  imageActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  imageActionText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text,
  },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dateLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 6, marginTop: 6 },

  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 10,
    marginTop: 18,
    backgroundColor: Colors.divider,
  },
  activeToggleOn: { backgroundColor: Colors.primary },
  activeToggleText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  previewWrap: { marginTop: 4 },
  saveBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FF8A2B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});

const previewStyles = StyleSheet.create({
  card: {
    aspectRatio: 2.7,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  counterWrap: {
    position: 'absolute',
    top: 12,
    right: 14,
  },
  counter: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  copyWrap: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  subCopy: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mainCopy: { flex: 1, fontSize: 17, fontWeight: '800', lineHeight: 22 },
});

const pickerStyles = StyleSheet.create({
  wrap: { marginTop: 10 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchActive: { borderWidth: 3, borderColor: Colors.primary },
  swatchCheck: { width: 12, height: 12, borderRadius: 6 },
});
