import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Gift, Lock, LogOut, Plus, Shield, Trash2, X } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { signInWithEmail } from '@/lib/auth/firebaseAuth';
import {
  adminCreatePromoCode,
  adminDeletePromoCode,
  adminListPromoCodes,
  adminSetPromoCode,
  formatPromoCode,
  normalizePromoCode,
  PROMO_CODE_FORMATTED_LENGTH,
  PromoCode,
} from '@/lib/promoCodes';
import { showConfirmAlert, showInfoAlert } from '@/utils/alerts';

type FilterMode = 'all' | 'unused' | 'used';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: '전체',
  unused: '미사용',
  used: '사용됨',
};

export default function AdminPromoCodesScreen() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [creating, setCreating] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const fetchList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const list = await adminListPromoCodes();
      setItems(list);
    } catch (e: any) {
      showInfoAlert('불러오기 실패', e?.message ?? '네트워크 오류');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetchList().finally(() => setLoading(false));
  }, [isAdmin, fetchList]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  };

  const onCreateRandom = async () => {
    if (!me) return;
    if (creating) return;
    setCreating(true);
    try {
      const code = await adminCreatePromoCode({ createdBy: me.id });
      await fetchList();
      const formatted = formatPromoCode(code);
      showInfoAlert(
        '코드 생성 완료',
        `${formatted}\n\n(클립보드에 자동 복사됨)`,
      );
      try {
        Clipboard.setStringAsync(formatted);
      } catch {}
    } catch (e: any) {
      showInfoAlert('생성 실패', e?.message ?? '네트워크 오류');
    } finally {
      setCreating(false);
    }
  };

  const onDelete = (code: string) => {
    showConfirmAlert(
      '코드 삭제',
      `${formatPromoCode(code)} 코드를 삭제합니다.\n미사용 코드만 삭제 가능합니다.`,
      async () => {
        try {
          await adminDeletePromoCode(code);
          await fetchList();
        } catch (e: any) {
          showInfoAlert('삭제 실패', e?.message ?? '네트워크 오류');
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  const onCopy = (code: string) => {
    try {
      Clipboard.setStringAsync(formatPromoCode(code));
      showInfoAlert('복사됨', `${formatPromoCode(code)}\n\n클립보드에 복사되었습니다.`);
    } catch (e: any) {
      showInfoAlert('복사 실패', e?.message ?? '오류');
    }
  };

  // 인증/권한 체크는 (admin)/_layout.tsx 가 처리 — 여기 도달했다는 건 이미 관리자.

  const filtered = items.filter((c) => {
    if (filter === 'used') return !!c.usedBy;
    if (filter === 'unused') return !c.usedBy;
    return true;
  });

  const stats = {
    total: items.length,
    used: items.filter((c) => !!c.usedBy).length,
    unused: items.filter((c) => !c.usedBy).length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="프로모션 코드"
        rightSlot={
          <Pressable
            onPress={() =>
              showConfirmAlert('로그아웃', '관리자 세션을 종료합니다.', () =>
                useAuthStore.getState().signOut(),
              )
            }
            hitSlop={10}
          >
            <LogOut size={20} color={Colors.text} strokeWidth={2} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsRow}>
          <StatCell label="전체" value={stats.total} />
          <StatCell label="미사용" value={stats.unused} color={Colors.primary} />
          <StatCell label="사용됨" value={stats.used} color={Colors.textMuted} />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary, creating && { opacity: 0.5 }]}
            onPress={onCreateRandom}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus size={16} color="#fff" strokeWidth={2.4} />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>랜덤 코드 생성</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => setManualOpen(true)}
          >
            <Text style={[styles.actionBtnText, { color: Colors.text }]}>수동 코드 등록</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Gift size={32} color={Colors.textMuted} strokeWidth={1.6} />
            <Text style={styles.emptyText}>
              {items.length === 0 ? '생성된 코드가 없습니다.' : '조건에 맞는 코드가 없습니다.'}
            </Text>
          </View>
        ) : (
          filtered.map((c) => (
            <CodeCard key={c.code} c={c} onCopy={() => onCopy(c.code)} onDelete={() => onDelete(c.code)} />
          ))
        )}
      </ScrollView>

      <ManualCodeModal
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false);
          fetchList();
        }}
      />
    </SafeAreaView>
  );
}

function AdminLoginGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  const onLogin = async () => {
    if (busy) return;
    setErr(null);
    if (!email.trim() || !password) {
      setErr('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      // useAuthStore.user 갱신은 onAuthStateChanged 리스너가 자동. 잠시 후 이 컴포넌트가 리렌더 → admin 체크로 진행.
    } catch (e: unknown) {
      const errObj = e as { code?: string; message?: string };
      const code = errObj?.code ?? '';
      const msg =
        code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : code.includes('too-many-requests')
            ? '잠시 후 다시 시도해 주세요.'
            : (errObj?.message ?? '로그인 실패');
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={loginStyles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={loginStyles.scroll} keyboardShouldPersistTaps="handled">
        <View style={loginStyles.card}>
          <View style={loginStyles.iconBox}>
            <Lock size={28} color={Colors.primary} strokeWidth={2} />
          </View>
          <Text style={loginStyles.title}>운영자 로그인</Text>
          <Text style={loginStyles.desc}>
            프로모션 코드 관리 페이지에 접근하려면{'\n'}관리자 계정으로 로그인해 주세요.
          </Text>

          <View style={loginStyles.field}>
            <Text style={loginStyles.label}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              placeholderTextColor={Colors.textMuted}
              style={loginStyles.input}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              onSubmitEditing={onLogin}
              returnKeyType="next"
            />
          </View>

          <View style={loginStyles.field}>
            <Text style={loginStyles.label}>비밀번호</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              placeholderTextColor={Colors.textMuted}
              style={loginStyles.input}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={onLogin}
              returnKeyType="go"
            />
          </View>

          {err && (
            <View style={loginStyles.errorBox}>
              <Text style={loginStyles.errorText}>{err}</Text>
            </View>
          )}

          <Pressable
            style={[loginStyles.btn, busy && { opacity: 0.5 }]}
            onPress={onLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={loginStyles.btnText}>로그인</Text>
            )}
          </Pressable>

          {isWeb && (
            <Text style={loginStyles.note}>
              관리자 권한이 없는 계정은 로그인 후 접근이 차단됩니다.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CodeCard({
  c,
  onCopy,
  onDelete,
}: {
  c: PromoCode;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const used = !!c.usedBy;
  return (
    <View style={[styles.card, used && styles.cardUsed]}>
      <View style={styles.cardHead}>
        <Text selectable style={[styles.codeText, used && styles.codeTextUsed]}>
          {formatPromoCode(c.code)}
        </Text>
        <View style={[styles.badge, used ? styles.badgeUsed : styles.badgeUnused]}>
          <Text style={styles.badgeText}>{used ? '사용됨' : '미사용'}</Text>
        </View>
      </View>

      {c.note ? <Text style={styles.noteText}>{c.note}</Text> : null}

      <View style={styles.metaRow}>
        {c.createdAt && (
          <Text style={styles.metaText}>
            생성 {new Date(c.createdAt).toLocaleDateString('ko-KR')}
          </Text>
        )}
        {c.usedAt && (
          <Text style={styles.metaText}>
            사용 {new Date(c.usedAt).toLocaleDateString('ko-KR')}
          </Text>
        )}
      </View>

      {c.usedBy && (
        <Text style={styles.usedByText} numberOfLines={1}>사용자 UID: {c.usedBy}</Text>
      )}

      <View style={styles.cardActionsRow}>
        {!used && (
          <Pressable style={styles.smallBtn} onPress={onCopy} hitSlop={6}>
            <Copy size={14} color={Colors.primary} strokeWidth={2.2} />
            <Text style={styles.smallBtnText}>복사</Text>
          </Pressable>
        )}
        {!used && (
          <Pressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={onDelete} hitSlop={6}>
            <Trash2 size={14} color={Colors.danger} strokeWidth={2.2} />
            <Text style={[styles.smallBtnText, { color: Colors.danger }]}>삭제</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ManualCodeModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const normalized = normalizePromoCode(raw);
  const canSubmit = !!normalized && !busy;

  const onSubmit = async () => {
    if (!me || !normalized) return;
    setBusy(true);
    try {
      await adminSetPromoCode({ code: normalized, createdBy: me.id, note });
      setRaw('');
      setNote('');
      onCreated();
    } catch (e: any) {
      showInfoAlert('등록 실패', e?.message ?? '오류');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={modalStyles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={modalStyles.head}>
            <Text style={modalStyles.title}>수동 코드 등록</Text>
            <Pressable onPress={busy ? undefined : onClose} hitSlop={8}>
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>
          <Text style={modalStyles.desc}>16자리 알파벳/숫자를 입력합니다. 하이픈은 자동 삽입.</Text>

          <TextInput
            value={raw}
            onChangeText={(v) => setRaw(formatPromoCode(v))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor={Colors.textMuted}
            style={modalStyles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            maxLength={PROMO_CODE_FORMATTED_LENGTH}
          />

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="메모 (선택 · 예: 김철수 VIP 지급)"
            placeholderTextColor={Colors.textMuted}
            style={modalStyles.noteInput}
            editable={!busy}
            maxLength={200}
          />

          <Pressable
            style={[modalStyles.submitBtn, !canSubmit && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={modalStyles.submitBtnText}>등록</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 },
  center: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  centerDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCell: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: { fontSize: 13, fontWeight: '900' },

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },

  emptyBox: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 10,
  },
  cardUsed: {
    backgroundColor: '#F7F7F7',
    borderColor: Colors.divider,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.6,
  },
  codeTextUsed: { color: Colors.textMuted },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeUnused: { backgroundColor: Colors.primary },
  badgeUsed: { backgroundColor: Colors.divider },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  noteText: { fontSize: 12, color: Colors.text },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 11, color: Colors.textMuted },
  usedByText: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },

  cardActionsRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  smallBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  smallBtnDanger: { borderColor: '#F6D5D5', backgroundColor: '#FDF3F3' },
  smallBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
});

const loginStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 28,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  iconBox: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EBF0FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  field: { gap: 6 },
  label: { fontSize: 12, color: Colors.text, fontWeight: '800' },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5C3C3',
  },
  errorText: { fontSize: 12, color: Colors.danger, fontWeight: '700' },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  note: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});

const modalStyles = StyleSheet.create({
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '900', color: Colors.text },
  desc: { fontSize: 12, color: Colors.textMuted },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.text,
    backgroundColor: Colors.background,
    textAlign: 'center',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
