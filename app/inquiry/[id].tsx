import React, { useEffect, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { Inquiry, replyInquiry, subscribeInquiry } from '@/lib/inquiries';

export default function InquiryDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  const [inq, setInq] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeInquiry(id, (next) => {
      setInq(next);
      setLoading(false);
      if (next?.reply) setReply(next.reply);
    });
    return () => unsub();
  }, [id]);

  const onSaveReply = async () => {
    if (!reply.trim()) {
      showInfoAlert('내용 필요', '답변 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await replyInquiry(id, reply);
      showInfoAlert('답변 저장', '답변이 저장되었습니다.');
    } catch (e) {
      showInfoAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="문의 상세" />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!inq) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="문의 상세" />
        <View style={styles.center}>
          <Text style={styles.empty}>문의를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="문의 상세" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.statusTag,
                inq.status === 'answered' ? styles.statusTagAns : styles.statusTagOpen,
              ]}
            >
              <Text style={styles.statusText}>
                {inq.status === 'answered' ? '답변 완료' : '답변 대기'}
              </Text>
            </View>
            <Text style={styles.date}>
              {new Date(inq.createdAt).toLocaleDateString('ko-KR')}
            </Text>
          </View>

          {isAdmin && (
            <Text style={styles.author}>
              작성자: {inq.authorName || '(이름 없음)'} · {inq.authorEmail || ''}
            </Text>
          )}

          <Text style={styles.title}>{inq.title}</Text>
          <Text style={styles.content}>{inq.content}</Text>

          {inq.attachments.length > 0 && (
            <View style={styles.attachWrap}>
              <Text style={styles.attachLabel}>첨부 파일</Text>
              <View style={styles.attachGrid}>
                {inq.attachments.map((a, i) => (
                  <Image key={`${a.url}-${i}`} source={{ uri: a.url }} style={styles.attachImg} />
                ))}
              </View>
            </View>
          )}

          {/* 답변 영역 */}
          <View style={styles.replySection}>
            <Text style={styles.replyTitle}>답변</Text>
            {isAdmin ? (
              <>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  placeholder="답변을 입력해 주세요"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={styles.replyInput}
                  textAlignVertical="top"
                />
                <Pressable
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={onSaveReply}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveText}>
                      {inq.status === 'answered' ? '답변 수정' : '답변 등록'}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : inq.reply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyContent}>{inq.reply}</Text>
                {inq.replyAt && (
                  <Text style={styles.replyDate}>
                    {new Date(inq.replyAt).toLocaleDateString('ko-KR')}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.replyPending}>아직 답변이 등록되지 않았습니다.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 14, color: Colors.textMuted },

  scroll: { padding: 20, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusTagOpen: { backgroundColor: Colors.divider },
  statusTagAns: { backgroundColor: Colors.success },
  statusText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  date: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  author: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  content: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  attachWrap: { marginTop: 18 },
  attachLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachImg: { width: 100, height: 100, borderRadius: 8, backgroundColor: Colors.background },

  replySection: { marginTop: 28, gap: 10 },
  replyTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  replyInput: {
    minHeight: 120,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text,
  },
  saveBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  replyBox: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F4F8FE',
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  replyContent: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  replyDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  replyPending: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
});
