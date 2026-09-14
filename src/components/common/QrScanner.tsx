import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  onScan: (raw: string) => void;
  onClose: () => void;
}

/**
 * QR 스캔 모달 — 풀스크린.
 * 웹에서는 expo-camera 가 limited 지원이라 별도 안내. iOS/Android 정상 동작.
 */
export function QrScanner({ visible, onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      if (permission && !permission.granted) {
        requestPermission();
      }
    }
  }, [visible, permission, requestPermission]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    onScan(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={28} color="#fff" />
        </Pressable>

        {Platform.OS === 'web' ? (
          <View style={styles.center}>
            <Text style={styles.webText}>
              QR 스캔은 모바일 앱에서만 동작합니다.{'\n'}
              웹에서 테스트하시려면 핸드폰 Expo Go 또는 빌드된 앱에서 실행해 주세요.
            </Text>
          </View>
        ) : !permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.webText}>카메라 권한이 필요합니다.</Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>권한 허용</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>QR 코드를 사각형 안에 맞춰주세요</Text>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  webText: { color: '#fff', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
  },
  hint: {
    color: '#fff',
    fontSize: 13,
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
