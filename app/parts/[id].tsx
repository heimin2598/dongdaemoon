import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Flag, MessageSquare, Store as StoreIcon, Trash2 } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { ReportSheet } from '@/components/common/ReportSheet';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { usePartsRequestsStore } from '@/stores/partsRequestsStore';
import {
  deletePartsRequest,
  deleteReply,
  MAX_MESSAGE_LENGTH,
  setRequestStatus,
  submitReply,
} from '@/lib/partsRequests';
import { subscribeMyShops } from '@/lib/shops';
import { showInfoAlert, showConfirmAlert } from '@/utils/alerts';
import { Shop, PartsReply } from '@/types';
import { PARTS_CATEGORY_LABEL } from '@/constants/partsCategories';

const { width: SCREEN_W } = Dimensions.get('window');

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

function ReplyCard({
  reply,
  isMine,
  onPressShop,
  onDelete,
  onReport,
}: {
  reply: PartsReply;
  isMine: boolean;
  onPressShop: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <View style={[styles.replyCard, isMine && styles.replyCardMine]}>
      <View style={styles.replyHeader}>
        <StoreIcon size={16} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.replyShop} numberOfLines={1}>
          {reply.shopDisplayName || '매장'}
        </Text>
        <Text style={styles.replyTime}>{relativeTime(reply.updatedAt || reply.createdAt)}</Text>
      </View>
      <Text style={styles.replyMessage}>{reply.message}</Text>
      <View style={styles.replyFooter}>
        {reply.shopStoreCodes.length > 0 && (
          <Pressable style={styles.replyVisitBtn} onPress={onPressShop}>
            <Text style={styles.replyVisitText}>매장 방문</Text>
            <ArrowRight size={14} color={Colors.primary} strokeWidth={2.2} />
          </Pressable>
        )}
        {isMine ? (
          <Pressable style={styles.replyDeleteBtn} onPress={onDelete} hitSlop={6}>
            <Trash2 size={14} color={Colors.danger} strokeWidth={2} />
            <Text style={styles.replyDeleteText}>삭제</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.replyReportBtn} onPress={onReport} hitSlop={6}>
            <Flag size={12} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.replyReportText}>신고</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function PartsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = typeof id === 'string' ? id : '';
  const user = useAuthStore((s) => s.user);

  const watchRequest = usePartsRequestsStore((s) => s.watchRequest);
  const unwatchRequest = usePartsRequestsStore((s) => s.unwatchRequest);
  const watchReplies = usePartsRequestsStore((s) => s.watchReplies);
  const unwatchReplies = usePartsRequestsStore((s) => s.unwatchReplies);
  const req = usePartsRequestsStore((s) => s.byId[requestId]);
  const allReplies = usePartsRequestsStore((s) => s.repliesById[requestId] ?? []);
  const blockedSet = useBlocksStore((s) => s.blockedSet);
  const replies = useMemo(
    () => allReplies.filter((r) => !blockedSet.has(r.ownerUid)),
    [allReplies, blockedSet],
  );

  const [myShops, setMyShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reportTarget, setReportTarget] = useState<
    | {
        targetType: 'partsRequest' | 'partsReply';
        targetId: string;
        targetOwnerUid: string;
        label: string;
      }
    | null
  >(null);

  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';
  const isAuthor = user && req && user.id === req.authorUid;

  // 요청/답글 구독
  useEffect(() => {
    if (!requestId) return;
    watchRequest(requestId);
    watchReplies(requestId);
    return () => {
      unwatchRequest(requestId);
      unwatchReplies(requestId);
    };
  }, [requestId]);

  // 내 매장 구독 (사장님만)
  useEffect(() => {
    if (!isMerchantActive || !user?.id) return;
    const unsub = subscribeMyShops(user.id, (shops) => {
      setMyShops(shops);
      // 매장 1개면 자동 선택
      if (shops.length === 1) {
        setSelectedShopId((curr) => curr ?? shops[0].id);
      }
    });
    return () => unsub();
  }, [isMerchantActive, user?.id]);

  // 선택 매장이 바뀌면 — 그 매장으로 이미 단 답글이 있다면 메시지 prefill (수정 모드)
  useEffect(() => {
    if (!selectedShopId) {
      setMessage('');
      return;
    }
    const existing = replies.find((r) => r.shopId === selectedShopId);
    setMessage(existing?.message ?? '');
  }, [selectedShopId, replies]);

  const myExistingReply = useMemo(
    () => (selectedShopId ? replies.find((r) => r.shopId === selectedShopId) : null),
    [selectedShopId, replies],
  );

  const onSubmitReply = async () => {
    if (!selectedShopId) {
      showInfoAlert('매장 선택', '답글을 달 매장을 선택해 주세요.');
      return;
    }
    const shop = myShops.find((s) => s.id === selectedShopId);
    if (!shop) return;
    if (!message.trim()) {
      showInfoAlert('내용 부족', '메시지를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await submitReply(requestId, shop, message);
    } catch (e) {
      showInfoAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteReply = (shopId: string) => {
    showConfirmAlert(
      '답글 삭제',
      '이 답글을 삭제할까요?',
      async () => {
        try {
          await deleteReply(requestId, shopId);
          if (selectedShopId === shopId) setMessage('');
        } catch (e) {
          showInfoAlert('삭제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  const onDeleteRequest = () => {
    showConfirmAlert(
      '요청 삭제',
      '이 요청과 모든 답글을 삭제할까요?',
      async () => {
        try {
          await deletePartsRequest(requestId);
          router.back();
        } catch (e) {
          showInfoAlert('삭제 실패', e instanceof Error ? e.message : String(e));
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  const onToggleStatus = async () => {
    if (!req) return;
    try {
      await setRequestStatus(requestId, req.status === 'open' ? 'closed' : 'open');
    } catch (e) {
      showInfoAlert('변경 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const onPressShopLink = (storeCodes: string[]) => {
    if (storeCodes.length === 0) return;
    router.push({ pathname: '/store/[code]', params: { code: storeCodes[0] } });
  };

  if (!requestId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="요청" />
        <Text style={styles.emptyText}>잘못된 접근입니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="부자재 찾기" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {!req ? (
          <Text style={styles.emptyText}>요청을 불러오는 중...</Text>
        ) : (
          <>
            <View style={styles.headerBlock}>
              <View style={styles.headerRow}>
                {req.categories && req.categories.length > 0 && (
                  <View style={styles.categoryBadgeRow}>
                    {req.categories.map((c) => (
                      <View key={c} style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {PARTS_CATEGORY_LABEL[c]}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.author}>{req.authorName || '익명'}</Text>
                {req.status === 'closed' && (
                  <View style={styles.closedTag}>
                    <Text style={styles.closedTagText}>종료</Text>
                  </View>
                )}
                <Text style={styles.timeText}>{relativeTime(req.createdAt)}</Text>
              </View>
              {req.text ? <Text style={styles.body}>{req.text}</Text> : null}
              {!isAuthor && user && (
                <Pressable
                  style={styles.requestReportBtn}
                  onPress={() =>
                    setReportTarget({
                      targetType: 'partsRequest',
                      targetId: requestId,
                      targetOwnerUid: req.authorUid,
                      label: '요청 글',
                    })
                  }
                  hitSlop={6}
                >
                  <Flag size={12} color={Colors.textMuted} strokeWidth={2} />
                  <Text style={styles.requestReportText}>요청 글 신고</Text>
                </Pressable>
              )}
            </View>

            {req.photos.length > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroll}
              >
                {req.photos.map((p, i) => (
                  <Image
                    key={`${p.url}-${i}`}
                    source={{ uri: p.url }}
                    style={[styles.photo, { width: SCREEN_W }]}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}

            {isAuthor && (
              <View style={styles.authorActions}>
                <Button
                  label={req.status === 'open' ? '요청 종료' : '요청 다시 열기'}
                  variant="secondary"
                  onPress={onToggleStatus}
                  style={{ flex: 1, height: 44 }}
                />
                <Button
                  label="요청 삭제"
                  variant="danger"
                  onPress={onDeleteRequest}
                  style={{ flex: 1, height: 44 }}
                />
              </View>
            )}

            {/* 답글 작성 영역 — 사장님(merchant active)만 */}
            {isMerchantActive && req.status === 'open' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>우리 매장에서 찾아봐요</Text>
                {myShops.length === 0 ? (
                  <View style={styles.shopEmpty}>
                    <Text style={styles.shopEmptyText}>
                      답글을 달려면 먼저 내 매장을 등록해 주세요.
                    </Text>
                    <Button
                      label="내 매장 등록"
                      onPress={() => router.push('/my-shops')}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                ) : (
                  <>
                    {myShops.length > 1 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.shopChipRow}
                      >
                        {myShops.map((s) => {
                          const active = s.id === selectedShopId;
                          return (
                            <Pressable
                              key={s.id}
                              style={[styles.shopChip, active && styles.shopChipActive]}
                              onPress={() => setSelectedShopId(s.id)}
                            >
                              <Text
                                style={[styles.shopChipText, active && styles.shopChipTextActive]}
                              >
                                {s.displayName || '(이름 미설정)'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}

                    <TextInput
                      value={message}
                      onChangeText={(v) => setMessage(v.slice(0, MAX_MESSAGE_LENGTH))}
                      placeholder="우리 매장에서 찾을 수 있어요. 직접 보여드릴게요!"
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      style={styles.input}
                      textAlignVertical="top"
                    />
                    <View style={styles.replyActions}>
                      {myExistingReply && (
                        <Button
                          label="삭제"
                          variant="secondary"
                          onPress={() => onDeleteReply(selectedShopId!)}
                          style={{ flex: 1, height: 44 }}
                        />
                      )}
                      <Button
                        label={
                          submitting
                            ? '저장 중...'
                            : myExistingReply
                            ? '수정 저장'
                            : '답글 등록'
                        }
                        onPress={onSubmitReply}
                        disabled={submitting || !selectedShopId || !message.trim()}
                        style={{ flex: 1, height: 44 }}
                      />
                    </View>
                  </>
                )}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.replyListHeader}>
                <MessageSquare size={16} color={Colors.text} strokeWidth={2.2} />
                <Text style={styles.replyListTitle}>응답 {replies.length}개</Text>
              </View>
              {replies.length === 0 ? (
                <Text style={styles.emptyText}>
                  아직 답글이 없습니다. 사장님들의 응답을 기다려보세요.
                </Text>
              ) : (
                replies.map((r) => (
                  <ReplyCard
                    key={r.shopId}
                    reply={r}
                    isMine={!!user && r.ownerUid === user.id}
                    onPressShop={() => onPressShopLink(r.shopStoreCodes)}
                    onDelete={() => onDeleteReply(r.shopId)}
                    onReport={() =>
                      setReportTarget({
                        targetType: 'partsReply',
                        targetId: `${requestId}/${r.shopId}`,
                        targetOwnerUid: r.ownerUid,
                        label: '답글',
                      })
                    }
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ReportSheet
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.targetType ?? 'partsRequest'}
        targetId={reportTarget?.targetId ?? ''}
        targetOwnerUid={reportTarget?.targetOwnerUid ?? ''}
        targetLabel={reportTarget?.label}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  headerBlock: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  categoryBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  categoryBadgeText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  author: { fontSize: 15, fontWeight: '700', color: Colors.text },
  closedTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.divider,
  },
  closedTagText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  timeText: { marginLeft: 'auto', fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  body: { fontSize: 15, color: Colors.text, lineHeight: 22, marginTop: 8 },

  photoScroll: { backgroundColor: Colors.background },
  photo: { height: 280 },

  authorActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },

  shopChipRow: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  shopChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  shopChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  shopChipText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  shopChipTextActive: { color: '#fff' },

  shopEmpty: { padding: 8, alignItems: 'center' },
  shopEmptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    color: Colors.text,
  },
  replyActions: { flexDirection: 'row', gap: 8 },

  replyListHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyListTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },

  replyCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  replyCardMine: { borderColor: Colors.primary, backgroundColor: '#F4F8FE' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyShop: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  replyTime: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  replyMessage: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  replyFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  replyVisitBtn: {
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
  replyVisitText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  replyDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  replyDeleteText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  replyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  replyReportText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  requestReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requestReportText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },
});
