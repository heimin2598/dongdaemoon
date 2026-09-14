import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { createInquiry } from '@/lib/inquiries';

const MAX_ATTACHMENTS = 5;

export default function InquiryNewScreen() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [uris, setUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_ATTACHMENTS - uris.length;

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
      setUris((prev) => [...prev, ...r.assets.map((a) => a.uri).slice(0, remaining)]);
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
    if (!r.canceled && r.assets[0]) setUris((prev) => [...prev, r.assets[0].uri]);
  };

  const removeAt = (idx: number) => setUris((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    if (!title.trim()) {
      showInfoAlert('제목 필요', '문의 제목을 입력해 주세요.');
      return;
    }
    if (!content.trim()) {
      showInfoAlert('내용 필요', '문의 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createInquiry({
        title: title.trim(),
        content: content.trim(),
        attachmentUris: uris,
      });
      router.replace({ pathname: '/inquiry/[id]', params: { id } });
    } catch (e) {
      showInfoAlert('전송 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="문의하기" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>제목</Text>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, 200))}
            placeholder="제목을 입력해 주세요"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>내용</Text>
          <TextInput
            value={content}
            onChangeText={(v) => setContent(v.slice(0, 5000))}
            placeholder="문의 내용을 자세히 입력해 주세요"
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            첨부 파일 ({uris.length}/{MAX_ATTACHMENTS})
          </Text>
          <View style={styles.attachGrid}>
            {uris.map((u, i) => (
              <View key={`${u}-${i}`} style={styles.attachSlot}>
                <Image source={{ uri: u }} style={styles.attachImg} />
                <Pressable style={styles.attachRemove} onPress={() => removeAt(i)} hitSlop={8}>
                  <X size={14} color="#fff" strokeWidth={2.4} />
                </Pressable>
              </View>
            ))}
            {remaining > 0 && (
              <View style={styles.attachActions}>
                <Pressable style={styles.attachAddBtn} onPress={pickFromLibrary}>
                  <ImagePlus size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.attachAddText}>사진첩</Text>
                </Pressable>
                <Pressable style={styles.attachAddBtn} onPress={pickFromCamera}>
                  <Camera size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.attachAddText}>카메라</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>보내기</Text>
            )}
          </Pressable>

          <Pressable style={styles.historyLink} onPress={() => router.push('/my-inquiries')}>
            <Text style={styles.historyLinkText}>내 문의 내역 보기 →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 14, marginBottom: 6 },
  input: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    minHeight: 160,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text,
  },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachSlot: {
    width: 84,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.background,
  },
  attachImg: { width: '100%', height: '100%' },
  attachRemove: {
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
  attachActions: { flexDirection: 'row', gap: 8 },
  attachAddBtn: {
    width: 84,
    height: 84,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  attachAddText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  historyLink: { alignSelf: 'center', marginTop: 14, padding: 8 },
  historyLinkText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
});
