import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageCircle,
  QrCode,
  Search as SearchIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { QrScanner } from '@/components/common/QrScanner';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { subscribeMyShops } from '@/lib/shops';
import {
  addCustomer,
  CustomerRecord,
  removeCustomer,
  subscribeMyAllCustomers,
  updateCustomerMemo,
} from '@/lib/customers';
import {
  createCustomerRequest,
  dismissRejectedRequest,
  lookupUserByShortId,
  processApprovedRequest,
  subscribeMerchantRequests,
  type CustomerRequest,
  type UserLookupResult,
} from '@/lib/customerRequests';
import { decodeQr } from '@/lib/qrPayload';
import { ensureChat } from '@/lib/chats';
import {
  FEATURE_MESSENGER_ENABLED,
  MESSENGER_COMING_SOON_BODY,
  MESSENGER_COMING_SOON_TITLE,
} from '@/constants/features';
import { showConfirmAlert, showInfoAlert } from '@/utils/alerts';
import type { Shop } from '@/types';

export default function CustomersTab() {
  const user = useAuthStore((s) => s.user);
  const [shops, setShops] = useState<Shop[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerRecord | null>(null);
  const [busy, setBusy] = useState(false);
  // shortId 검색 결과 + 등록 요청 흐름
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);
  const [searchTriedQuery, setSearchTriedQuery] = useState<string>('');
  const [requestBusy, setRequestBusy] = useState(false);
  // 본인이 보낸 요청 목록 (pending/approved/rejected)
  const [requests, setRequests] = useState<CustomerRequest[]>([]);

  // 사장님의 shops 구독
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyShops(user.id, setShops);
    return () => unsub();
  }, [user]);

  // shops 의 customers 합쳐서 구독
  useEffect(() => {
    if (shops.length === 0) {
      setCustomers([]);
      return;
    }
    const ids = shops.map((s) => s.id);
    const unsub = subscribeMyAllCustomers(ids, setCustomers);
    return () => unsub();
  }, [shops]);

  // 본인이 보낸 customerRequests 구독 — approved 자동 처리, rejected 안내
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMerchantRequests(user.id, async (list) => {
      setRequests(list);
      for (const r of list) {
        if (r.status === 'approved') {
          await processApprovedRequest(r);
          showInfoAlert('고객 추가 완료', `${r.customerDisplayName} 님이 승인했습니다.`);
        } else if (r.status === 'rejected') {
          await dismissRejectedRequest(r.id);
          showInfoAlert('요청 거절', `${r.customerDisplayName} 님이 요청을 거절했습니다.`);
        }
      }
    });
    return () => unsub();
  }, [user]);

  // shortId 검색 — 5자 입력 시 자동 조회
  useEffect(() => {
    const q = search.trim().toUpperCase();
    // 5자리 영문/숫자만 lookup 시도
    if (!/^[A-Z0-9]{5}$/.test(q)) {
      setSearchResult(null);
      setSearchTriedQuery('');
      return;
    }
    let alive = true;
    setSearching(true);
    setSearchTriedQuery(q);
    lookupUserByShortId(q)
      .then((res) => {
        if (alive) setSearchResult(res);
      })
      .catch(() => {
        if (alive) setSearchResult(null);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
    };
  }, [search]);

  // 이미 등록되었거나 pending 요청이 있는 고객은 중복 차단
  const targetAlreadyHandled = (uid: string): 'added' | 'pending' | null => {
    if (customers?.some((c) => c.uid === uid)) return 'added';
    if (requests.some((r) => r.customerUid === uid && r.status === 'pending')) return 'pending';
    return null;
  };

  const onSendRequest = async () => {
    if (!user || !searchResult) return;
    const shop = shops[0];
    if (!shop) {
      showInfoAlert('매장 없음', '먼저 매장을 등록해 주세요.');
      return;
    }
    const dup = targetAlreadyHandled(searchResult.uid);
    if (dup === 'added') {
      showInfoAlert('이미 등록됨', '이 고객은 이미 등록되어 있습니다.');
      return;
    }
    if (dup === 'pending') {
      showInfoAlert('요청 대기중', '이미 보낸 요청이 있어요. 고객 승인을 기다려 주세요.');
      return;
    }
    setRequestBusy(true);
    try {
      await createCustomerRequest({
        merchantUid: user.id,
        merchantDisplayName: user.displayName ?? undefined,
        shopId: shop.id,
        shopDisplayName: shop.displayName || '매장',
        customerUid: searchResult.uid,
        customerShortId: searchResult.shortId,
        customerDisplayName: searchResult.displayName ?? '(이름 미상)',
      });
      showInfoAlert(
        '요청 보냄',
        `${searchResult.displayName ?? '고객'} 님에게 등록 요청을 보냈습니다.\n승인하면 자동으로 고객 목록에 추가됩니다.`,
      );
      setSearch('');
      setSearchResult(null);
    } catch (e: any) {
      showInfoAlert('요청 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setRequestBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = (c.customerDisplayName ?? '').toLowerCase();
      const sid = (c.customerShortId ?? '').toLowerCase();
      const memo = (c.memo ?? '').toLowerCase();
      const uidTail = (c.uid ?? '').slice(-6).toLowerCase();
      return (
        name.includes(q)
        || sid.includes(q)
        || memo.includes(q)
        || uidTail.includes(q)
      );
    });
  }, [customers, search]);

  const onScan = async (raw: string) => {
    setScannerOpen(false);
    const payload = decodeQr(raw);
    if (!payload) {
      showInfoAlert('인식 실패', '셰르파 회원 QR 형식이 아닙니다.');
      return;
    }
    if (payload.t === 's') {
      showInfoAlert('매장 QR', '이건 매장 QR 입니다. 고객 QR을 스캔해 주세요.');
      return;
    }
    if (shops.length === 0) {
      showInfoAlert(
        '매장 없음',
        '먼저 매장을 등록해 주세요. (MY → 내 매장 관리)',
      );
      return;
    }
    setBusy(true);
    try {
      await addCustomer({
        shopId: shops[0].id,
        customerUid: payload.i,
        customerShortId: payload.s ?? null,
        customerDisplayName: payload.n ?? '(이름 미상)',
      });
      showInfoAlert('고객 등록 완료', `${payload.n ?? '고객'} 님을 등록했습니다.`);
    } catch (e: any) {
      showInfoAlert('등록 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  const onOpenChat = async (c: CustomerRecord) => {
    if (!user) return;
    if (!FEATURE_MESSENGER_ENABLED) {
      showInfoAlert(MESSENGER_COMING_SOON_TITLE, MESSENGER_COMING_SOON_BODY);
      return;
    }
    setBusy(true);
    try {
      const shop = shops.find((s) => s.id === c.shopId) ?? shops[0];
      if (!shop) {
        showInfoAlert('매장 없음', '매장 등록이 필요합니다.');
        return;
      }
      const chat = await ensureChat({
        visitorUid: c.uid,
        merchantUid: user.id,
        shopId: shop.id,
        shopDisplayName: shop.displayName || '매장',
      });
      router.push(`/chat/${chat.id}` as any);
    } catch (e: any) {
      showInfoAlert('채팅 열기 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (c: CustomerRecord) => {
    showConfirmAlert(
      '고객 삭제',
      `${c.customerDisplayName} 님을 고객 목록에서 제거합니다.\n메모도 함께 사라집니다.`,
      async () => {
        setBusy(true);
        try {
          await removeCustomer(c.shopId, c.uid);
        } catch (e: any) {
          showInfoAlert('삭제 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setBusy(false);
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="고객관리" showBack={false} />
        <View style={styles.center}>
          <Text style={styles.muted}>로그인이 필요합니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="고객관리" showBack={false} />

      <View style={styles.toolbar}>
        <View style={styles.searchInputWrap}>
          <SearchIcon size={16} color={Colors.textMuted} strokeWidth={2.2} />
          <RNTextInput
            placeholder="이름·메모 검색 · 5자 ID 로 추가"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="characters"
            maxLength={40}
          />
        </View>
        <Pressable
          style={styles.scanBtn}
          onPress={() => setScannerOpen(true)}
          disabled={busy}
        >
          <QrCode size={18} color="#fff" strokeWidth={2.4} />
          <Text style={styles.scanBtnText}>QR 스캔</Text>
        </Pressable>
      </View>

      {/* shortId 검색 결과 카드 — 5자 입력 시만 보임 */}
      {searchTriedQuery && (
        <View style={styles.lookupCard}>
          {searching ? (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.lookupMuted}>ID 검색 중...</Text>
            </View>
          ) : searchResult ? (
            <View style={styles.lookupRow}>
              <View style={styles.lookupAvatar}>
                <Text style={styles.lookupAvatarText}>
                  {(searchResult.displayName?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lookupName} numberOfLines={1}>
                  {searchResult.displayName ?? '(이름 미상)'}
                </Text>
                <Text style={styles.lookupId}>
                  ID · <Text style={styles.lookupIdStrong}>{searchResult.shortId}</Text>
                </Text>
                {(() => {
                  const dup = targetAlreadyHandled(searchResult.uid);
                  if (dup === 'added') return <Text style={styles.lookupHint}>이미 등록된 고객</Text>;
                  if (dup === 'pending') return <Text style={styles.lookupHint}>요청 대기중</Text>;
                  return null;
                })()}
              </View>
              <Pressable
                style={[
                  styles.lookupAddBtn,
                  (requestBusy || targetAlreadyHandled(searchResult.uid)) && styles.lookupAddBtnDisabled,
                ]}
                onPress={onSendRequest}
                disabled={requestBusy || !!targetAlreadyHandled(searchResult.uid)}
              >
                <Text style={styles.lookupAddBtnText}>
                  {requestBusy ? '요청 중...' : '고객 추가'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.lookupMuted}>
              ID "{searchTriedQuery}" 에 해당하는 사용자가 없습니다.
            </Text>
          )}
        </View>
      )}

      {/* 보낸 요청 중 pending 표시 */}
      {requests.filter((r) => r.status === 'pending').length > 0 && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            대기 중인 요청 {requests.filter((r) => r.status === 'pending').length} 건
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={customers === null} onRefresh={() => {}} tintColor={Colors.primary} />
        }
      >
        {shops.length === 0 ? (
          <View style={styles.empty}>
            <Users size={40} color={Colors.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>등록된 매장이 없어요</Text>
            <Text style={styles.emptyDesc}>
              먼저 매장을 등록해야 고객 관리 기능을 사용할 수 있습니다.
            </Text>
            <Button
              label="내 매장 관리로 이동"
              variant="secondary"
              onPress={() => router.push('/my-shops')}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : customers === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Users size={40} color={Colors.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>
              {customers.length === 0 ? '아직 등록된 고객이 없어요' : '검색 결과가 없습니다'}
            </Text>
            <Text style={styles.emptyDesc}>
              {customers.length === 0
                ? '상단의 [QR 스캔] 으로 고객을 등록해 보세요.'
                : '다른 검색어로 시도해 주세요.'}
            </Text>
          </View>
        ) : (
          filtered.map((c) => (
            <CustomerCard
              key={`${c.shopId}__${c.uid}`}
              c={c}
              onMemo={() => setEditTarget(c)}
              onChat={() => onOpenChat(c)}
              onRemove={() => onRemove(c)}
            />
          ))
        )}
      </ScrollView>

      <QrScanner visible={scannerOpen} onScan={onScan} onClose={() => setScannerOpen(false)} />

      {editTarget && (
        <MemoEditor
          customer={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}

function CustomerCard({
  c,
  onMemo,
  onChat,
  onRemove,
}: {
  c: CustomerRecord;
  onMemo: () => void;
  onChat: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(c.customerDisplayName?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {c.customerDisplayName || '(이름 미상)'}
          </Text>
          {c.customerShortId && (
            <Text style={styles.cardShortId}>
              ID · <Text style={styles.cardShortIdStrong}>{c.customerShortId}</Text>
            </Text>
          )}
          <Text style={styles.cardMeta}>
            등록 {new Date(c.addedAt).toLocaleDateString('ko-KR')}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
          <Trash2 size={16} color={Colors.danger} strokeWidth={2.2} />
        </Pressable>
      </View>

      {c.memo ? (
        <Pressable style={styles.memoBox} onPress={onMemo}>
          <Text style={styles.memoText} numberOfLines={3}>{c.memo}</Text>
          <Text style={styles.memoEditHint}>탭하여 메모 수정</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.memoEmpty} onPress={onMemo}>
          <Text style={styles.memoEmptyText}>+ 고객 메모 추가 (고객에게는 보이지 않습니다)</Text>
        </Pressable>
      )}

      {FEATURE_MESSENGER_ENABLED && (
        <View style={styles.cardActions}>
          <Button
            label="메시지 보내기"
            onPress={onChat}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  );
}

function MemoEditor({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memo, setMemo] = useState(customer.memo);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateCustomerMemo(customer.shopId, customer.uid, memo);
      onSaved();
    } catch (e: any) {
      showInfoAlert('저장 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={modalStyles.sheet}
        >
          <View style={modalStyles.head}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title}>고객 메모 (고객에게는 보이지 않습니다)</Text>
              <Text style={modalStyles.subtitle} numberOfLines={1}>
                {customer.customerDisplayName}
                {customer.customerShortId ? ` · ID ${customer.customerShortId}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>
          <RNTextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="이 고객에 대한 메모 (취향, 거래 내역, 주의사항 등) — 사장님만 볼 수 있어요."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={4000}
            style={modalStyles.input}
          />
          <Button label={saving ? '저장 중...' : '저장'} onPress={onSave} loading={saving} />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { fontSize: 13, color: Colors.textMuted },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: Colors.text },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  scanBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  lookupCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lookupAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lookupAvatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  lookupName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  lookupId: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  lookupIdStrong: { color: Colors.primary, fontWeight: '800' },
  lookupHint: { fontSize: 11, color: Colors.danger, fontWeight: '600', marginTop: 2 },
  lookupMuted: { fontSize: 12, color: Colors.textMuted },
  lookupAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  lookupAddBtnDisabled: { opacity: 0.4 },
  lookupAddBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  pendingBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFF3D6',
    borderWidth: 1,
    borderColor: '#E5C97A',
  },
  pendingBannerText: { fontSize: 11, color: '#7A5A00', fontWeight: '700' },

  scroll: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 8 },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  cardName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  cardShortId: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  cardShortIdStrong: { color: Colors.primary, fontWeight: '800' },
  cardMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 6 },

  memoBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFCE8',
    borderWidth: 1,
    borderColor: '#E5D89E',
  },
  memoText: { fontSize: 12, color: Colors.text, lineHeight: 18 },
  memoEditHint: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  memoEmpty: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  memoEmptyText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  input: {
    minHeight: 140,
    maxHeight: 240,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
});
