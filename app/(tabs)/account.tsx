import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Crown,
  Gift,
  Heart,
  Image as ImageIcon,
  LogIn,
  MessageCircle,
  Megaphone,
  Settings,
  Shield,
  Store,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { HomeBanner, subscribeActiveBanners } from '@/lib/homeBanners';
import { subscribeBannerSettings } from '@/lib/bannerSettings';
import { HomeBannerCarousel } from '@/components/common/HomeBannerCarousel';
import { FEATURE_MESSENGER_ENABLED } from '@/constants/features';

/**
 * MY 탭 — 유저 요약 + 찜한 매장/설정 진입점.
 */
export default function MyTab() {
  const user = useAuthStore((s) => s.user);
  const favoritesCount = useFavoritesStore((s) => s.codes.length);
  const blockedCount = useBlocksStore((s) => s.list.length);
  const isAdmin = useAdminsStore((s) => s.isAdmin);
  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';
  const isVisitor = user?.role === 'visitor';
  const { isPremium } = useEntitlement();

  // 어드민용: 현재 활성 배너 미리보기 — 사용자에게 노출되는 그대로 (홈/매장 둘 다)
  const [homePreviewBanners, setHomePreviewBanners] = useState<HomeBanner[]>([]);
  const [homePreviewShuffle, setHomePreviewShuffle] = useState(false);
  const [searchPreviewBanners, setSearchPreviewBanners] = useState<HomeBanner[]>([]);
  const [searchPreviewShuffle, setSearchPreviewShuffle] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    const unsubHomeBanners = subscribeActiveBanners('home', setHomePreviewBanners);
    const unsubHomeSettings = subscribeBannerSettings('home', (s) =>
      setHomePreviewShuffle(s.displayMode === 'random'),
    );
    const unsubSearchBanners = subscribeActiveBanners('search', setSearchPreviewBanners);
    const unsubSearchSettings = subscribeBannerSettings('search', (s) =>
      setSearchPreviewShuffle(s.displayMode === 'random'),
    );
    return () => {
      unsubHomeBanners();
      unsubHomeSettings();
      unsubSearchBanners();
      unsubSearchSettings();
    };
  }, [isAdmin]);

  const openBannerLink = (url: string) => {
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      Linking.openURL(url).catch(() => {});
    } else {
      router.push(url as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MY</Text>
        </View>

        {/* 비로그인 — 게스트 안내 + 로그인 / 회원가입 CTA (Apple 정책 5.1.1(v) 대응) */}
        {!user && (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>비회원으로 둘러보고 계세요</Text>
            <Text style={styles.guestDesc}>
              매장 검색·길안내·지도 보기·관심 매장은 자유롭게 사용하실 수 있어요.{'\n'}
              매장 메모와 관심 매장 등의 기능을 사용하려면 로그인이 필요합니다.
            </Text>
            <View style={styles.guestBtnRow}>
              <Pressable style={styles.guestBtnPrimary} onPress={() => router.push('/(auth)/login')}>
                <LogIn size={16} color="#fff" strokeWidth={2.4} />
                <Text style={styles.guestBtnPrimaryText}>로그인</Text>
              </Pressable>
              <Pressable
                style={styles.guestBtnSecondary}
                onPress={() => router.push('/(auth)/signup-select')}
              >
                <UserPlus size={16} color={Colors.primary} strokeWidth={2.4} />
                <Text style={styles.guestBtnSecondaryText}>회원가입</Text>
              </Pressable>
            </View>
          </View>
        )}

        {user && (
        <View style={styles.profileCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.displayName ?? '사용자'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.providerBadge}>
              <Text style={styles.providerText}>
                {user?.provider === 'google' ? 'Google 로그인' :
                 user?.provider === 'apple' ? 'Apple 로그인' : '이메일 로그인'}
              </Text>
            </View>
          </View>
          {user?.shortId && (
            <View style={styles.shortIdCol}>
              <View style={styles.shortIdBox}>
                <Text style={styles.shortIdLabel}>내 ID</Text>
                <Text style={styles.shortIdValue}>{user.shortId}</Text>
              </View>
              {isVisitor && (
                <Pressable
                  onPress={() => router.push('/paywall' as any)}
                  style={[
                    styles.membershipChip,
                    isPremium ? styles.membershipChipPremium : styles.membershipChipFree,
                  ]}
                >
                  <Text
                    style={[
                      styles.membershipChipText,
                      isPremium ? styles.membershipChipTextPremium : styles.membershipChipTextFree,
                    ]}
                  >
                    {isPremium ? '프리미엄' : '일반회원'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
        )}

        {/* 어드민 — 현재 노출 중인 배너 미리보기 (홈 / 매장 찾기) */}
        {isAdmin && (
          <>
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>홈 배너 — 현재 노출 중</Text>
              {homePreviewBanners.length > 0 ? (
                <HomeBannerCarousel
                  banners={homePreviewBanners}
                  onPressBanner={(b) => openBannerLink(b.landingUrl)}
                  shuffle={homePreviewShuffle}
                />
              ) : (
                <View style={styles.previewEmpty}>
                  <Text style={styles.previewEmptyText}>홈 배너가 없습니다.</Text>
                  <Pressable
                    style={styles.previewEmptyBtn}
                    onPress={() => router.push({ pathname: '/admin-banners', params: { kind: 'home' } })}
                  >
                    <Text style={styles.previewEmptyBtnText}>홈 배너 추가 →</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>매장 찾기 배너 — 현재 노출 중</Text>
              {searchPreviewBanners.length > 0 ? (
                <HomeBannerCarousel
                  banners={searchPreviewBanners}
                  onPressBanner={(b) => openBannerLink(b.landingUrl)}
                  shuffle={searchPreviewShuffle}
                />
              ) : (
                <View style={styles.previewEmpty}>
                  <Text style={styles.previewEmptyText}>매장 찾기 배너가 없습니다.</Text>
                  <Pressable
                    style={styles.previewEmptyBtn}
                    onPress={() => router.push({ pathname: '/admin-banners', params: { kind: 'search' } })}
                  >
                    <Text style={styles.previewEmptyBtnText}>매장 배너 추가 →</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}

        {user && (
          <View style={styles.menu}>
            {isVisitor && !isPremium && (
              <MenuItem
                Icon={Crown}
                label="유료 계정 전환하기"
                hint="프리미엄"
                onPress={() => router.push('/paywall' as any)}
              />
            )}
            {/* 결제한 회원이 요금제·해지 경로를 앱 안에서 찾을 수 있어야 한다 (스토어 정책). */}
            {isPremium && (
              <MenuItem
                Icon={Crown}
                label="멤버십 · 구독 관리"
                hint="프리미엄"
                onPress={() => router.push('/paywall' as any)}
              />
            )}
            {!(isVisitor && !isPremium) && FEATURE_MESSENGER_ENABLED && (
              <MenuItem
                Icon={MessageCircle}
                label="내 채팅"
                onPress={() => router.push('/chats')}
              />
            )}
          </View>
        )}

        {isMerchantActive && (
          <View style={[styles.menu, styles.merchantMenu]}>
            <MenuItem
              Icon={Store}
              label="내 매장 관리"
              hint="사장님"
              onPress={() => router.push('/my-shops')}
            />
          </View>
        )}

        {isAdmin && (
          <View style={[styles.menu, styles.adminMenu]}>
            <MenuItem
              Icon={Shield}
              label="관리자 포털"
              hint="대시보드"
              onPress={() => router.push('/admin')}
            />
            <MenuItem
              Icon={Users}
              label="회원 관리"
              hint="어드민"
              onPress={() => router.push('/admin-users')}
            />
            <MenuItem
              Icon={Wrench}
              label="매장 인증 관리"
              hint="어드민"
              onPress={() => router.push('/admin-merchants')}
            />
            <MenuItem
              Icon={ImageIcon}
              label="홈 배너 관리"
              hint="어드민"
              onPress={() =>
                router.push({ pathname: '/admin-banners', params: { kind: 'home' } })
              }
            />
            <MenuItem
              Icon={ImageIcon}
              label="매장 배너 관리"
              hint="어드민"
              onPress={() =>
                router.push({ pathname: '/admin-banners', params: { kind: 'search' } })
              }
            />
            <MenuItem
              Icon={MessageCircle}
              label="문의 관리"
              hint="어드민"
              onPress={() => router.push('/admin-inquiries')}
            />
            <MenuItem
              Icon={Megaphone}
              label="광고 문의 관리"
              hint="어드민"
              onPress={() => router.push('/admin-ad-inquiries')}
            />
            <MenuItem
              Icon={Gift}
              label="프로모션 코드 관리"
              hint="어드민"
              onPress={() => router.push('/admin-promo-codes')}
            />
            <MenuItem
              Icon={Shield}
              label="차단 사용자 관리"
              hint={blockedCount > 0 ? `${blockedCount}명` : undefined}
              onPress={() => router.push('/blocked')}
            />
          </View>
        )}

        {/* 일반 사용자 진입점 — 어드민에게는 노출 안 함 */}
        {!isAdmin && (
          <View style={styles.menu}>
            <MenuItem
              Icon={MessageCircle}
              label="문의하기"
              onPress={() => router.push('/inquiry-new')}
            />
            <MenuItem
              Icon={Megaphone}
              label="광고 문의하기"
              onPress={() => router.push('/ad-inquiry-new')}
            />
          </View>
        )}

        <View style={styles.menu}>
          <MenuItem
            Icon={Heart}
            label="관심 매장"
            hint={`${favoritesCount}개`}
            onPress={() => router.push('/favorites')}
          />
          {/* 차단 목록은 로그인 계정에 붙는다. 비회원에게는 항상 빈 화면이라 감춘다. */}
          {!isAdmin && !!user && (
            <MenuItem
              Icon={Shield}
              label="차단 사용자 관리"
              hint={blockedCount > 0 ? `${blockedCount}명` : undefined}
              onPress={() => router.push('/blocked')}
            />
          )}
          <MenuItem
            Icon={Settings}
            label="설정"
            onPress={() => router.push('/settings')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  Icon,
  label,
  hint,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Icon size={22} color={Colors.text} strokeWidth={2} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
      <ChevronRight size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  guestCard: {
    margin: 16,
    padding: 20,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guestTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  guestDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 8 },
  guestBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  guestBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  guestBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  guestBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  guestBtnSecondaryText: { color: Colors.primary, fontSize: 14, fontWeight: '800' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.text, letterSpacing: -0.5 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    margin: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { fontSize: 17, fontWeight: '800', color: Colors.text },
  email: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  providerBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.divider,
    borderRadius: 8,
  },
  providerText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  shortIdCol: { alignItems: 'center', gap: 6 },
  shortIdBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(11,46,90,0.06)',
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 70,
  },
  shortIdLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  shortIdValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  membershipChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  membershipChipFree: {
    backgroundColor: Colors.divider,
    borderColor: Colors.border,
  },
  membershipChipPremium: {
    backgroundColor: '#FFF4D0',
    borderColor: Colors.warning,
  },
  membershipChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  membershipChipTextFree: { color: Colors.textMuted },
  membershipChipTextPremium: { color: '#8A6A00' },

  previewSection: { marginTop: 4, marginBottom: 8 },
  previewLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  previewEmpty: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  previewEmptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  previewEmptyBtn: { paddingVertical: 6 },
  previewEmptyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  menu: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  adminMenu: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  merchantMenu: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFF8E1',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 14,
  },
  menuIconWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  menuHint: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  menuArrow: { fontSize: 22, color: Colors.textMuted },
});
