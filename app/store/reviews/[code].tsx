import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flag } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { StarRow } from '@/components/common/StarRow';
import { ReportSheet } from '@/components/common/ReportSheet';
import { Colors } from '@/constants/colors';
import { getStoreByCode } from '@/data/stores';
import { useAuthStore } from '@/stores/authStore';
import { useReviewsStore } from '@/stores/reviewsStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { deleteMyReview, submitReview } from '@/lib/reviews';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';

export default function StoreReviewsScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const decoded = code ? decodeURIComponent(code) : '';
  const store = decoded ? getStoreByCode(decoded) : undefined;
  const shopCode = store?.code ?? decoded;

  const user = useAuthStore((s) => s.user);
  const reviews = useReviewsStore((s) => s.byShop[shopCode] ?? []);
  const agg = useReviewsStore((s) => s.aggBy[shopCode]);
  const watch = useReviewsStore((s) => s.watch);
  const unwatch = useReviewsStore((s) => s.unwatch);

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.id === user.id) : null),
    [reviews, user?.id],
  );

  const [rating, setRating] = useState<number>(myReview?.rating ?? 5);
  const [text, setText] = useState<string>(myReview?.text ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shopCode) return;
    watch(shopCode);
    return () => unwatch(shopCode);
  }, [shopCode]);

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setText(myReview.text);
    }
  }, [myReview?.id]);

  const onSubmit = async () => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    setSubmitting(true);
    try {
      await submitReview(shopCode, rating, text);
    } catch (e) {
      showInfoAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    showConfirmAlert(
      '리뷰 삭제',
      '내 리뷰를 삭제할까요?',
      async () => {
        try {
          await deleteMyReview(shopCode);
          setText('');
          setRating(5);
        } catch (e) {
          showInfoAlert('삭제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  const blockedSet = useBlocksStore((s) => s.blockedSet);
  const others = (user ? reviews.filter((r) => r.id !== user.id) : reviews).filter(
    (r) => !blockedSet.has(r.id),
  );
  const headerTitle = store?.name ? `${store.name} 리뷰` : '리뷰';

  const [reportTarget, setReportTarget] = useState<{
    targetId: string;
    targetOwnerUid: string;
  } | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={headerTitle} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.aggBlock}>
          <Text style={styles.aggAvg}>
            {agg && agg.ratingCount > 0 ? agg.average.toFixed(1) : '-'}
          </Text>
          <View style={{ flex: 1 }}>
            <StarRow value={agg?.average ?? 0} size={18} muted />
            <Text style={styles.aggCount}>리뷰 {agg?.ratingCount ?? 0}개</Text>
          </View>
        </View>

        <View style={styles.writeBlock}>
          <Text style={styles.sectionTitleInline}>
            {myReview ? '내 리뷰 (수정 가능)' : '리뷰 작성'}
          </Text>
          {!user ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>리뷰 작성을 위해 로그인이 필요합니다.</Text>
              <Button label="로그인" onPress={() => router.push('/(auth)/login')} style={{ marginTop: 12 }} />
            </View>
          ) : (
            <>
              <StarRow value={rating} onChange={setRating} size={32} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="이 매장에 대한 후기를 남겨주세요."
                placeholderTextColor={Colors.textMuted}
                multiline
                style={styles.input}
                textAlignVertical="top"
              />
              <View style={styles.actions}>
                {myReview && (
                  <Button label="삭제" variant="secondary" onPress={onDelete} style={{ flex: 1 }} />
                )}
                <Button
                  label={submitting ? '저장 중...' : myReview ? '수정 저장' : '리뷰 등록'}
                  onPress={onSubmit}
                  disabled={submitting || (!text.trim() && !myReview)}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전체 리뷰</Text>
          {others.length === 0 ? (
            <Text style={styles.emptyText}>아직 작성된 리뷰가 없습니다.</Text>
          ) : (
            others.map((r) => (
              <View key={r.id} style={styles.reviewItem}>
                <View style={styles.reviewItemHeader}>
                  <Text style={styles.reviewName}>{r.displayName}</Text>
                  <StarRow value={r.rating} size={14} muted />
                </View>
                {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
                <View style={styles.reviewFooter}>
                  <Text style={styles.reviewDate}>
                    {new Date(r.updatedAt || r.createdAt).toLocaleDateString('ko-KR')}
                  </Text>
                  {user && r.id !== user.id && (
                    <Pressable
                      onPress={() =>
                        setReportTarget({ targetId: `${shopCode}/${r.id}`, targetOwnerUid: r.id })
                      }
                      hitSlop={8}
                      style={styles.reportBtn}
                    >
                      <Flag size={12} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={styles.reportBtnText}>신고</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ReportSheet
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="review"
        targetId={reportTarget?.targetId ?? ''}
        targetOwnerUid={reportTarget?.targetOwnerUid ?? ''}
        targetLabel="리뷰"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  aggBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    margin: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aggAvg: { fontSize: 40, fontWeight: '800', color: Colors.text },
  aggCount: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  writeBlock: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionTitleInline: { fontSize: 13, color: Colors.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
    fontSize: 14,
    color: Colors.text,
  },
  actions: { flexDirection: 'row', gap: 8 },

  section: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '700', marginBottom: 8 },
  reviewItem: {
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    gap: 6,
  },
  reviewItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  reviewText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  reviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewDate: { fontSize: 11, color: Colors.textMuted },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 6 },
  reportBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  emptyState: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
