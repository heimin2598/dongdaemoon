import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { showInfoAlert } from '@/utils/alerts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Phone } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import {
  AD_INQUIRY_STATUS_LABEL,
  AD_INQUIRY_STATUS_ORDER,
  AdInquiry,
  AdInquiryStatus,
  setAdInquiryStatus,
  subscribeAllAdInquiries,
} from '@/lib/adInquiries';

type Filter = 'all' | AdInquiryStatus;

const STATUS_COLORS: Record<AdInquiryStatus, string> = {
  pending: Colors.warning,
  contacted: Colors.primaryLight,
  confirmed: Colors.success,
  rejected: Colors.danger,
};

export default function AdminAdInquiriesScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  const [list, setList] = useState<AdInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAllAdInquiries((items) => {
      setList(items);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (filter === 'all') return list;
    return list.filter((i) => i.status === filter);
  }, [list, filter]);

  const onChangeStatus = (id: string, status: AdInquiryStatus) => {
    setAdInquiryStatus(id, status).catch((e) => {
      showInfoAlert('상태 변경 실패', e instanceof Error ? e.message : String(e));
    });
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="광고 문의 관리" />
        <View style={styles.center}>
          <Text style={styles.deny}>운영자 권한이 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="광고 문의 관리" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', ...AD_INQUIRY_STATUS_ORDER] as Filter[]).map((f) => {
          const count =
            f === 'all' ? list.length : list.filter((i) => i.status === f).length;
          return (
            <Pressable
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? '전체' : AD_INQUIRY_STATUS_LABEL[f]}
              </Text>
              <Text
                style={[
                  styles.filterCount,
                  filter === f && styles.filterCountActive,
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listWrap}
          ListEmptyComponent={<Text style={styles.empty}>해당 상태의 문의가 없습니다.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.statusTag,
                    { backgroundColor: STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {AD_INQUIRY_STATUS_LABEL[item.status]}
                  </Text>
                </View>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>

              <Text style={styles.company}>{item.company}</Text>
              <Text style={styles.contact}>담당자: {item.contact}</Text>

              <View style={styles.linkRow}>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${item.phone.replace(/\D/g, '')}`).catch(() => {})
                  }
                >
                  <Phone size={14} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={styles.linkText}>{item.phone}</Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => Linking.openURL(`mailto:${item.email}`).catch(() => {})}
                >
                  <Mail size={14} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={styles.linkText}>{item.email}</Text>
                </Pressable>
              </View>

              <View style={styles.statusBtnRow}>
                {AD_INQUIRY_STATUS_ORDER.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.statusBtn,
                      item.status === s && {
                        backgroundColor: STATUS_COLORS[s],
                        borderColor: STATUS_COLORS[s],
                      },
                    ]}
                    onPress={() => onChangeStatus(item.id, s)}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        item.status === s && styles.statusBtnTextActive,
                      ]}
                    >
                      {AD_INQUIRY_STATUS_LABEL[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
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
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  filterTextActive: { color: '#fff' },
  filterCount: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  filterCountActive: { color: 'rgba(255,255,255,0.85)' },

  listWrap: { padding: 16, gap: 10 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  card: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  date: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  company: { fontSize: 16, fontWeight: '800', color: Colors.text },
  contact: { fontSize: 13, color: Colors.text, fontWeight: '600' },

  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  linkText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  statusBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusBtnText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  statusBtnTextActive: { color: '#fff' },
});
