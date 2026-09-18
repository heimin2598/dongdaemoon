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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search, Store as StoreIcon } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { formatStoreLocation, searchStores } from '@/data/stores';
import type { Store } from '@/data/stores/types';
import { createMerchantClaim } from '@/lib/merchantClaims';
import { showInfoAlert } from '@/utils/alerts';

type Tab = 'existing' | 'new';

/**
 * 매장 매칭 페이지 — 사장님 회원가입 직후 진입.
 * - 기존 업체 찾기: 디렉터리(3,689개) 검색 → 선택 → 매칭 신청
 * - 직접 등록: 신규 매장 정보 입력 → 신청 (운영자 승인 시 매장 DB 등록)
 * 신청 완료 시 pending-approval 로 이동.
 */
export default function SignupMatchScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('existing');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 기존 업체 찾기
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Store | null>(null);

  // 직접 등록
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];
    return searchStores(q, 30);
  }, [query]);

  // 인증 안 된 사용자가 직접 진입한 경우 가드
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/title');
    } else if (user.role !== 'merchant') {
      router.replace('/(tabs)/home');
    }
  }, [user]);

  const phoneError = (() => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 11) return '올바른 전화번호를 입력해 주세요.';
    return null;
  })();

  const canSubmit = (() => {
    if (submitting) return false;
    if (!phone || phoneError) return false;
    if (tab === 'existing') {
      return !!picked;
    }
    return newName.trim().length >= 2;
  })();

  const onSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (tab === 'existing') {
        if (!picked?.code) return;
        await createMerchantClaim({
          uid: user.id,
          applicantName: user.displayName ?? '',
          applicantEmail: user.email,
          applicantPhone: phone.trim(),
          claimType: 'existing',
          storeCode: picked.code,
        });
      } else {
        await createMerchantClaim({
          uid: user.id,
          applicantName: user.displayName ?? '',
          applicantEmail: user.email,
          applicantPhone: phone.trim(),
          claimType: 'new',
          newStore: {
            name: newName.trim(),
            phone: phone.trim(),
            address: newAddress.trim() || undefined,
            category: newCategory.trim() || undefined,
            description: newDescription.trim() || undefined,
          },
        });
      }
      router.replace('/(auth)/pending-approval');
    } catch (e: any) {
      const msg = e?.message ?? '신청에 실패했습니다.';
      showInfoAlert('신청 실패', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="매장 매칭" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>매장을 연동해 주세요</Text>
          <Text style={styles.desc}>
            본인이 운영 중인 매장을 선택하거나 직접 등록해 주세요.{'\n'}
            운영자 승인이 완료되면 사장님 기능을 이용할 수 있습니다.
          </Text>

          {/* 탭 */}
          <View style={styles.tabRow}>
            <TabBtn
              icon={<Search size={16} color={tab === 'existing' ? '#fff' : Colors.text} strokeWidth={2.4} />}
              label="기존 업체 찾기"
              active={tab === 'existing'}
              onPress={() => setTab('existing')}
            />
            <TabBtn
              icon={<Plus size={16} color={tab === 'new' ? '#fff' : Colors.text} strokeWidth={2.4} />}
              label="직접 등록"
              active={tab === 'new'}
              onPress={() => setTab('new')}
            />
          </View>

          {tab === 'existing' ? (
            <View style={{ gap: 10 }}>
              <TextInput
                placeholder="업체명·호수·전화번호 검색"
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setPicked(null);
                }}
              />
              <Text style={styles.hint}>
                우리 업체가 등록 DB에 있는지 검색해 보세요. 없으면 위 [직접 등록] 탭에서 신규 등록하세요.
              </Text>

              {query.trim().length === 0 ? (
                <View style={styles.empty}>
                  <StoreIcon size={36} color={Colors.textMuted} strokeWidth={1.4} />
                  <Text style={styles.emptyText}>위 검색창에 업체명을 입력하세요.</Text>
                </View>
              ) : results.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>검색 결과가 없습니다. 직접 등록을 이용해 주세요.</Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {results.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setPicked(s)}
                      style={[
                        styles.resultRow,
                        picked?.id === s.id && styles.resultRowActive,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {s.name || '(상호 없음)'}
                        </Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {formatStoreLocation(s)}
                          {s.phone ? ` · ${s.phone}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          picked?.id === s.id && styles.radioActive,
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={styles.hint}>
                디렉터리에 없는 신규 매장입니다. 운영자가 정보를 확인 후 등록합니다.
              </Text>
              <TextInput
                label="매장명 *"
                placeholder="예: 동대문 단추가게"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                label="매장 주소"
                placeholder="예: 동대문 종합시장 B동 4층 215호"
                value={newAddress}
                onChangeText={setNewAddress}
              />
              <TextInput
                label="취급 품목 / 카테고리"
                placeholder="예: 단추, 비즈, 부자재"
                value={newCategory}
                onChangeText={setNewCategory}
              />
              <TextInput
                label="간단 소개 (선택)"
                placeholder="매장에 대한 간단한 설명"
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />
            </View>
          )}

          <View style={styles.divider} />

          {/* 공통: 사장님 연락처 */}
          <TextInput
            label="사장님 연락처 *"
            placeholder="01012345678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            error={phoneError ?? undefined}
          />
          <Text style={styles.hint}>운영자가 신청 확인 시 전화 드릴 번호입니다.</Text>

          <View style={{ height: 12 }} />
          <Button
            label={submitting ? '신청 중...' : '인증 신청'}
            onPress={onSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
          {submitting && (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active && styles.tabBtnActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 4 },
  desc: { fontSize: 13, color: Colors.textMuted, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tabLabelActive: { color: '#fff' },
  hint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  list: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 10,
  },
  resultRowActive: { backgroundColor: '#EEF2FA' },
  resultName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  resultMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  radioActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 20 },
});
