import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { createAdInquiry } from '@/lib/adInquiries';
import { showInfoAlert } from '@/utils/alerts';

export default function AdInquiryNewScreen() {
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!company.trim()) return showInfoAlert('확인 필요', '업체명을 입력해 주세요.');
    if (!contact.trim()) return showInfoAlert('확인 필요', '담당자명을 입력해 주세요.');
    if (!phone.trim()) return showInfoAlert('확인 필요', '전화번호를 입력해 주세요.');
    if (!email.trim()) return showInfoAlert('확인 필요', '이메일을 입력해 주세요.');

    setSubmitting(true);
    try {
      await createAdInquiry({
        company: company.trim(),
        contact: contact.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      showInfoAlert(
        '광고 문의 접수 완료',
        '담당자가 빠른 시일 내에 입력하신 연락처로 안내드리겠습니다.',
        () => router.back(),
      );
    } catch (e) {
      showInfoAlert('전송 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="광고 문의하기" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.intro}>
            <Text style={styles.introTitle}>홈 배너 광고 문의</Text>
            <Text style={styles.introDesc}>
              아래 정보를 남겨주시면 담당자가 빠른 시일 내에 안내드리겠습니다.
            </Text>
          </View>

          <Text style={styles.label}>업체명 *</Text>
          <TextInput
            value={company}
            onChangeText={setCompany}
            placeholder="예: 헤이민레이스"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>담당자명 *</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="예: 홍길동"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>전화번호 *</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="010-0000-0000"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>이메일 *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  intro: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: Colors.warning,
  },
  introTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  introDesc: { fontSize: 13, color: Colors.text, marginTop: 4, lineHeight: 18 },

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
});
