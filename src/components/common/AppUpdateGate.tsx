import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  evaluateUpdate,
  getCurrentAppVersion,
  STORE_URL,
  subscribeAppVersionPolicy,
  type AppVersionPolicy,
  type UpdateRequirement,
} from '@/lib/appVersion';

const EMPTY_POLICY: AppVersionPolicy = { latestVersion: '', minVersion: '', notes: '' };

/**
 * 설치된 버전이 운영자가 지정한 최신 버전보다 낮으면 스토어 업데이트를 유도한다.
 * RootLayout 에 1개만 mount.
 *
 * - forced (minVersion 미만): 닫을 수 없다. 구버전에서 서버와 계약이 깨진 경우용.
 * - optional (latestVersion 미만): "나중에" 로 닫을 수 있고, 그 세션 동안 다시 안 뜬다.
 *
 * 웹은 스토어 업데이트 개념이 없어 아예 렌더하지 않는다.
 */
export function AppUpdateGate() {
  const [policy, setPolicy] = useState<AppVersionPolicy>(EMPTY_POLICY);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsub = subscribeAppVersionPolicy(setPolicy);
    return () => unsub();
  }, []);

  if (Platform.OS === 'web') return null;

  const current = getCurrentAppVersion();
  const requirement: UpdateRequirement = evaluateUpdate(current, policy);

  if (requirement === 'none') return null;
  if (requirement === 'optional' && dismissed) return null;

  const forced = requirement === 'forced';

  const openStore = () => {
    Linking.openURL(STORE_URL).catch(() => {});
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={forced ? () => {} : () => setDismissed(true)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <ArrowUpCircle size={32} color={Colors.primary} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>
            {forced ? '업데이트가 필요합니다' : '새 버전이 나왔어요'}
          </Text>

          <Text style={styles.versionLine}>
            현재 {current}
            {policy.latestVersion ? `  →  최신 ${policy.latestVersion}` : ''}
          </Text>

          <Text style={styles.desc}>
            {policy.notes
              ? policy.notes
              : forced
                ? '이 버전은 더 이상 사용할 수 없습니다.\n스토어에서 업데이트해 주세요.'
                : '더 편해진 기능과 수정된 오류를 바로 사용해 보세요.'}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={openStore}
          >
            <Text style={styles.primaryLabel}>
              {Platform.OS === 'ios' ? 'App Store 에서 업데이트' : 'Play 스토어에서 업데이트'}
            </Text>
          </Pressable>

          {!forced && (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => setDismissed(true)}
            >
              <Text style={styles.secondaryLabel}>나중에</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EAF1FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  versionLine: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  desc: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 20,
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 8,
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
