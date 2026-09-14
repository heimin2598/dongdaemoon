import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { subscribeMyShops } from '@/lib/shops';
import { subscribeProducts } from '@/lib/shopProducts';
import { subscribeMyChats } from '@/lib/chats';
import { usePartsRequestsStore } from '@/stores/partsRequestsStore';
import { useAppNotifications } from '@/lib/notifications';
import { getShopStatusDisplay } from '@/lib/shopStatus';
import type { Chat, OperatingStatus, PartsCategory, Shop, ShopProduct } from '@/types';

/**
 * 사장님 홈 화면용 핵심 운영 지표 집계 hook.
 * MD 명세 (ddm_sherpa_merchant_home_added_features.md) 의 #9 데이터 집계 로직 구현.
 */

export interface MerchantHomeStats {
  shopCount: number;
  unreadMessageCount: number;
  newPartsRequestCount: number;
  productCount: number;
  paymentMethodCount: number;
  photoCount: number;
  hasDescription: boolean;
  hasBusinessHours: boolean;
  operatingStatus: OperatingStatus;
  operatingStatusLabel: string;
  shop?: Shop;
}

const HOURS_48 = 48 * 60 * 60 * 1000;

export function useMerchantHomeStats(): MerchantHomeStats | null {
  const user = useAuthStore((s) => s.user);
  const [shops, setShops] = useState<Shop[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);

  // shops
  useEffect(() => {
    if (!user) return;
    return subscribeMyShops(user.id, setShops);
  }, [user]);

  // chats (사장님이 받은 새 메시지 카운트)
  useEffect(() => {
    if (!user) return;
    return subscribeMyChats(user.id, setChats);
  }, [user]);

  // 첫 매장의 products
  const firstShopId = shops[0]?.id;
  useEffect(() => {
    if (!firstShopId) {
      setProducts([]);
      return;
    }
    return subscribeProducts(firstShopId, setProducts);
  }, [firstShopId]);

  // 부자재 요청 — 내 분야 신규 (48h 이내)
  const partsFeed = usePartsRequestsStore((s) => s.feed);
  const watchFeed = usePartsRequestsStore((s) => s.watchFeed);
  const unwatchFeed = usePartsRequestsStore((s) => s.unwatchFeed);
  useEffect(() => {
    if (!user) return;
    watchFeed();
    return () => unwatchFeed();
  }, [user, watchFeed, unwatchFeed]);

  const myCategories = useMemo<Set<PartsCategory>>(() => {
    const s = new Set<PartsCategory>();
    for (const shop of shops) (shop.categories ?? []).forEach((c) => s.add(c));
    return s;
  }, [shops]);

  return useMemo(() => {
    if (!user) return null;
    const shop = shops[0];
    const now = Date.now();
    const cutoff = now - HOURS_48;

    // 미답 메시지 수 (48h 이내, 마지막 발신자가 본인이 아닌 채팅)
    const unreadMessageCount = chats.filter(
      (c) =>
        c.lastMessageAt &&
        c.lastMessageAt > cutoff &&
        c.lastSenderUid &&
        c.lastSenderUid !== user.id,
    ).length;

    // 신규 부자재 요청 — 내 분야 매칭 + 48h 이내
    const newPartsRequestCount = partsFeed.filter((r) => {
      if (!r.createdAt || r.createdAt < cutoff) return false;
      if (r.authorUid === user.id) return false;
      if (myCategories.size === 0) return true;
      const cats = r.categories ?? [];
      if (cats.length === 0) return true;
      return cats.some((c) => myCategories.has(c));
    }).length;

    const display = getShopStatusDisplay(shop);

    return {
      shopCount: shops.length,
      unreadMessageCount,
      newPartsRequestCount,
      productCount: products.length,
      paymentMethodCount: shop?.paymentMethods?.length ?? 0,
      photoCount: shop?.photos?.length ?? 0,
      hasDescription: !!shop?.description?.trim(),
      hasBusinessHours:
        (shop?.businessHoursSchedule?.length ?? 0) > 0 || !!shop?.businessHours?.trim(),
      operatingStatus: display.status,
      operatingStatusLabel: display.label,
      shop,
    };
  }, [user, shops, chats, products, partsFeed, myCategories]);
}

/**
 * 알림 카운트 (홈 상단 "신규 알림 N" 표시용) — 48h 이내 알림 총합.
 */
export function useMerchantNotificationCount(): number {
  const notifs = useAppNotifications();
  return notifs.length;
}
