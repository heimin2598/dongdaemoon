import React from 'react';
import { StyleSheet, View } from 'react-native';
// react-native-qrcode-svg 는 react-native-svg 가 peer 로 필요. 이미 설치됨.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/colors';

interface Props {
  value: string;
  size?: number;
  bg?: string;
  fg?: string;
}

/** QR 표시용 단순 래퍼. value 는 JSON.stringify 후 넣는 편이 권장됨. */
export function QrCodeView({ value, size = 200, bg = '#fff', fg = '#000' }: Props) {
  return (
    <View style={[styles.box, { width: size + 16, height: size + 16 }]}>
      <QRCode value={value || ' '} size={size} backgroundColor={bg} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
});
