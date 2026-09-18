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
import { Crown, MessageCircle, Clock } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PaywallSheet } from '@/components/common/PaywallSheet';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { subscribeMyChats } from '@/lib/chats';
import type { Chat } from '@/types';
import {
  FEATURE_MESSENGER_ENABLED,
  MESSENGER_COMING_SOON_BODY,
  MESSENGER_COMING_SOON_TITLE,
} from '@/constants/features';

export default function ChatsListScreen() {
  const user = useAuthStore((s) => s.user);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { isPremium, loading: entLoading } = useEntitlement();
  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';

  useEffect(() => {
    if (!FEATURE_MESSENGER_ENABLED) return;
    if (!user) return;
    // 사장님은 항상 메신저 사용. visitor 는 premium 만.
    if (!isMerchantActive && !isPremium) return;
    const unsub = subscribeMyChats(user.id, setChats);
    return () => unsub();
  }, [user, isMerchantActive, isPremium]);

  // 메신저 전체 비활성 — 매장 사장님 정식 가입 완료 전까지 사용 제한
  if (!FEATURE_MESSENGER_ENABLED) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="메신저" />
        <View style={styles.lockedWrap}>
          <View style={[styles.lockedIconWrap, { backgroundColor: '#E8EFF8' }]}>
            <Clock size={36} color={Colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={styles.lockedTitle}>{MESSENGER_COMING_SOON_TITLE}</Text>
          <Text style={styles.lockedDesc}>{MESSENGER_COMING_SOON_BODY}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="채팅" />
        <View style={styles.center}>
          <Text style={styles.muted}>로그인이 필요합니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // visitor 비-프리미엄 → 락 화면
  if (!isMerchantActive && !entLoading && !isPremium) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="메신저" />
        <View style={styles.lockedWrap}>
          <View style={styles.lockedIconWrap}>
            <Crown size={36} color={Colors.warning} strokeWidth={2.2} />
          </View>
          <Text style={styles.lockedTitle}>프리미엄에서 이용 가능</Text>
          <Text style={styles.lockedDesc}>
            매장 사장님과 1:1 채팅으로{'\n'}원단·부자재를 빠르게 문의해 보세요.
          </Text>
          <Button
            label="프리미엄 안내 보기"
            onPress={() => setPaywallOpen(true)}
            style={{ marginTop: 24, paddingHorizontal: 32 }}
          />
        </View>
        <PaywallSheet
          visible={paywallOpen}
          feature="메신저 (사장님 채팅)"
          onClose={() => setPaywallOpen(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="채팅" />
      {chats === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <MessageCircle size={40} color={Colors.textMuted} strokeWidth={1.4} />
          <Text style={styles.emptyTitle}>아직 채팅이 없어요</Text>
          <Text style={styles.emptyDesc}>
            매장 상세 화면에서 사장님께 직접 메시지를 보내 보세요.{'\n'}
            제품 사진과 함께 보유 여부를 물어볼 수 있어요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => <ChatRow chat={item} myUid={user.id} />}
        />
      )}
    </SafeAreaView>
  );
}

function ChatRow({ chat, myUid }: { chat: Chat; myUid: string }) {
  const open = () => router.push(`/chat/${chat.id}` as any);
  const isMine = chat.lastSenderUid === myUid;
  // 내가 사장님(merchantUid) 면 상대(고객) 이름을, 내가 방문자(visitorUid) 면 매장명을 표시
  const counterpartyName =
    myUid === chat.merchantUid
      ? (chat.visitorDisplayName || '(고객)')
      : (chat.shopDisplayName || '(매장)');
  const time = chat.lastMessageAt
    ? new Date(chat.lastMessageAt).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F4F6FA' }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(counterpartyName?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {counterpartyName}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {isMine ? '나: ' : ''}
          {chat.lastMessage || '대화를 시작해 보세요.'}
        </Text>
      </View>
      <Text style={styles.time}>{time}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF4D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedTitle: { fontSize: 17, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  lockedDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: Colors.textMuted },
  list: { paddingVertical: 8 },
  sep: { height: 1, backgroundColor: Colors.divider, marginLeft: 76 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  name: { fontSize: 15, fontWeight: '800', color: Colors.text },
  preview: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: Colors.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
});
