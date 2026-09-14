import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { QrCode, ScanLine, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { QrCodeView } from './QrCodeView';
import { QrScanner } from './QrScanner';

interface Props {
  /** 모달에 표시할 라벨 (예: "내 QR" / "매장 QR") */
  ownLabel: string;
  /** QR 페이로드 (JSON.stringify 된 문자열) */
  ownQrValue: string | null;
  /** 표시용 추가 캡션 (예: "ID · ABC23") */
  ownCaption?: string;
  /** QR 스캔 결과 콜백 */
  onScan: (raw: string) => void;
}

/**
 * 홈 상단에 가로로 얇게 노출되는 QR 위젯.
 * - 좌측: "내 QR" 누르면 풀스크린 모달 (본인 QR 보여주기)
 * - 우측: "QR 스캔" 누르면 카메라 스캐너
 */
export function HomeQrWidget({ ownLabel, ownQrValue, ownCaption, onScan }: Props) {
  const [showOwn, setShowOwn] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => setShowOwn(true)}
        disabled={!ownQrValue}
      >
        <QrCode size={18} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.btnLabel}>{ownLabel}</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => setShowScanner(true)}
      >
        <ScanLine size={18} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.btnLabel}>QR 스캔</Text>
      </Pressable>

      {showOwn && ownQrValue && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowOwn(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>{ownLabel}</Text>
                <Pressable hitSlop={12} onPress={() => setShowOwn(false)}>
                  <X size={22} color={Colors.text} />
                </Pressable>
              </View>
              <View style={styles.qrWrap}>
                <QrCodeView value={ownQrValue} size={240} />
              </View>
              {ownCaption && <Text style={styles.modalCaption}>{ownCaption}</Text>}
              <Text style={styles.modalHint}>
                상대방이 이 QR을 스캔하면 정보를 받아갈 수 있어요.
              </Text>
            </View>
          </View>
        </Modal>
      )}

      <QrScanner
        visible={showScanner}
        onScan={(raw) => {
          setShowScanner(false);
          onScan(raw);
        }}
        onClose={() => setShowScanner(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  btnPressed: { backgroundColor: '#F0F4FB' },
  btnLabel: { fontSize: 13, fontWeight: '800', color: Colors.text },
  divider: { width: 1, height: 24, backgroundColor: Colors.divider },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 22,
    gap: 14,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  qrWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  modalCaption: { fontSize: 14, color: Colors.primary, fontWeight: '800', letterSpacing: 1 },
  modalHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
