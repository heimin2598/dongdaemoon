import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { subscribeMyChats } from '@/lib/chats';
import { subscribeMyShops } from '@/lib/shops';
import { usePartsRequestsStore } from '@/stores/partsRequestsStore';
import { FEATURE_MESSENGER_ENABLED } from '@/constants/features';
import type { Chat, PartsCategory, PartsRequest, Shop } from '@/types';

/**
 * 홈 알림바에 합성되는 알림 모음.
 *
 * 데이터 소스:
 *   - 채팅: 상대가 보낸 마지막 메시지, 48h 이내
 *   - 부자재 (사장님): 본인 분야 매칭 신규 요청, 48h 이내
 *   - 부자재 (방문자): 본인 글에 답글이 달린 경우 (replyCount > 0), 48h 이내
 *
 * 별도 컬렉션 안 만들고 기존 데이터 클라이언트 합성.
 * 만 48h 지나면 자동으로 사라짐 (UI 측 cutoff).
 */

export interface AppNotification {
  id: string;
  type: 'chat' | 'parts_new' | 'parts_reply';
  emoji: string;
  text: string;
  link: string;
  createdAt: number;
}

const HOURS_48 = 48 * 60 * 60 * 1000;

export function useAppNotifications(): AppNotification[] {
  const user = useAuthStore((s) => s.user);
  const isMerchant = user?.role === 'merchant' && user.status === 'active';

  const [chats, setChats] = useState<Chat[]>([]);
  const [myShops, setMyShops] = useState<Shop[]>([]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }
    return subscribeMyChats(user.id, setChats);
  }, [user]);

  useEffect(() => {
    if (!user || !isMerchant) {
      setMyShops([]);
      return;
    }
    return subscribeMyShops(user.id, setMyShops);
  }, [user, isMerchant]);

  const partsFeed = usePartsRequestsStore((s) => s.feed);
  const watchFeed = usePartsRequestsStore((s) => s.watchFeed);
  const unwatchFeed = usePartsRequestsStore((s) => s.unwatchFeed);

  useEffect(() => {
    if (!user) return;
    watchFeed();
    return () => unwatchFeed();
  }, [user, watchFeed, unwatchFeed]);

  // 사장님 분야 집합 — 모든 shops 의 categories union
  const myCategories = useMemo<Set<PartsCategory>>(() => {
    const s = new Set<PartsCategory>();
    for (const shop of myShops) {
      (shop.categories ?? []).forEach((c) => s.add(c));
    }
    return s;
  }, [myShops]);

  return useMemo(() => {
    if (!user) return [];
    const now = Date.now();
    const cutoff = now - HOURS_48;
    const notifs: AppNotification[] = [];

    // 1) 채팅 — 상대가 보낸 마지막 메시지가 48h 이내.
    //    메신저 비활성 상태에서는 아예 노출하지 않음 (탭/링크 다 숨겨져 있음).
    if (FEATURE_MESSENGER_ENABLED) {
      for (const c of chats) {
        if (!c.lastMessageAt || c.lastMessageAt < cutoff) continue;
        if (c.lastSenderUid === user.id) continue;
        if (!c.lastMessage) continue;
        const fromName = user.id === c.merchantUid
          ? (c.visitorDisplayName ?? '고객')
          : (c.shopDisplayName ?? '매장');
        notifs.push({
          id: `chat-${c.id}`,
          type: 'chat',
          emoji: '💬',
          text: `${fromName}: ${c.lastMessage}`,
          link: `/chat/${c.id}`,
          createdAt: c.lastMessageAt,
        });
      }
    }

    // 2) 부자재
    for (const r of partsFeed as PartsRequest[]) {
      if (!r.createdAt || r.createdAt < cutoff) continue;
      if (isMerchant) {
        // 사장님: 본인 분야 매칭 신규 요청 (본인이 작성한 글 제외)
        if (r.authorUid === user.id) continue;
        if (myCategories.size > 0) {
          const cats = r.categories ?? [];
          if (cats.length > 0 && !cats.some((c) => myCategories.has(c))) continue;
        }
        notifs.push({
          id: `parts-new-${r.id}`,
          type: 'parts_new',
          emoji: '🪡',
          text: `신규 부자재 요청 · ${r.text.slice(0, 40)}`,
          link: `/parts/${r.id}`,
          createdAt: r.createdAt,
        });
      } else {
        // 방문자: 본인 글에 답글 있는 경우
        if (r.authorUid !== user.id) continue;
        if (r.replyCount <= 0) continue;
        // updatedAt 가 더 최근 → 그걸 기준
        const t = r.updatedAt && r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
        if (t < cutoff) continue;
        notifs.push({
          id: `parts-reply-${r.id}`,
          type: 'parts_reply',
          emoji: '📨',
          text: `사장님 답글 ${r.replyCount}개 · ${r.text.slice(0, 32)}`,
          link: `/parts/${r.id}`,
          createdAt: t,
        });
      }
    }

    notifs.sort((a, b) => b.createdAt - a.createdAt);
    return notifs;
  }, [user, isMerchant, chats, partsFeed, myCategories]);
}
