import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { Inquiry, subscribeMyInquiries } from '@/lib/inquiries';

export default function MyInquiriesScreen() {
  const [list, setList] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeMyInquiries((items) => {
      setList(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="내 문의 내역"
        rightSlot={
          <Pressable hitSlop={10} onPress={() => router.push('/inquiry-new')}>
            <Text style={styles.addText}>+ 작성</Text>
          </Pressable>
        }
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={list.length === 0 ? styles.emptyWrap : styles.listWrap}
          ListEmptyComponent={
            <Text style={styles.empty}>아직 작성한 문의가 없습니다.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/inquiry/[id]', params: { id: item.id } })
              }
            >
              <View style={styles.rowHeader}>
                <View
                  style={[
                    styles.statusTag,
                    item.status === 'answered' ? styles.statusTagAns : styles.statusTagOpen,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {item.status === 'answered' ? '답변 완료' : '답변 대기'}
                  </Text>
                </View>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.content} numberOfLines={2}>
                {item.content}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  listWrap: { padding: 16, gap: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { fontSize: 13, color: Colors.textMuted },

  row: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusTagOpen: { backgroundColor: Colors.divider },
  statusTagAns: { backgroundColor: Colors.success },
  statusText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  date: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 2 },
  content: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
