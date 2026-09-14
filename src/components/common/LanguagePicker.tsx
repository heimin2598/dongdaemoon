import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  AppLanguage,
  setAppLanguage,
  SUPPORTED_LANGUAGES,
} from '@/i18n';
import { Colors } from '@/constants/colors';

interface Props {
  /** 'chip' = 작은 글로브 칩, 'row' = 리스트 항목 형태 */
  variant?: 'chip' | 'row';
  /** chip 일 때 텍스트 색상 (어두운 배경 위에 흰색 필요 시) */
  tint?: string;
  /** 선택 변경 후 콜백 */
  onChanged?: (lang: AppLanguage) => void;
}

export function LanguagePicker({ variant = 'chip', tint, onChanged }: Props) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (i18n.language as AppLanguage) || 'ko';
  const currentName =
    SUPPORTED_LANGUAGES.find((l) => l.code === current)?.nativeName ?? '한국어';

  const pick = async (code: AppLanguage) => {
    await setAppLanguage(code);
    setOpen(false);
    onChanged?.(code);
  };

  return (
    <>
      {variant === 'chip' ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.chip,
            tint ? { borderColor: tint } : null,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Globe size={14} color={tint ?? Colors.text} strokeWidth={2.2} />
          <Text style={[styles.chipText, tint ? { color: tint } : null]}>{currentName}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F4F6FA' }]}
        >
          <Globe size={18} color={Colors.text} strokeWidth={2} />
          <Text style={styles.rowLabel}>{currentName}</Text>
        </Pressable>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Language / 언어 / 语言</Text>
            {SUPPORTED_LANGUAGES.map((l) => {
              const active = l.code === current;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => pick(l.code)}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { backgroundColor: '#F4F6FA' },
                  ]}
                >
                  <Text
                    style={[
                      styles.itemText,
                      active && { color: Colors.primary, fontWeight: '800' },
                    ]}
                  >
                    {l.nativeName}
                  </Text>
                  {active && <Check size={18} color={Colors.primary} strokeWidth={2.4} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 8,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  itemText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
});
