import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Crown, Gift, Sparkles, X, Minus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { isActivePremium, trialDaysRemaining } from '@/lib/entitlement';
import {
  presentAppleCodeRedemptionSheet,
  purchasePlan,
  purchasesAvailability,
  restorePurchases,
} from '@/lib/purchases';
import {
  formatPromoCode,
  getTodayPromoAttemptCount,
  normalizePromoCode,
  PROMO_CODE_FORMATTED_LENGTH,
  redeemPromoCode,
} from '@/lib/promoCodes';
import { showInfoAlert } from '@/utils/alerts';
import { FEATURE_MESSENGER_ENABLED } from '@/constants/features';

const MAX_PROMO_ATTEMPTS_PER_DAY = 5;

/**
 * 과금 유도 페이지. 무료 vs 프리미엄 혜택 비교 + 가격 선택.
 *
 * 진입 경로:
 *  - 가입 직후: 자동 push (visitor 만). 닫으면 무료 회원으로 계속.
 *  - PaywallSheet 의 [혜택 알아보기] 버튼.
 *  - MY 화면 멤버십 진입.
 *
 * 쿼리:
 *  - `?fromSignup=1` → 닫기 버튼 라벨이 "무료회원으로 계속" 로 변경
 */

const PRICE_MONTHLY = 3900;
const PRICE_LIFETIME = 39000;

const FREE_FEATURES: Array<{ label: string; included: boolean }> = [
  { label: '매장 검색 · 길안내', included: true },
  { label: '관심 매장 등록', included: true },
  { label: '카테고리 · 상호명 검색', included: true },
  { label: '광고 제거', included: false },
  { label: '매장 메모 · 포토 메모', included: false },
  ...(FEATURE_MESSENGER_ENABLED
    ? [{ label: '사장님 메신저 (1:1 채팅 · 번역)', included: false }]
    : []),
  { label: '부자재 찾기 (사진으로 매칭)', included: false },
];

const PREMIUM_FEATURES: Array<{ label: string; included: boolean }> = [
  { label: '매장 검색 · 길안내', included: true },
  { label: '관심 매장 등록', included: true },
  { label: '카테고리 · 상호명 검색', included: true },
  { label: '광고 제거', included: true },
  { label: '매장 메모 · 포토 메모', included: true },
  ...(FEATURE_MESSENGER_ENABLED
    ? [{ label: '사장님 메신저 (1:1 채팅 · 번역)', included: true }]
    : []),
  { label: '부자재 찾기 (사진으로 매칭)', included: true },
];

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ fromSignup?: string }>();
  const fromSignup = params.fromSignup === '1';
  const { entitlement } = useEntitlement();
  const isPremium = isActivePremium(entitlement);
  const remaining = trialDaysRemaining(entitlement);

  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  const onUpgrade = () => {
    setPlanPickerOpen(true);
  };

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <X size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.crownWrap}>
          <Crown size={40} color={Colors.warning} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>셰르파 프리미엄</Text>
        <Text style={styles.subtitle}>
          커피 1잔 값으로 모든 기능 잠금해제와{'\n'}광고 제거로 쾌적하게 사용하세요
        </Text>

        {isPremium && (
          <View style={styles.activeBox}>
            <Sparkles size={18} color={Colors.success} strokeWidth={2.2} />
            <Text style={styles.activeText}>
              {entitlement.grandfathered
                ? '평생 프리미엄 사용 중'
                : remaining > 0
                  ? `프리미엄 사용 중 · ${remaining}일 남음`
                  : '프리미엄 사용 중'}
            </Text>
          </View>
        )}

        {/* 일반 회원 카드 */}
        <PlanCard
          tone="free"
          name="일반 회원"
          subtitle="기본 매장 검색과 길안내"
          priceText="₩0"
          priceSubText="무료"
          features={FREE_FEATURES}
          isCurrent={!isPremium}
          action={
            isPremium
              ? { label: '무료로 다운그레이드', disabled: true, onPress: () => {} }
              : undefined
          }
        />

        {/* 프리미엄 회원 카드 */}
        <PlanCard
          tone="premium"
          name="프리미엄 회원"
          subtitle="모든 기능 잠금해제 + 광고 제거"
          priceText={`₩${PRICE_MONTHLY.toLocaleString()}`}
          priceSubText={`/ 월  ·  평생 ₩${PRICE_LIFETIME.toLocaleString()}`}
          features={PREMIUM_FEATURES}
          isCurrent={isPremium}
          badge="BEST"
          action={
            isPremium
              ? undefined
              : {
                  label: '프리미엄 시작',
                  onPress: onUpgrade,
                }
          }
        />

        <Text style={styles.priceNote}>
          매월 ₩{PRICE_MONTHLY.toLocaleString()} 자동 결제 · 언제든 해지 · 평생 결제 시 1회 ₩{PRICE_LIFETIME.toLocaleString()}
        </Text>

        {/* 플랫폼별 프로모션 코드 진입점:
            - Android: 커스텀 모달 (Firestore 기반 자체 코드 시스템, Google Play 정책 허용)
            - iOS: Apple 표준 리뎀션 시트 (App Store Connect 발급 코드, Apple 정책 준수) */}
        {!isPremium && (
          <Pressable
            style={styles.promoLinkBtn}
            onPress={async () => {
              if (Platform.OS === 'ios') {
                // Apple 표준 시트 — 결제 시스템 초기화 확인 후 호출
                const avail = purchasesAvailability();
                if (!avail.available) {
                  showInfoAlert(
                    '코드 사용 불가',
                    avail.reason === 'expo-go'
                      ? 'Expo Go 에서는 코드 사용이 지원되지 않습니다.\n실제 앱에서 진행해 주세요.'
                      : '결제 모듈이 준비되지 않았습니다. 앱을 재시작 후 다시 시도해 주세요.',
                  );
                  return;
                }
                try {
                  await presentAppleCodeRedemptionSheet();
                } catch (e: unknown) {
                  const err = e as { message?: string };
                  showInfoAlert('코드 사용 불가', err?.message ?? '잠시 후 다시 시도해 주세요.');
                }
              } else {
                setPromoOpen(true);
              }
            }}
          >
            <Gift size={16} color={Colors.primary} strokeWidth={2.2} />
            <Text style={styles.promoLinkText}>프로모션 코드가 있으세요?</Text>
          </Pressable>
        )}

        <Pressable style={styles.skipBtn} onPress={onClose}>
          <Text style={styles.skipBtnText}>
            {fromSignup ? '무료 회원으로 계속하기' : '닫기'}
          </Text>
        </Pressable>
      </ScrollView>

      <PlanPicker
        visible={planPickerOpen}
        onClose={() => setPlanPickerOpen(false)}
        closePaywall={onClose}
      />

      <PromoCodeModal
        visible={promoOpen}
        onClose={() => setPromoOpen(false)}
        onSuccess={onClose}
      />
    </SafeAreaView>
  );
}

function PlanCard({
  tone,
  name,
  subtitle,
  priceText,
  priceSubText,
  features,
  isCurrent,
  badge,
  action,
}: {
  tone: 'free' | 'premium';
  name: string;
  subtitle: string;
  priceText: string;
  priceSubText?: string;
  features: Array<{ label: string; included: boolean }>;
  isCurrent: boolean;
  badge?: string;
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const accent = tone === 'premium' ? Colors.warning : Colors.primary;
  return (
    <View
      style={[
        cardStyles.card,
        isCurrent && { borderColor: accent, borderWidth: 2.5 },
      ]}
    >
      {badge && !isCurrent && (
        <View style={[cardStyles.badge, { backgroundColor: accent }]}>
          <Text style={cardStyles.badgeText}>{badge}</Text>
        </View>
      )}
      {isCurrent && (
        <View style={[cardStyles.badge, cardStyles.currentBadge, { backgroundColor: accent }]}>
          <Sparkles size={11} color="#fff" strokeWidth={2.6} />
          <Text style={cardStyles.badgeText}>현재 이용 중</Text>
        </View>
      )}

      <View style={cardStyles.head}>
        {tone === 'premium' && <Crown size={20} color={Colors.warning} strokeWidth={2.4} />}
        <Text style={cardStyles.name}>{name}</Text>
      </View>
      <Text style={cardStyles.subtitle}>{subtitle}</Text>

      <View style={cardStyles.priceRow}>
        <Text style={cardStyles.price}>{priceText}</Text>
        {priceSubText && <Text style={cardStyles.priceSub}>{priceSubText}</Text>}
      </View>

      {action && (
        <Pressable
          style={[
            cardStyles.actionBtn,
            tone === 'premium' ? cardStyles.actionBtnPrimary : cardStyles.actionBtnSecondary,
            action.disabled && cardStyles.actionBtnDisabled,
          ]}
          onPress={action.disabled ? undefined : action.onPress}
          disabled={action.disabled}
        >
          {tone === 'premium' && !action.disabled && (
            <Crown size={16} color="#fff" strokeWidth={2.4} />
          )}
          <Text
            style={[
              cardStyles.actionBtnText,
              tone === 'premium' ? { color: '#fff' } : { color: Colors.text },
              action.disabled && { color: Colors.textMuted },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      )}

      <View style={cardStyles.featureList}>
        {features.map((f, idx) => (
          <View key={idx} style={cardStyles.featureRow}>
            {f.included ? (
              <Check size={16} color={accent} strokeWidth={2.6} />
            ) : (
              <Minus size={16} color={Colors.textMuted} strokeWidth={2.2} />
            )}
            <Text
              style={[
                cardStyles.featureLabel,
                !f.included && { color: Colors.textMuted },
              ]}
            >
              {f.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanPicker({
  visible,
  onClose,
  closePaywall,
}: {
  visible: boolean;
  onClose: () => void;
  closePaywall: () => void;
}) {
  const [selected, setSelected] = useState<'monthly' | 'lifetime'>('monthly');
  const [busy, setBusy] = useState(false);
  const user = useAuthStore((s) => s.user);

  const onConfirm = async () => {
    if (busy) return;
    if (!user) {
      showInfoAlert('로그인 필요', '결제를 진행하려면 로그인해 주세요.');
      return;
    }

    // 유료 결제 — RevenueCat
    const avail = purchasesAvailability();
    if (!avail.available) {
      const msg =
        avail.reason === 'expo-go'
          ? 'Expo Go 에서는 인앱 결제가 동작하지 않습니다.\n실제 빌드(EAS Build 또는 dev client)에서 시도해 주세요.'
          : avail.reason === 'web'
            ? '웹에서는 인앱 결제를 사용할 수 없습니다.\n모바일 앱에서 진행해 주세요.'
            : '결제 모듈을 불러오지 못했습니다.';
      showInfoAlert('결제 사용 불가', msg);
      return;
    }
    setBusy(true);
    try {
      const result = await purchasePlan(selected);
      if (result.isActive) {
        // Firestore entitlement 갱신은 RevenueCat webhook (Cloud Function) 이 admin 권한으로 처리.
        // 스냅샷 리스너 (useEntitlement) 가 몇 초 내 자동 반영.
        onClose();
        closePaywall();
        showInfoAlert('결제 완료', '프리미엄 회원으로 전환되었습니다.');
      } else {
        showInfoAlert('결제 미완료', '구매가 완료되지 않았습니다. 다시 시도해 주세요.');
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err?.userCancelled) {
        // 사용자가 취소 — 알림 없이 종료
      } else {
        showInfoAlert('결제 오류', err?.message ?? '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    const avail = purchasesAvailability();
    if (!avail.available) {
      showInfoAlert('복원 불가', '모바일 앱에서만 결제 복원을 사용할 수 있습니다.');
      return;
    }
    if (!user) {
      showInfoAlert('로그인 필요', '복원을 진행하려면 로그인해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const result = await restorePurchases();
      if (result.isActive) {
        // Firestore 갱신은 webhook 이 담당 — 클라이언트는 스냅샷 리스너로 몇 초 내 반영.
        onClose();
        closePaywall();
        showInfoAlert('복원 완료', '프리미엄 권한이 복원되었습니다.');
      } else {
        showInfoAlert('복원 결과', '복원할 구매 내역이 없습니다.');
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      showInfoAlert('복원 오류', err?.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const confirmLabel = (() => {
    if (selected === 'lifetime') return `₩${PRICE_LIFETIME.toLocaleString()} 결제`;
    return `월 ₩${PRICE_MONTHLY.toLocaleString()} 구독 시작`;
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>요금제 선택</Text>

          <Pressable
            style={[pickerStyles.option, selected === 'monthly' && pickerStyles.optionActive]}
            onPress={() => !busy && setSelected('monthly')}
          >
            <View style={{ flex: 1 }}>
              <Text style={pickerStyles.optionTitle}>월간</Text>
              <Text style={pickerStyles.optionDesc}>매월 자동 결제 · 언제든 해지</Text>
            </View>
            <Text style={pickerStyles.optionPrice}>₩{PRICE_MONTHLY.toLocaleString()}/월</Text>
          </Pressable>

          <Pressable
            style={[pickerStyles.option, selected === 'lifetime' && pickerStyles.optionActive]}
            onPress={() => !busy && setSelected('lifetime')}
          >
            <View style={{ flex: 1 }}>
              <View style={pickerStyles.optionHead}>
                <Text style={pickerStyles.optionTitle}>평생</Text>
                <View style={pickerStyles.bestBadge}>
                  <Text style={pickerStyles.bestBadgeText}>BEST</Text>
                </View>
              </View>
              <Text style={pickerStyles.optionDesc}>1회 결제 · 평생 사용</Text>
            </View>
            <Text style={pickerStyles.optionPrice}>₩{PRICE_LIFETIME.toLocaleString()}</Text>
          </Pressable>

          <Pressable
            style={[pickerStyles.confirmBtn, busy && { opacity: 0.6 }]}
            onPress={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={pickerStyles.confirmBtnText}>{confirmLabel}</Text>
            )}
          </Pressable>

          <Pressable onPress={onRestore} hitSlop={10} style={pickerStyles.restoreBtn} disabled={busy}>
            <Text style={pickerStyles.restoreBtnText}>이전 구매 복원</Text>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={10} style={pickerStyles.cancelBtn} disabled={busy}>
            <Text style={pickerStyles.cancelBtnText}>취소</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PromoCodeModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  // 모달 열릴 때마다 남은 시도 횟수 fetch
  useEffect(() => {
    if (!visible || !user) return;
    getTodayPromoAttemptCount(user.id)
      .then((count) => setRemaining(Math.max(0, MAX_PROMO_ATTEMPTS_PER_DAY - count)))
      .catch(() => setRemaining(null));
  }, [visible, user]);

  const normalized = normalizePromoCode(raw);
  const canSubmit = !!normalized && !busy && (remaining === null || remaining > 0);

  const onSubmit = async () => {
    if (!user) {
      showInfoAlert('로그인 필요', '프로모션 코드 사용은 로그인 후 가능합니다.');
      return;
    }
    if (!normalized) {
      showInfoAlert('코드 형식 오류', '알파벳/숫자 16자리로 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await redeemPromoCode(normalized);
      // 성공 — 즉시 페이월 닫기 (entitlement snapshot 이 몇 초 내 반영)
      setRaw('');
      onClose();
      onSuccess();
      showInfoAlert('영구 프리미엄 활성화', '프로모션 코드가 적용되었습니다. 프리미엄 회원으로 전환되었습니다.');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      // 시도 카운트 재조회
      if (user) {
        getTodayPromoAttemptCount(user.id)
          .then((count) => setRemaining(Math.max(0, MAX_PROMO_ATTEMPTS_PER_DAY - count)))
          .catch(() => {});
      }
      const title =
        err?.code === 'resource-exhausted'
          ? '오늘 시도 횟수 초과'
          : err?.code === 'failed-precondition'
            ? '이미 프리미엄 회원'
            : err?.code === 'not-found'
              ? '유효하지 않은 코드'
              : err?.code === 'invalid-argument'
                ? '코드 형식 오류'
                : '오류';
      showInfoAlert(title, err?.message ?? '알 수 없는 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const onChangeText = (v: string) => {
    // 사용자가 입력할 때 자동으로 하이픈 포맷 (16자리 초과 시 자름)
    setRaw(formatPromoCode(v));
  };

  const isBlocked = remaining === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={promoStyles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={promoStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={promoStyles.head}>
            <Gift size={20} color={Colors.primary} strokeWidth={2.4} />
            <Text style={promoStyles.title}>프로모션 코드</Text>
          </View>
          <Text style={promoStyles.desc}>
            운영자가 발급한 16자리 코드를 입력하면{'\n'}영구 프리미엄이 활성화됩니다.
          </Text>

          <TextInput
            value={raw}
            onChangeText={onChangeText}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor={Colors.textMuted}
            style={[promoStyles.input, isBlocked && promoStyles.inputDisabled]}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy && !isBlocked}
            maxLength={PROMO_CODE_FORMATTED_LENGTH}
            selectTextOnFocus
          />

          {remaining !== null && (
            <Text style={[promoStyles.remaining, isBlocked && { color: Colors.danger }]}>
              {isBlocked
                ? `오늘 시도 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.`
                : `오늘 남은 시도: ${remaining}/${MAX_PROMO_ATTEMPTS_PER_DAY}`}
            </Text>
          )}

          <Pressable
            style={[promoStyles.submitBtn, !canSubmit && promoStyles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={promoStyles.submitBtnText}>코드 사용</Text>
            )}
          </Pressable>

          <Pressable onPress={busy ? undefined : onClose} hitSlop={10} style={promoStyles.cancelBtn} disabled={busy}>
            <Text style={promoStyles.cancelBtnText}>취소</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  closeBtn: { padding: 6 },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  crownWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF4D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 14,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
  },

  activeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#E4F3EB',
    borderRadius: 10,
    marginTop: 16,
  },
  activeText: { fontSize: 13, color: Colors.success, fontWeight: '800' },

  priceNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 14,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  skipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  skipBtnText: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
  promoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  promoLinkText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});

const promoStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '900', color: Colors.text },
  desc: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.text,
    backgroundColor: Colors.background,
    textAlign: 'center',
  },
  inputDisabled: {
    backgroundColor: Colors.divider,
    color: Colors.textMuted,
  },
  remaining: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.divider,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
});

const cardStyles = StyleSheet.create({
  card: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    paddingTop: 22,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -10,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  currentBadge: { left: 16 },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 14,
  },
  price: { fontSize: 26, fontWeight: '900', color: Colors.text },
  priceSub: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnDisabled: {
    backgroundColor: Colors.divider,
    borderColor: 'transparent',
  },
  actionBtnText: { fontSize: 14, fontWeight: '900' },
  featureList: { marginTop: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureLabel: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '600' },
});

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 30,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  optionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(11,46,90,0.06)' },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionTitle: { fontSize: 15, fontWeight: '900', color: Colors.text },
  optionDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  optionPrice: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  bestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  bestBadgeText: { fontSize: 9, color: '#fff', fontWeight: '900' },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 6,
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  restoreBtn: { paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  restoreBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
});
