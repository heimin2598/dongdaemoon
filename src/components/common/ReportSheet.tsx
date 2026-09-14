import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  MAX_REPORT_DETAIL,
  REPORT_REASON_LABEL,
  REPORT_REASON_ORDER,
  submitReport,
} from '@/lib/reports';
import { blockUser } from '@/lib/blocks';
import { useBlocksStore } from '@/stores/blocksStore';
import { ReportReason, ReportTargetType } from '@/types';
import { showInfoAlert } from '@/utils/alerts';

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerUid: string;
  /** 콘텐츠 종류를 한국어로 표시 (예: "리뷰", "요청 글"). */
  targetLabel?: string;
}

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetOwnerUid,
  targetLabel,
}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isAlreadyBlocked = useBlocksStore((s) => s.isBlocked(targetOwnerUid));

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setDetail('');
      setAlsoBlock(false);
      setSubmitting(false);
    }
  }, [visible]);

  const onSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await submitReport({
        targetType,
        targetId,
        targetOwnerUid,
        reason,
        detail: detail.trim(),
      });
      if (alsoBlock && !isAlreadyBlocked && targetOwnerUid) {
        try {
          await blockUser(targetOwnerUid, { reason: REPORT_REASON_LABEL[reason] });
        } catch {
          // 차단 실패는 무시 — 신고는 이미 접수됨
        }
      }
      onClose();
      showInfoAlert(
        '신고 접수 완료',
        alsoBlock
          ? '신고가 접수되었고, 해당 사용자를 차단했습니다.'
          : '신고해 주셔서 감사합니다. 검토 후 24시간 이내에 처리하겠습니다.',
      );
    } catch (e) {
      showInfoAlert('신고 실패', e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {targetLabel ? `${targetLabel} 신고` : '신고'}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={22} color={Colors.text} strokeWidth={2.2} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <Text style={styles.sectionLabel}>사유 선택</Text>
              <View style={styles.reasonList}>
                {REPORT_REASON_ORDER.map((r) => {
                  const active = reason === r;
                  return (
                    <Pressable
                      key={r}
                      style={[styles.reasonItem, active && styles.reasonItemActive]}
                      onPress={() => setReason(r)}
                    >
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <Check size={14} color="#fff" strokeWidth={3} />}
                      </View>
                      <Text style={styles.reasonLabel}>
                        {REPORT_REASON_LABEL[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>추가 설명 (선택)</Text>
              <TextInput
                value={detail}
                onChangeText={(v) => setDetail(v.slice(0, MAX_REPORT_DETAIL))}
                placeholder="구체적인 상황을 알려주시면 검토에 도움이 됩니다."
                placeholderTextColor={Colors.textMuted}
                multiline
                style={styles.detailInput}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {detail.length} / {MAX_REPORT_DETAIL}
              </Text>

              {!!targetOwnerUid && !isAlreadyBlocked && (
                <Pressable
                  style={styles.blockToggle}
                  onPress={() => setAlsoBlock((v) => !v)}
                >
                  <View style={[styles.checkbox, alsoBlock && styles.checkboxActive]}>
                    {alsoBlock && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={styles.blockToggleText}>
                    이 사용자를 차단하기 (앞으로 콘텐츠가 보이지 않습니다)
                  </Text>
                </Pressable>
              )}
              {isAlreadyBlocked && (
                <Text style={styles.alreadyBlocked}>이미 차단된 사용자입니다.</Text>
              )}
            </ScrollView>

            <Pressable
              style={[
                styles.submitBtn,
                (!reason || submitting) && styles.submitBtnDisabled,
              ]}
              disabled={!reason || submitting}
              onPress={onSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>신고하기</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetWrap: { width: '100%' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 6,
  },
  reasonList: { gap: 4 },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  reasonItemActive: { backgroundColor: '#F4F8FE' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reasonLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  detailInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 90,
    fontSize: 14,
    color: Colors.text,
  },
  counter: { fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
  blockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFF4E5',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  blockToggleText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text },
  alreadyBlocked: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
