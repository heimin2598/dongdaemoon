import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { setOperatingStatus } from '@/lib/shops';
import {
  OPERATING_OPTIONS,
  getShopStatusDisplay,
} from '@/lib/shopStatus';
import { showInfoAlert } from '@/utils/alerts';
import type { OperatingStatus, Shop } from '@/types';

interface Props {
  shop: Shop;
}

/** 사장님이 빠르게 영업 상태 변경하는 위젯 (탭 → 4 옵션 모달). */
export function ShopStatusToggle({ shop }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = getShopStatusDisplay(shop);

  const apply = async (status: OperatingStatus, untilMs: number | null) => {
    setBusy(true);
    try {
      await setOperatingStatus(shop.id, status, untilMs);
      setOpen(false);
    } catch (e: any) {
      showInfoAlert('변경 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.btn,
          { borderColor: d.color, backgroundColor: d.bg },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.btnEmoji]}>{d.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnLabel} numberOfLines={1}>
            {d.label}
            {d.untilLabel ? ` · ${d.untilLabel}` : ''}
          </Text>
          <Text style={styles.btnSub} numberOfLines={1}>
            {shop.displayName || '매장'} · 탭하여 상태 변경
          </Text>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {open && (
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>영업 상태 변경</Text>
              {OPERATING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.status}
                  disabled={busy}
                  onPress={() =>
                    apply(
                      opt.status,
                      opt.presetUntilMinutes
                        ? Date.now() + opt.presetUntilMinutes * 60 * 1000
                        : null,
                    )
                  }
                  style={({ pressed }) => [
                    styles.opt,
                    pressed && { backgroundColor: '#F4F6FA' },
                  ]}
                >
                  <Text style={styles.optEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{opt.label}</Text>
                    <Text style={styles.optHint}>{opt.hint}</Text>
                  </View>
                  {opt.presetUntilMinutes && (
                    <Text style={styles.optMinutes}>+{opt.presetUntilMinutes}분</Text>
                  )}
                </Pressable>
              ))}
              {busy && (
                <View style={styles.busy}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              )}
            </Pressable>
          </Pressable>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  btnEmoji: { fontSize: 20 },
  btnLabel: { fontSize: 14, fontWeight: '800', color: Colors.text },
  btnSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: Colors.surface, borderRadius: 14, padding: 8, paddingBottom: 4 },
  sheetTitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  optEmoji: { fontSize: 22 },
  optLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },
  optHint: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  optMinutes: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  busy: { padding: 12, alignItems: 'center' },
});
