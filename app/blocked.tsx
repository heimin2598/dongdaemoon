import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldX } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useBlocksStore } from '@/stores/blocksStore';
import { unblockUser } from '@/lib/blocks';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';

export default function BlockedScreen() {
  const list = useBlocksStore((s) => s.list);

  const onUnblock = (uid: string, name?: string) => {
    showConfirmAlert(
      '차단 해제',
      `${name || '이 사용자'}의 차단을 해제할까요? 콘텐츠가 다시 보이게 됩니다.`,
      async () => {
        try {
          await unblockUser(uid);
        } catch (e) {
          showInfoAlert('해제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '해제' },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="차단 사용자 관리" />
      <FlatList
        data={list}
        keyExtractor={(b) => b.blockedUid}
        contentContainerStyle={list.length === 0 ? styles.emptyWrap : styles.listWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ShieldX size={36} color={Colors.textMuted} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>차단한 사용자가 없습니다</Text>
            <Text style={styles.emptyDesc}>
              부적절한 콘텐츠를 보면 신고와 함께{'\n'}
              해당 사용자를 차단할 수 있어요.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName || '익명 사용자'}
              </Text>
              {item.reason ? (
                <Text style={styles.reason} numberOfLines={1}>
                  사유: {item.reason}
                </Text>
              ) : null}
              <Text style={styles.date}>
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('ko-KR')
                  : ''}
              </Text>
            </View>
            <Pressable
              style={styles.unblockBtn}
              onPress={() => onUnblock(item.blockedUid, item.displayName)}
            >
              <Text style={styles.unblockText}>차단 해제</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  listWrap: { padding: 16, gap: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text },
  reason: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  date: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  unblockText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
