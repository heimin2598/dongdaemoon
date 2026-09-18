import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import {
  adminCreateStore,
  approveAndActivateClaim,
  listClaimsByStatus,
  rejectClaim,
  resetClaimToPending,
} from '@/lib/merchantClaims';
import { deleteShop, listAllShops, setShopVerified } from '@/lib/shops';
import { getStoreByCode } from '@/data/stores';
import { showConfirmAlert, showInfoAlert } from '@/utils/alerts';
import type { MerchantClaim, Shop } from '@/types';

type Tab = 'pending' | 'approved' | 'rejected' | 'manage' | 'create';

const TAB_LABELS: Record<Tab, string> = {
  pending: '대기',
  approved: '승인 완료',
  rejected: '거절',
  manage: '삭제관리',
  create: '새로등록',
};

export default function AdminMerchantsScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);
  const [tab, setTab] = useState<Tab>('pending');

  // 어드민이 아니면 차단
  useEffect(() => {
    if (user && !isAdmin) {
      showInfoAlert('접근 권한 없음', '운영자 전용 페이지입니다.', () => router.back());
    }
  }, [user, isAdmin]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="매장 인증 관리" />
        <View style={styles.center}>
          <Text style={styles.muted}>운영자 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="매장 인증 관리" />

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((k) => (
            <TabPill key={k} label={TAB_LABELS[k]} active={tab === k} onPress={() => setTab(k)} />
          ))}
        </ScrollView>
      </View>

      {tab === 'pending' && <ClaimsList status="pending" />}
      {tab === 'approved' && <ClaimsList status="approved" />}
      {tab === 'rejected' && <ClaimsList status="rejected" />}
      {tab === 'manage' && <ManageShops />}
      {tab === 'create' && <CreateStore adminUid={user?.id ?? ''} />}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────
// 클레임 리스트 (대기/승인/거절 공통)
// ─────────────────────────────────────────────────────
function ClaimsList({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const reviewerUid = useAuthStore((s) => s.user?.id);
  const [items, setItems] = useState<MerchantClaim[]>([]);
  const [shopList, setShopList] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listClaimsByStatus(status);
      setItems(list);
      // 대기/승인 탭에 sh ops 동기화 — 대기는 미인증, 승인은 인증 완료
      if (status === 'pending') {
        const allShops = await listAllShops();
        setShopList(allShops.filter((s) => s.verified !== true));
      } else if (status === 'approved') {
        const allShops = await listAllShops();
        setShopList(allShops.filter((s) => s.verified === true));
      } else {
        setShopList([]);
      }
    } catch (e: any) {
      showInfoAlert('불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const onVerifyShop = async (s: Shop) => {
    setActing(s.id);
    try {
      await setShopVerified(s.id, true);
      await load();
      showInfoAlert('인증 완료', `'${s.displayName}' 매장을 인증 처리했습니다.`);
    } catch (e: any) {
      showInfoAlert('인증 실패', e?.message ?? '권한이 없거나 네트워크 오류입니다.');
    } finally {
      setActing(null);
    }
  };

  const onUnverifyShop = async (s: Shop) => {
    setActing(s.id);
    try {
      await setShopVerified(s.id, false);
      await load();
    } catch (e: any) {
      showInfoAlert('상태 변경 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setActing(null);
    }
  };

  const onRejectShop = (s: Shop) => {
    showConfirmAlert(
      '매장 거부',
      `'${s.displayName}' 매장 등록을 거부하시겠습니까?\n매장 doc 자체가 삭제되며 사장님은 다시 등록을 시도할 수 있습니다.`,
      async () => {
        setActing(s.id);
        try {
          await deleteShop(s.id);
          await load();
        } catch (e: any) {
          showInfoAlert('거부 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setActing(null);
        }
      },
      { confirmLabel: '거부', destructive: true },
    );
  };

  const onApprove = async (c: MerchantClaim) => {
    if (!reviewerUid) return;
    setActing(c.id);
    try {
      await approveAndActivateClaim(c, reviewerUid);
      await load();
      showInfoAlert('인증 완료', '매장 인증을 승인했습니다.');
    } catch (e: any) {
      showInfoAlert('승인 실패', e?.message ?? '권한이 없거나 네트워크 오류입니다.');
    } finally {
      setActing(null);
    }
  };

  const onReject = (c: MerchantClaim) => {
    if (!reviewerUid) return;
    showConfirmAlert(
      '인증 거부',
      '이 매장 인증 신청을 거부하시겠습니까?',
      async () => {
        setActing(c.id);
        try {
          await rejectClaim(c.id, reviewerUid);
          await load();
        } catch (e: any) {
          showInfoAlert('거부 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setActing(null);
        }
      },
      { confirmLabel: '거부', destructive: true },
    );
  };

  const onReset = async (c: MerchantClaim) => {
    setActing(c.id);
    try {
      await resetClaimToPending(c.id);
      await load();
    } catch (e: any) {
      showInfoAlert('상태 변경 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setActing(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />
      }
    >
      {loading && items.length === 0 && shopList.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : items.length === 0 && shopList.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {status === 'pending'
              ? '대기 중인 신청이 없습니다.'
              : status === 'approved'
                ? '승인된 신청이 없습니다.'
                : '거절된 신청이 없습니다.'}
          </Text>
        </View>
      ) : (
        <>
          {items.map((c) => (
            <ClaimCard
              key={c.id}
              c={c}
              busy={acting === c.id}
              onApprove={() => onApprove(c)}
              onReject={() => onReject(c)}
              onReset={() => onReset(c)}
            />
          ))}
          {(status === 'pending' || status === 'approved') && shopList.length > 0 && (
            <>
              <Text style={[styles.muted, { marginTop: 12, marginBottom: 4, fontWeight: '800' }]}>
                {status === 'pending'
                  ? `사장님이 직접 등록한 매장 (${shopList.length}) · 인증 대기`
                  : `인증 완료된 매장 (${shopList.length})`}
              </Text>
              {shopList.map((s) => {
                const isPending = s.verified !== true;
                return (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{s.displayName || '(이름 없음)'}</Text>
                        <Text style={styles.cardId}>코드 · {s.storeCodes.join(', ') || '-'}</Text>
                      </View>
                      <Text
                        style={[
                          styles.typeBadge,
                          isPending ? styles.typeBadgeNew : styles.typeBadgeExisting,
                        ]}
                      >
                        {isPending ? '미인증' : '인증 완료'}
                      </Text>
                    </View>
                    <Row label="전화" value={s.phone || '-'} />
                    <Row label="소개" value={s.description || '-'} />
                    <Row label="ownerUid" value={s.ownerUid} />
                    <View style={styles.cardActions}>
                      {isPending ? (
                        <>
                          <Button
                            label="인증 거부"
                            variant="danger"
                            onPress={() => onRejectShop(s)}
                            loading={acting === s.id}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="인증 완료"
                            onPress={() => onVerifyShop(s)}
                            loading={acting === s.id}
                            style={{ flex: 1 }}
                          />
                        </>
                      ) : (
                        <Button
                          label="인증 회수"
                          variant="secondary"
                          onPress={() => onUnverifyShop(s)}
                          loading={acting === s.id}
                          style={{ flex: 1 }}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ClaimCard({
  c,
  busy,
  onApprove,
  onReject,
  onReset,
}: {
  c: MerchantClaim;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const isNew = c.claimType === 'new';
  const dir = !isNew && c.storeCode ? getStoreByCode(c.storeCode) : undefined;
  const storeName = isNew ? (c.newStore?.name ?? '-') : (dir?.name ?? c.storeCode ?? '-');
  const storeLoc = isNew
    ? (c.newStore?.address ?? '-')
    : (dir?.location ??
      (`${dir?.building ?? ''} ${dir?.floor ?? ''} ${dir?.unit ?? ''}`.trim() ||
       '-'));
  const storePhone = isNew ? (c.newStore?.phone ?? '-') : (dir?.phone ?? '-');

  const callApplicant = () => {
    if (!c.applicantPhone) return;
    Linking.openURL(`tel:${c.applicantPhone}`).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{storeName}</Text>
          <Text style={styles.cardId}>
            ID · <Text style={styles.cardIdStrong}>{c.shortId}</Text>
          </Text>
        </View>
        <Text style={[styles.typeBadge, isNew ? styles.typeBadgeNew : styles.typeBadgeExisting]}>
          {isNew ? '신규 등록' : '기존 매칭'}
        </Text>
      </View>

      <Section title="가입 신청자">
        <Row label="이름" value={c.applicantName || '-'} />
        <Row label="전화" value={c.applicantPhone || '-'} />
        <Row label="이메일" value={c.applicantEmail || '-'} />
      </Section>

      <Section title="매장 등록 정보">
        <Row label="매장명" value={storeName} />
        <Row label="전화" value={storePhone} />
        <Row label="주소" value={storeLoc} />
        {isNew && c.newStore?.category ? <Row label="카테고리" value={c.newStore.category} /> : null}
        {isNew && c.newStore?.description ? (
          <Row label="소개" value={c.newStore.description} />
        ) : null}
      </Section>

      <Row
        label="신청일"
        value={new Date(c.createdAt).toLocaleString('ko-KR')}
      />
      {c.status === 'rejected' && c.rejectReason ? (
        <Row label="거부 사유" value={c.rejectReason} />
      ) : null}

      {c.applicantPhone && (
        <Pressable style={styles.callBtn} onPress={callApplicant}>
          <Phone size={16} color={Colors.primary} strokeWidth={2.4} />
          <Text style={styles.callBtnText}>확인 전화</Text>
        </Pressable>
      )}

      <View style={styles.cardActions}>
        {c.status === 'pending' && (
          <>
            <Button label="인증 거부" variant="danger" onPress={onReject} loading={busy} style={{ flex: 1 }} />
            <Button label="인증 완료" onPress={onApprove} loading={busy} style={{ flex: 1 }} />
          </>
        )}
        {c.status === 'approved' && (
          <Button label="대기로 되돌리기" variant="secondary" onPress={onReset} loading={busy} style={{ flex: 1 }} />
        )}
        {c.status === 'rejected' && (
          <>
            <Button label="다시 승인" onPress={onApprove} loading={busy} style={{ flex: 1 }} />
            <Button label="대기로 되돌리기" variant="secondary" onPress={onReset} loading={busy} style={{ flex: 1 }} />
          </>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// 삭제관리 — 등록된 shops 검색 + 삭제
// ─────────────────────────────────────────────────────
function ManageShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllShops();
      setShops(list);
    } catch (e: any) {
      showInfoAlert('불러오기 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) => {
      if (s.displayName.toLowerCase().includes(q)) return true;
      if (s.phone.includes(q)) return true;
      if (s.storeCodes.some((c) => c.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [shops, query]);

  const onDelete = (s: Shop) => {
    showConfirmAlert(
      '매장 삭제',
      `'${s.displayName || s.id}'\n매장을 DB에서 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
      async () => {
        setDeleting(s.id);
        try {
          await deleteShop(s.id);
          await load();
        } catch (e: any) {
          showInfoAlert('삭제 실패', e?.message ?? '권한이 없거나 네트워크 오류입니다.');
        } finally {
          setDeleting(null);
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />
      }
    >
      <TextInput placeholder="매장명·전화·코드 검색" value={query} onChangeText={setQuery} />
      <Text style={styles.muted}>{filtered.length}건</Text>

      {loading && shops.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {shops.length === 0 ? '등록된 매장이 없습니다.' : '검색 결과가 없습니다.'}
          </Text>
        </View>
      ) : (
        filtered.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.displayName || '(이름 없음)'}</Text>
                <Text style={styles.cardId}>{s.storeCodes.join(', ') || '코드 없음'}</Text>
              </View>
              <Pressable
                style={styles.iconBtn}
                onPress={() => onDelete(s)}
                disabled={deleting === s.id}
              >
                {deleting === s.id ? (
                  <ActivityIndicator color={Colors.danger} />
                ) : (
                  <Trash2 size={18} color={Colors.danger} strokeWidth={2.2} />
                )}
              </Pressable>
            </View>
            <Row label="전화" value={s.phone || '-'} />
            <Row label="소개" value={s.description || '-'} />
            <Row label="ownerUid" value={s.ownerUid} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────
// 새로등록 — 운영자가 직접 매장 추가
// ─────────────────────────────────────────────────────
function CreateStore({ adminUid }: { adminUid: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 9;

  const onSubmit = async () => {
    if (!adminUid) return;
    setSaving(true);
    try {
      const id = await adminCreateStore({
        adminUid,
        displayName: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        description: description.trim() || undefined,
        storeCode: storeCode.trim() || undefined,
      });
      showInfoAlert('등록 완료', `새 매장이 등록되었습니다.\n(shopId: ${id})`);
      setName('');
      setPhone('');
      setAddress('');
      setStoreCode('');
      setDescription('');
    } catch (e: any) {
      showInfoAlert('등록 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.muted}>
          운영자가 직접 매장을 DB에 추가합니다. 사장님 회원가입 없이 등록되며,{'\n'}
          나중에 사장님이 매칭 신청 시 ownerUid 를 변경하면 됩니다.
        </Text>
        <TextInput label="매장명 *" placeholder="예: 동대문 단추가게" value={name} onChangeText={setName} />
        <TextInput
          label="전화번호 *"
          placeholder="01012345678"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          label="storeCode (선택)"
          placeholder="비워두면 자동 생성"
          autoCapitalize="characters"
          value={storeCode}
          onChangeText={setStoreCode}
        />
        <TextInput label="주소" placeholder="예: 동대문 종합시장 B동 4층 215호" value={address} onChangeText={setAddress} />
        <TextInput
          label="소개"
          placeholder="매장 소개·취급 품목"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Button
          label={saving ? '등록 중...' : '+ 새 매장 등록'}
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────
// 공통 컴포넌트
// ─────────────────────────────────────────────────────
function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        active && styles.tabPillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.tabPillLabel, active && styles.tabPillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 4 }}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  tabsWrap: { borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.surface },
  tabs: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tabPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabPillLabel: { fontSize: 12, fontWeight: '700', color: Colors.text },
  tabPillLabelActive: { color: '#fff' },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 4, lineHeight: 17 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardId: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardIdStrong: { color: Colors.primary, fontWeight: '800' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  typeBadgeNew: { backgroundColor: '#FBE4E4', color: Colors.danger },
  typeBadgeExisting: { backgroundColor: '#E0EAFE', color: Colors.primary },
  section: { marginTop: 4, gap: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1, gap: 8 },
  rowLabel: { width: 72, fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '600' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 4,
  },
  callBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  iconBtn: { padding: 6, marginLeft: 8 },
});
