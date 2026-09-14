import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Store as StoreIcon, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import {
  approveRequest,
  rejectRequest,
  subscribeMyPendingRequests,
  type CustomerRequest,
} from '@/lib/customerRequests';
import { showInfoAlert } from '@/utils/alerts';

/**
 * 고객 입장 — 사장이 보낸 등록 요청을 받았을 때 자동으로 뜨는 승인/거절 모달.
 * 한 번에 하나씩 처리. 여러 개 있으면 처리 후 자동으로 다음 것이 뜸.
 *
 * RootLayout 에 1개만 mount. 사용자 role 무관(visitor/merchant 둘 다) — merchant 가
 * 다른 사장의 고객으로 등록될 수도 있으므로.
 */
export function PendingCustomerRequestModal() {
  const user = useAuthStore((s) => s.user);
  const [pending, setPending] = useState<CustomerRequest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setPending([]);
      return;
    }
    const unsub = subscribeMyPendingRequests(user.id, setPending);
    return () => unsub();
  }, [user]);

  const current = pending[0] ?? null;
  if (!current) return null;

  const onApprove = async () => {
    setBusy(true);
    try {
      await approveRequest(current.id);
    } catch (e: any) {
      showInfoAlert('승인 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    setBusy(true);
    try {
      await rejectRequest(current.id);
    } catch (e: any) {
      showInfoAlert('거절 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onReject}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <StoreIcon size={32} color={Colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>새로운 매장 등록 요청</Text>
          <Text style={styles.shopName} numberOfLines={2}>
            {current.shopDisplayName}
          </Text>
          <Text style={styles.desc}>
            이 매장이 고객 목록에 회원님을 추가하려고 합니다.{'\n'}
            승인하면 매장에서 회원님의 ID·이름이 보이고{'\n'}
            매장에서 회원님 앞으로 메모를 저장할 수 있어요.
          </Text>

          {pending.length > 1 && (
            <Text style={styles.queueHint}>대기 중인 요청 {pending.length} 건</Text>
          )}

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, styles.btnReject, busy && styles.btnDisabled]}
              onPress={onReject}
              disabled={busy}
            >
              <Text style={styles.btnRejectText}>거절</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnApprove, busy && styles.btnDisabled]}
              onPress={onApprove}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnApproveText}>승인</Text>
              )}
            </Pressable>
          </View>

          {/* 닫기 — 거절도 승인도 아님. 모달만 dismiss (다음 진입 시 다시 표시). */}
          <Pressable style={styles.closeBtn} onPress={() => setPending([])} hitSlop={12}>
            <X size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
  shopName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
  },
  queueHint: { fontSize: 11, color: Colors.textMuted, marginTop: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnReject: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnRejectText: { fontSize: 14, fontWeight: '800', color: Colors.text },
  btnApprove: { backgroundColor: Colors.primary },
  btnApproveText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
});
