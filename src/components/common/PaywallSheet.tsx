import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Crown, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  feature?: string;
  onClose: () => void;
}

/**
 * 프리미엄 락 모달 — 무료 사용자가 락 걸린 기능 누르면 짧은 안내 + 혜택 페이지 진입.
 * 자세한 비교/결제는 별도 `/paywall` 페이지로 위임.
 */
export function PaywallSheet({ visible, feature, onClose }: Props) {
  const goPaywall = () => {
    onClose();
    router.push('/paywall' as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={18} color={Colors.textMuted} />
          </Pressable>

          <View style={styles.crownWrap}>
            <Crown size={32} color={Colors.warning} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>프리미엄 회원 전용</Text>
          {feature && <Text style={styles.featureLabel}>{feature}</Text>}

          <Text style={styles.body}>
            커피 1잔 값으로 모든 기능 잠금 해제와{'\n'}광고 제거로 쾌적하게 사용하세요
          </Text>

          <Pressable style={styles.primaryBtn} onPress={goPaywall}>
            <Text style={styles.primaryBtnText}>혜택 알아보기</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>나중에</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
  },
  crownWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF4D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '900', color: Colors.text },
  featureLabel: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  body: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
});
