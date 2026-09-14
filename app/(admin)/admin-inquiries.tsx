import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { Inquiry, subscribeAllInquiries } from '@/lib/inquiries';

type Filter = 'all' | 'open' | 'answered';

export default function AdminInquiriesScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  const [list, setList] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAllInquiries((items) => {
      setList(items);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (filter === 'all') return list;
    return list.filter((i) => i.status === filter);
  }, [list, filter]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="문의 관리" />
        <View style={styles.center}>
          <Text style={styles.deny}>운영자 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="문의 관리" />

      <View style={styles.filterRow}>
        {(['all', 'open', 'answered'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '전체' : f === 'open' ? '답변 대기' : '답변 완료'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listWrap}
          ListEmptyComponent={<Text style={styles.empty}>해당하는 문의가 없습니다.</Text>}
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
              <Text style={styles.author} numberOfLines={1}>
                {item.authorName || '(이름 없음)'} · {item.authorEmail || ''}
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
  deny: { fontSize: 14, color: Colors.textMuted },
  empty: { fontSize: 13, color: Colors.textMuted },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterBtn: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  filterTextActive: { color: '#fff' },

  listWrap: { padding: 16, gap: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

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
  title: { fontSize: 15, fontWeight: '800', color: Colors.text },
  author: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  content: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
