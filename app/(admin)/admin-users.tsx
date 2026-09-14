import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ban,
  Crown,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import {
  adminDeleteUserDoc,
  adminDisableUser,
  adminEnableUser,
  adminGrantPremium,
  adminRevokePremium,
  isActivePremium,
  listAllUsersWithEntitlement,
  UserListItem,
} from '@/lib/entitlement';
import { showConfirmAlert, showInfoAlert } from '@/utils/alerts';

/**
 * 회원 관리 (관리자 포털).
 * 인증/권한 게이트는 (admin)/_layout.tsx 가 처리.
 *
 * 상단 탭: 전체 / 무료 / 프리미엄 / 사장님(활성) / 방문자
 * 카드 그리드: 반응형 (좁은 창 1열, 중간 2열, 넓은 창 3열)
 * 카드 액션: 프리미엄 전환/회수, 차단/해제, 탈퇴
 */

type TabKey = 'all' | 'free' | 'premium' | 'merchant' | 'visitor';

const TAB_ORDER: TabKey[] = ['all', 'free', 'premium', 'merchant', 'visitor'];
const TAB_LABEL: Record<TabKey, string> = {
  all: '전체',
  free: '무료 회원',
  premium: '프리미엄',
  merchant: '사장님',
  visitor: '방문자',
};

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [editTarget, setEditTarget] = useState<UserListItem | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllUsersWithEntitlement();
      setUsers(list);
    } catch (e: any) {
      const code = e?.code ?? '';
      const isPerm = code === 'permission-denied' || /permission/i.test(e?.message ?? '');
      showInfoAlert(
        '불러오기 실패',
        isPerm
          ? '회원 목록 조회 권한이 없습니다. firestore.rules 의 admin 설정을 확인하세요.'
          : e?.message ?? String(e),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, free: 0, premium: 0, merchant: 0, visitor: 0 };
    for (const u of users) {
      c.all += 1;
      const active = isActivePremium(u.entitlement);
      if (active) c.premium += 1;
      else c.free += 1;
      if (u.role === 'merchant' && u.status === 'active') c.merchant += 1;
      if (u.role === 'visitor') c.visitor += 1;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const active = isActivePremium(u.entitlement);
      switch (tab) {
        case 'premium':
          if (!active) return false;
          break;
        case 'free':
          if (active) return false;
          break;
        case 'merchant':
          if (u.role !== 'merchant' || u.status !== 'active') return false;
          break;
        case 'visitor':
          if (u.role !== 'visitor') return false;
          break;
        default:
          break;
      }
      if (q) {
        const hay = `${u.email} ${u.displayName ?? ''} ${u.shortId ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, tab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="회원 관리"
        showBack={false}
        rightSlot={
          <Pressable onPress={load} hitSlop={10} disabled={loading}>
            <RefreshCw size={18} color={loading ? Colors.textMuted : Colors.primary} strokeWidth={2.2} />
          </Pressable>
        }
      />

      {/* 탭 바 */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TAB_ORDER.map((k) => (
            <Pressable
              key={k}
              style={[styles.tabItem, tab === k && styles.tabItemActive]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {TAB_LABEL[k]} <Text style={styles.tabCount}>({counts[k]})</Text>
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 검색 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2.2} />
          <RNTextInput
            placeholder="이름 · 이메일 · ID 검색"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Text style={styles.resultCount}>{filtered.length}명 / 전체 {users.length}명</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />
        }
      >
        {loading && users.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <UserIcon size={40} color={Colors.textMuted} strokeWidth={1.6} />
            <Text style={styles.muted}>
              {users.length === 0 ? '회원이 없습니다.' : '조건에 맞는 회원이 없습니다.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((u) => (
              <UserCard
                key={u.uid}
                u={u}
                busy={acting === u.uid}
                onGrant={() => setEditTarget(u)}
                onToggleDisabled={async () => {
                  setActing(u.uid);
                  try {
                    if (u.disabled) await adminEnableUser(u.uid);
                    else await adminDisableUser(u.uid);
                    await load();
                  } catch (e: any) {
                    showInfoAlert('처리 실패', e?.message ?? '네트워크 오류입니다.');
                  } finally {
                    setActing(null);
                  }
                }}
                onDelete={() =>
                  showConfirmAlert(
                    '회원 탈퇴 처리',
                    `${u.email}\n회원 데이터(프로필·entitlement)를 영구 삭제합니다.\nFirebase Auth 계정은 별도로 콘솔에서 삭제해야 합니다.`,
                    async () => {
                      setActing(u.uid);
                      try {
                        await adminDeleteUserDoc(u.uid);
                        await load();
                        showInfoAlert(
                          '탈퇴 완료',
                          'Firebase Console → Authentication 에서 해당 계정도 함께 삭제해 주세요.',
                        );
                      } catch (e: any) {
                        showInfoAlert('삭제 실패', e?.message ?? '네트워크 오류입니다.');
                      } finally {
                        setActing(null);
                      }
                    },
                    { confirmLabel: '탈퇴 처리', destructive: true },
                  )
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      {editTarget && (
        <PremiumEditModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onChanged={async () => {
            setEditTarget(null);
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────
// 회원 카드
// ─────────────────────────────────────────────────────
function UserCard({
  u,
  busy,
  onGrant,
  onToggleDisabled,
  onDelete,
}: {
  u: UserListItem;
  busy: boolean;
  onGrant: () => void;
  onToggleDisabled: () => void;
  onDelete: () => void;
}) {
  const active = isActivePremium(u.entitlement);
  const roleLabel =
    u.role === 'merchant' ? (u.status === 'active' ? '사장님' : '사장님 (대기)') : '방문자';
  const expiry = (() => {
    if (!u.entitlement) return null;
    if (u.entitlement.grandfathered) return '평생 무료';
    if (!u.entitlement.expiresAt) return null;
    return new Date(u.entitlement.expiresAt).toLocaleDateString('ko-KR');
  })();
  const sourceLabel =
    u.entitlement?.source === 'apple'
      ? 'Apple'
      : u.entitlement?.source === 'google'
        ? 'Google'
        : u.entitlement?.source === 'manual'
          ? '운영자'
          : u.entitlement?.source === 'promo'
            ? '프로모션'
            : u.entitlement?.source === 'trial'
              ? '무료 체험'
              : '무료';

  return (
    <View style={[styles.card, u.disabled && styles.cardDisabled]}>
      {/* 헤더 — 이름/이메일/plan pill */}
      <View style={styles.cardHead}>
        <View style={styles.avatarBox}>
          {active ? (
            <Crown size={18} color="#A66A00" strokeWidth={2.4} />
          ) : (
            <UserIcon size={18} color={Colors.primary} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {u.displayName || '(닉네임 없음)'}
            </Text>
            {u.shortId && (
              <View style={styles.shortIdChip}>
                <Text style={styles.shortIdText}>ID · {u.shortId}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
        </View>
      </View>

      {/* 상태 배지 */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, active ? styles.badgePremium : styles.badgeFree]}>
          <Text style={[styles.badgeText, active ? styles.badgeTextPremium : undefined]}>
            {active ? '프리미엄' : '무료'}
          </Text>
        </View>
        <View style={styles.badgeRole}>
          <Text style={styles.badgeRoleText}>{roleLabel}</Text>
        </View>
        {u.disabled && (
          <View style={styles.badgeDanger}>
            <Ban size={10} color="#fff" strokeWidth={2.4} />
            <Text style={styles.badgeDangerText}>차단됨</Text>
          </View>
        )}
      </View>

      {/* 메타 정보 */}
      <View style={styles.metaBox}>
        {u.createdAt && (
          <Text style={styles.metaLine}>
            가입 · <Text style={styles.metaStrong}>{new Date(u.createdAt).toLocaleString('ko-KR')}</Text>
          </Text>
        )}
        {active && (
          <Text style={styles.metaLine}>
            만료 · <Text style={styles.metaStrong}>{expiry ?? '-'}</Text>{' '}
            <Text style={styles.metaMuted}>({sourceLabel})</Text>
          </Text>
        )}
      </View>

      {/* 액션 버튼 그리드 */}
      <View style={styles.actionGrid}>
        <Pressable
          style={[styles.actionBtn, styles.actionPrimary, busy && { opacity: 0.5 }]}
          onPress={onGrant}
          disabled={busy}
        >
          <Crown size={13} color="#fff" strokeWidth={2.2} />
          <Text style={styles.actionPrimaryText}>{active ? '프리미엄 변경' : '프리미엄 전환'}</Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionBtn,
            u.disabled ? styles.actionOutline : styles.actionSecondary,
            busy && { opacity: 0.5 },
          ]}
          onPress={onToggleDisabled}
          disabled={busy}
        >
          {u.disabled ? (
            <Text style={styles.actionOutlineText}>차단 풀기</Text>
          ) : (
            <>
              <Ban size={13} color="#fff" strokeWidth={2.2} />
              <Text style={styles.actionSecondaryText}>차단</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.actionDanger, busy && { opacity: 0.5 }]}
          onPress={onDelete}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Trash2 size={13} color="#fff" strokeWidth={2.2} />
              <Text style={styles.actionDangerText}>탈퇴 처리</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// 프리미엄 부여 / 회수 모달 (기존 로직 유지)
// ─────────────────────────────────────────────────────
type GrantPreset = '1month' | '3month' | '6month' | '1year' | 'lifetime';

const GRANT_OPTIONS: Array<{ key: GrantPreset; label: string; days?: number; lifetime?: boolean }> = [
  { key: '1month', label: '1개월', days: 30 },
  { key: '3month', label: '3개월', days: 90 },
  { key: '6month', label: '6개월', days: 180 },
  { key: '1year', label: '1년', days: 365 },
  { key: 'lifetime', label: '평생', lifetime: true },
];

function PremiumEditModal({
  user,
  onClose,
  onChanged,
}: {
  user: UserListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const apply = async (preset: GrantPreset) => {
    if (busy) return;
    const opt = GRANT_OPTIONS.find((o) => o.key === preset);
    if (!opt) return;
    const newExpiry = opt.lifetime ? null : Date.now() + (opt.days ?? 0) * 24 * 60 * 60 * 1000;
    setBusy(true);
    try {
      await adminGrantPremium({ uid: user.uid, expiresAt: newExpiry, source: 'manual' });
      onChanged();
    } catch (e: any) {
      showInfoAlert('적용 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  const extend = async (days: number) => {
    if (busy) return;
    const base =
      user.entitlement?.expiresAt && user.entitlement.expiresAt > Date.now()
        ? user.entitlement.expiresAt
        : Date.now();
    const newExpiry = base + days * 24 * 60 * 60 * 1000;
    setBusy(true);
    try {
      await adminGrantPremium({ uid: user.uid, expiresAt: newExpiry, source: 'manual' });
      onChanged();
    } catch (e: any) {
      showInfoAlert('적용 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = () => {
    showConfirmAlert(
      '프리미엄 회수',
      '이 회원의 프리미엄 권한을 즉시 회수합니다.',
      async () => {
        setBusy(true);
        try {
          await adminRevokePremium(user.uid);
          onChanged();
        } catch (e: any) {
          showInfoAlert('회수 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: '회수', destructive: true },
    );
  };

  const isCurrentlyPremium = isActivePremium(user.entitlement);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.head}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title}>프리미엄 관리</Text>
              <Text style={modalStyles.subtitle} numberOfLines={1}>
                {user.displayName ?? user.email}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} disabled={busy}>
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>

          <Text style={modalStyles.sectionLabel}>플랜 설정</Text>
          <View style={modalStyles.grid}>
            {GRANT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => apply(opt.key)}
                disabled={busy}
                style={({ pressed }) => [
                  modalStyles.gridBtn,
                  pressed && { opacity: 0.85 },
                  busy && { opacity: 0.5 },
                ]}
              >
                <Text style={modalStyles.gridBtnLabel}>{opt.label}</Text>
                <Text style={modalStyles.gridBtnSub}>
                  {opt.lifetime ? '평생 무료' : `오늘부터 +${opt.days}일`}
                </Text>
              </Pressable>
            ))}
          </View>

          {isCurrentlyPremium && (
            <>
              <Text style={modalStyles.sectionLabel}>기존 만료일에서 연장</Text>
              <View style={modalStyles.extendRow}>
                <Pressable onPress={() => extend(30)} disabled={busy} style={modalStyles.extendBtn}>
                  <Text style={modalStyles.extendBtnText}>+30일</Text>
                </Pressable>
                <Pressable onPress={() => extend(90)} disabled={busy} style={modalStyles.extendBtn}>
                  <Text style={modalStyles.extendBtnText}>+90일</Text>
                </Pressable>
                <Pressable onPress={() => extend(365)} disabled={busy} style={modalStyles.extendBtn}>
                  <Text style={modalStyles.extendBtnText}>+365일</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={{ height: 16 }} />
          <Button
            label="프리미엄 회수"
            variant="danger"
            onPress={revoke}
            disabled={busy || !isCurrentlyPremium}
          />

          {busy && (
            <View style={modalStyles.busyOverlay}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // 탭 바
  tabBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tabRow: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '800',
  },
  tabTextActive: { color: Colors.primary },
  tabCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  // 검색
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.text },
  resultCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },

  // 컨텐츠
  scroll: { padding: 16, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  muted: { fontSize: 13, color: Colors.textMuted },

  // 그리드
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // 카드
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    minWidth: 300,
    flexGrow: 1,
    flexBasis: 300,
    maxWidth: '100%',
  },
  cardDisabled: {
    backgroundColor: '#FBF6F6',
    borderColor: '#F0D5D5',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF0FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '900', color: Colors.text, flexShrink: 1 },
  shortIdChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EBF0FA',
  },
  shortIdText: { fontSize: 10, color: Colors.primary, fontWeight: '900' },
  cardEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeFree: { backgroundColor: Colors.divider },
  badgePremium: { backgroundColor: '#FFF1CC', borderWidth: 1, borderColor: '#E5B83C' },
  badgeText: { fontSize: 11, color: Colors.text, fontWeight: '800' },
  badgeTextPremium: { color: '#A66A00' },
  badgeRole: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#EBF0FA',
  },
  badgeRoleText: { fontSize: 11, color: Colors.primary, fontWeight: '800' },
  badgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.danger,
  },
  badgeDangerText: { fontSize: 11, color: '#fff', fontWeight: '800' },

  metaBox: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  metaLine: { fontSize: 11, color: Colors.textMuted },
  metaStrong: { color: Colors.text, fontWeight: '700' },
  metaMuted: { color: Colors.textMuted, fontStyle: 'italic' },

  actionGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  actionPrimary: { backgroundColor: '#0B2E5A' }, // 딥 네이비
  actionPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  actionSecondary: { backgroundColor: Colors.primary },
  actionSecondaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  actionOutline: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionOutlineText: { color: Colors.text, fontSize: 12, fontWeight: '900' },
  actionDanger: { backgroundColor: Colors.danger },
  actionDangerText: { color: '#fff', fontSize: 12, fontWeight: '900' },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: { fontSize: 17, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridBtn: {
    width: '31.5%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  gridBtnLabel: { fontSize: 14, fontWeight: '900', color: Colors.text },
  gridBtnSub: { fontSize: 10, color: Colors.textMuted },
  extendRow: { flexDirection: 'row', gap: 8 },
  extendBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  extendBtnText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
  },
});
