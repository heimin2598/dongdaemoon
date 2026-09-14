import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { HomeBanner } from '@/lib/homeBanners';
import { shuffleArray } from '@/lib/bannerSettings';

interface Props {
  banners: HomeBanner[];
  onPressBanner?: (banner: HomeBanner) => void;
  /** 자동 롤링 간격(ms). 0 또는 음수면 비활성화. */
  intervalMs?: number;
  /** true 면 진입 시 한 번 셔플해서 노출. */
  shuffle?: boolean;
}

export function HomeBannerCarousel({ banners, onPressBanner, intervalMs = 3000, shuffle }: Props) {
  // 셔플 모드: banners 갯수가 변할 때만 다시 섞음 (매 렌더 X — 보는 동안 안정)
  const displayBanners = useMemo(
    () => (shuffle ? shuffleArray(banners) : banners),
    // banners 의 id 시퀀스가 바뀌면 다시 섞음
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shuffle, banners.map((b) => b.id).join('|')],
  );
  const [bannerWidth, setBannerWidth] = useState<number>(
    () => Dimensions.get('window').width,
  );
  const [bannerIdx, setBannerIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // 갯수 변동 시 인덱스 안전 클램프
  useEffect(() => {
    setBannerIdx((curr) => (curr >= displayBanners.length ? 0 : curr));
  }, [displayBanners.length]);

  useEffect(() => {
    if (intervalMs <= 0 || bannerWidth <= 0 || displayBanners.length <= 1) return;
    const id = setInterval(() => {
      setBannerIdx((curr) => {
        const next = (curr + 1) % displayBanners.length;
        scrollRef.current?.scrollTo({
          x: next * bannerWidth,
          animated: true,
        });
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [bannerWidth, displayBanners.length, intervalMs]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
    setBannerIdx(idx);
  };

  if (displayBanners.length === 0) return null;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setBannerWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {displayBanners.map((b, i) => (
          <Pressable
            key={b.id}
            onPress={() => onPressBanner?.(b)}
            style={{ width: bannerWidth, paddingHorizontal: 16 }}
          >
            <View style={styles.card}>
              {b.imageUrl ? (
                <Image source={{ uri: b.imageUrl }} style={styles.bg} resizeMode="cover" />
              ) : null}
              <View style={styles.counterWrap}>
                <Text style={styles.counter}>
                  {i + 1} / {displayBanners.length}
                </Text>
              </View>
              <View style={styles.copyWrap}>
                <Text style={[styles.sub, { color: b.subColor }]} numberOfLines={1}>
                  {b.subCopy}
                </Text>
                <View style={styles.mainRow}>
                  <Text style={[styles.main, { color: b.mainColor }]} numberOfLines={2}>
                    {b.mainCopy}
                  </Text>
                  <ChevronRight size={20} color={b.mainColor} strokeWidth={2.4} />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {displayBanners.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === bannerIdx && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  card: {
    aspectRatio: 2.7,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  counterWrap: { position: 'absolute', top: 12, right: 14 },
  counter: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  copyWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  sub: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  main: { flex: 1, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: Colors.primary,
  },
});
