import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showInfoAlert } from '@/utils/alerts';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import {
  createPartsRequest,
  MAX_CATEGORIES_PER_REQUEST,
  MAX_PHOTOS_PER_REQUEST,
  MAX_TEXT_LENGTH,
} from '@/lib/partsRequests';
import { PartsCategory } from '@/types';
import {
  PARTS_CATEGORY_LABEL,
  PARTS_CATEGORY_ORDER,
} from '@/constants/partsCategories';

export default function PartsNewScreen() {
  const [categories, setCategories] = useState<PartsCategory[]>([]);
  const [text, setText] = useState('');
  const [uris, setUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (c: PartsCategory) => {
    setCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= MAX_CATEGORIES_PER_REQUEST) return prev;
      return [...prev, c];
    });
  };

  const remaining = MAX_PHOTOS_PER_REQUEST - uris.length;

  const pickFromLibrary = async () => {
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      showInfoAlert('권한 필요', '사진첩 접근 권한이 필요합니다.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (!r.canceled && r.assets.length > 0) {
      const newUris = r.assets.map((a) => a.uri).slice(0, remaining);
      setUris((prev) => [...prev, ...newUris]);
    }
  };

  const pickFromCamera = async () => {
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      showInfoAlert('권한 필요', '카메라 권한이 필요합니다.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled && r.assets[0]) {
      setUris((prev) => [...prev, r.assets[0].uri]);
    }
  };

  const removeAt = (idx: number) => {
    setUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async () => {
    if (categories.length === 0) {
      showInfoAlert('카테고리 선택', '카테고리를 최소 1개 선택해 주세요.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed && uris.length === 0) {
      showInfoAlert('내용 부족', '사진 한 장이라도 또는 설명을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createPartsRequest({ categories, text: trimmed, photoUris: uris });
      router.replace({ pathname: '/parts/[id]', params: { id } });
    } catch (e) {
      showInfoAlert('등록 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="부자재 찾기 요청" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.section}>
          <View style={styles.categoryHeader}>
            <Text style={styles.sectionTitle}>
              카테고리 <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.categoryCount}>
              {categories.length}/{MAX_CATEGORIES_PER_REQUEST}
            </Text>
          </View>
          <Text style={styles.categorySub}>최대 3개까지 복수 선택 가능</Text>
          <View style={styles.categoryGrid}>
            {PARTS_CATEGORY_ORDER.map((c) => {
              const active = categories.includes(c);
              const disabled =
                !active && categories.length >= MAX_CATEGORIES_PER_REQUEST;
              return (
                <Pressable
                  key={c}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                    disabled && styles.categoryChipDisabled,
                  ]}
                  onPress={() => toggleCategory(c)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                      disabled && styles.categoryChipTextDisabled,
                    ]}
                  >
                    {PARTS_CATEGORY_LABEL[c]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>설명</Text>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_TEXT_LENGTH))}
            placeholder="찾는 부자재를 자세히 설명해 주세요. (예: 검정색 18mm 단추, 진주 장식, 50개 정도 필요)"
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {text.length} / {MAX_TEXT_LENGTH}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            사진 ({uris.length}/{MAX_PHOTOS_PER_REQUEST})
          </Text>
          <View style={styles.photoGrid}>
            {uris.map((u, i) => (
              <View key={`${u}-${i}`} style={styles.photoSlot}>
                <Image source={{ uri: u }} style={styles.photoImg} />
                <Pressable style={styles.photoRemove} onPress={() => removeAt(i)} hitSlop={8}>
                  <X size={14} color="#fff" strokeWidth={2.4} />
                </Pressable>
              </View>
            ))}
            {remaining > 0 && (
              <View style={styles.photoActions}>
                <Pressable style={styles.photoAddBtn} onPress={pickFromLibrary}>
                  <ImagePlus size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.photoAddText}>사진첩</Text>
                </Pressable>
                <Pressable style={styles.photoAddBtn} onPress={pickFromCamera}>
                  <Camera size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.photoAddText}>카메라</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Text style={styles.hint}>최대 {MAX_PHOTOS_PER_REQUEST}장 · 자동 압축 후 업로드</Text>
        </View>

        <View style={styles.actionWrap}>
          <Button
            label={submitting ? '등록 중...' : '요청 등록'}
            onPress={onSubmit}
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  required: { color: Colors.danger, fontWeight: '800' },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryCount: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  categorySub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  categoryChipDisabled: { opacity: 0.4 },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  categoryChipTextActive: { color: '#fff' },
  categoryChipTextDisabled: { color: Colors.textMuted },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 14,
    color: Colors.text,
  },
  counter: { fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoSlot: {
    width: 84,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.background,
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoAddBtn: {
    width: 84,
    height: 84,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoAddText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  hint: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  actionWrap: { paddingHorizontal: 16, paddingTop: 20 },
});
