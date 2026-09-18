import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, ChevronUp, Mail, Megaphone, Phone } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { deleteAccount } from '@/lib/auth/firebaseAuth';

// 광고 문의 연락처 (출시 전 실제 번호로 교체)
const AD_PHONE = '010-3447-2598';
const AD_PHONE_DIGITS = AD_PHONE.replace(/\D/g, '');
const AD_EMAIL = 'rothy2874@naver.com';

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const clearRecent = useSearchStore((s) => s.clearRecent);
  const clearFavorites = useFavoritesStore((s) => s.clear);
  const [adOpen, setAdOpen] = useState(false);

  const confirmAsync = (title: string, message: string, confirmLabel: string): Promise<boolean> => {
    return new Promise((resolve) => {
      showConfirmAlert(title, message, () => resolve(true), {
        confirmLabel,
        destructive: true,
        onCancel: () => resolve(false),
      });
    });
  };

  const confirmSignOut = async () => {
    const ok = await confirmAsync('로그아웃', '정말 로그아웃 하시겠습니까?', '로그아웃');
    if (!ok) return;
    await signOut();
    router.replace('/(auth)/title');
  };

  const confirmDeleteAccount = async () => {
    const ok = await confirmAsync(
      '회원 탈퇴',
      '회원 정보가 영구적으로 삭제됩니다. 관심 매장, 메모 등 일부 데이터는 복구할 수 없습니다.\n\n정말 탈퇴하시겠습니까?',
      '탈퇴',
    );
    if (!ok) return;
    try {
      await deleteAccount();
      showInfoAlert('탈퇴 완료', '계정이 삭제되었습니다. 이용해 주셔서 감사합니다.', () => {
        router.replace('/(auth)/title');
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === 'auth/requires-recent-login') {
        showInfoAlert(
          '재로그인 필요',
          '계정 삭제를 진행하려면 보안을 위해 다시 한번 로그인해야 합니다. 로그아웃 후 다시 로그인하고 시도해 주세요.',
        );
      } else {
        showInfoAlert('탈퇴 실패', err?.message ?? '잠시 후 다시 시도해 주세요.');
      }
    }
  };

  const confirmClearRecent = async () => {
    const ok = await confirmAsync('최근 기록 삭제', '최근 검색과 최근 목적지를 모두 삭제할까요?', '삭제');
    if (ok) clearRecent();
  };

  const confirmClearFavorites = async () => {
    const ok = await confirmAsync('관심 매장 목록 삭제', '모든 관심 매장을 삭제할까요?', '삭제');
    if (ok) clearFavorites();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="설정" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 광고 문의하기 */}
        <View style={styles.adWrap}>
          <Pressable
            style={[styles.adBtn, adOpen && styles.adBtnOpen]}
            onPress={() => setAdOpen((v) => !v)}
          >
            <Megaphone size={20} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.adBtnText}>광고 문의하기</Text>
            {adOpen ? (
              <ChevronUp size={20} color={Colors.textMuted} />
            ) : (
              <ChevronDown size={20} color={Colors.textMuted} />
            )}
          </Pressable>

          {adOpen && (
            <View style={styles.adBody}>
              <Pressable
                style={styles.adRow}
                onPress={() => Linking.openURL(`tel:${AD_PHONE_DIGITS}`).catch(() => {})}
              >
                <Phone size={18} color={Colors.primary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adRowLabel}>전화</Text>
                  <Text style={styles.adRowPhone}>{AD_PHONE}</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </Pressable>
              <View style={styles.adDivider} />
              <Pressable
                style={styles.adRow}
                onPress={() => Linking.openURL(`mailto:${AD_EMAIL}?subject=%5B%EA%B4%91%EA%B3%A0%20%EB%AC%B8%EC%9D%98%5D`).catch(() => {})}
              >
                <Mail size={18} color={Colors.primary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adRowLabel}>이메일</Text>
                  <Text style={styles.adRowEmail}>{AD_EMAIL}</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          )}
        </View>

        <Section title="언어 / Language">
          <View style={{ paddingVertical: 4 }}>
            <LanguagePicker variant="row" />
          </View>
        </Section>

        <Section title="데이터">
          <Row label="최근 검색·목적지 삭제" onPress={confirmClearRecent} />
          <Row label="관심 매장 비우기" onPress={confirmClearFavorites} />
        </Section>

        <Section title="앱">
          <Row label="앱 정보" onPress={() => router.push('/app-info')} />
          <Row
            label="업체 정보 변경 신청 및 신규업체 등록"
            onPress={() => {
              const msg =
                '업체 정보 변경(상호, 전화번호, 카테고리 등) 또는 신규업체 등록이 필요하시면\n아래 이메일로 신청해 주세요.\n\n📧 heimin2598@gmail.com';
              showConfirmAlert(
                '업체 정보 변경 및 신규 등록',
                msg,
                () => {
                  Linking.openURL('mailto:heimin2598@gmail.com?subject=%5B%EC%97%85%EC%B2%B4%20%EC%A0%95%EB%B3%B4%20%EB%B3%80%EA%B2%BD%20%EB%B0%8F%20%EC%8B%A0%EA%B7%9C%EC%97%85%EC%B2%B4%20%EB%93%B1%EB%A1%9D%5D').catch(() => {});
                },
                { confirmLabel: '메일 보내기' },
              );
            }}
          />
          <Row label="개인정보 처리방침" onPress={() => router.push('/privacy-policy')} />
          <Row label="이용약관" onPress={() => router.push('/terms-of-service')} />
        </Section>

        {/* 비회원에게 로그아웃·회원 탈퇴는 의미가 없다. 로그인 유도로 대체한다. */}
        {user ? (
          <View style={{ padding: 16, paddingTop: 24, gap: 10 }}>
            <Button label="로그아웃" variant="danger" onPress={confirmSignOut} />
            <Pressable onPress={confirmDeleteAccount} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                회원 탈퇴
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ padding: 16, paddingTop: 24 }}>
            <Button label="로그인" onPress={() => router.push('/(auth)/login')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={rowStyles.row} onPress={onPress}>
      <Text style={rowStyles.label}>{label}</Text>
      <ChevronRight size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  adWrap: { paddingHorizontal: 16, paddingTop: 16 },
  adBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  adBtnOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  adIcon: { fontSize: 18 },
  adBtnText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '800' },
  adChevron: { color: '#fff', fontSize: 14, fontWeight: '700' },
  adBody: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  adRowIcon: { fontSize: 18 },
  adRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  adRowPhone: { fontSize: 16, color: Colors.primary, fontWeight: '800', marginTop: 2 },
  adRowEmail: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  adRowArrow: { fontSize: 20, color: Colors.textMuted },
  adDivider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
});

const sectionStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 16 },
  title: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', marginBottom: 8 },
  card: { borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  label: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  arrow: { fontSize: 20, color: Colors.textMuted },
});
