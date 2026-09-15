import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpCircle } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import {
  compareVersions,
  getCurrentAppVersion,
  setAppVersionPolicy,
  subscribeAppVersionPolicy,
  type AppVersionPolicy,
} from '@/lib/appVersion';
import { showInfoAlert } from '@/utils/alerts';

const VERSION_RE = /^\d+(\.\d+)*$/;

export default function AdminAppVersionScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [minVersion, setMinVersion] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsub = subscribeAppVersionPolicy((p: AppVersionPolicy) => {
      setLatestVersion(p.latestVersion);
      setMinVersion(p.minVersion);
      setNotes(p.notes);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const onSave = async () => {
    const latest = latestVersion.trim();
    const min = minVersion.trim();

    if (latest && !VERSION_RE.test(latest)) {
      showInfoAlert('형식 오류', '최신 버전은 1.0.7 처럼 숫자와 점으로만 입력해 주세요.');
      return;
    }
    if (min && !VERSION_RE.test(min)) {
      showInfoAlert('형식 오류', '최소 버전은 1.0.7 처럼 숫자와 점으로만 입력해 주세요.');
      return;
    }
    if (latest && min && compareVersions(min, latest) > 0) {
      showInfoAlert('값 확인', '최소 버전이 최신 버전보다 높습니다.');
      return;
    }

    setSaving(true);
    try {
      await setAppVersionPolicy({ latestVersion: latest, minVersion: min, notes: notes.trim() });
      showInfoAlert('저장 완료', '앱에 즉시 반영됩니다.');
    } catch (e: any) {
      showInfoAlert('저장 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScreenHeader title="앱 버전 관리" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <ArrowUpCircle size={26} color={Colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.heroTitle}>업데이트 안내 팝업</Text>
            <Text style={styles.heroDesc}>
              사용자의 설치 버전이 아래 기준보다 낮으면 앱 실행 시 업데이트 안내가 뜹니다.
            </Text>
            <Text style={styles.heroMeta}>이 기기에서 보이는 버전 · {getCurrentAppVersion()}</Text>
          </View>

          <Field
            label="최신 버전 (권장 업데이트)"
            hint="이 버전보다 낮으면 안내 팝업이 뜹니다. '나중에' 로 닫을 수 있습니다. 비우면 안내하지 않습니다."
            value={latestVersion}
            onChangeText={setLatestVersion}
            placeholder="1.0.7"
          />

          <Field
            label="최소 버전 (강제 업데이트)"
            hint="이 버전보다 낮으면 닫을 수 없는 팝업이 떠 앱을 쓸 수 없습니다. 꼭 필요할 때만 채우세요."
            value={minVersion}
            onChangeText={setMinVersion}
            placeholder="비워두면 강제 업데이트 없음"
          />

          <Field
            label="안내 문구 (선택)"
            hint="비우면 기본 문구가 나갑니다."
            value={notes}
            onChangeText={setNotes}
            placeholder="알림이 오지 않던 문제를 고쳤습니다."
            multiline
          />

          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              강제 업데이트는 스토어 검토가 끝나 새 버전이 실제로 받아지는 것을 확인한 다음에
              설정하세요. 아직 배포 전인 버전을 최소 버전으로 넣으면 모든 사용자가 앱을 쓸 수
              없게 됩니다.
            </Text>
          </View>

          <Button label="저장" variant="primary" loading={saving} disabled={saving} onPress={onSave} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  multiline,
  ...rest
}: {
  label: string;
  hint: string;
  multiline?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EAF1FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  heroDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  heroMeta: { marginTop: 10, fontSize: 12, fontWeight: '700', color: Colors.primary },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800', color: Colors.text },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 17, color: Colors.textMuted },
  warnBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warnText: { fontSize: 12, lineHeight: 18, color: '#92400E', fontWeight: '600' },
});
