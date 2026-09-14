import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Slot, usePathname } from 'expo-router';
import {
  BarChart3,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  MessageCircle,
  Shield,
  ShieldAlert,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { signInWithEmail } from '@/lib/auth/firebaseAuth';
import { showConfirmAlert } from '@/utils/alerts';

/**
 * 관리자 그룹 공통 레이아웃.
 *
 * 웹 (>= 1024px): 좌측 브랜드 사이드바 + 상단 헤더 + 우측 컨텐츠 3열
 * 웹 (768~1023px): 좁은 사이드바 (아이콘만) + 컨텐츠
 * 모바일 앱 / 좁은 창: 사이드바 없이 컨텐츠만 (각 화면 자체 헤더 사용)
 *
 * 인증 게이트 (로그인 & 관리자 권한) 는 이 레이아웃에서 처리.
 */

// Design tokens — 웹 관리자 포털용
const T = {
  bg: '#F5F7FA',
  panel: '#FFFFFF',
  border: '#E5E9F0',
  divider: '#EEF2F7',
  text: '#0F1729',
  textMuted: '#6B7280',
  textDim: '#94A3B8',
  primary: '#2563EB',
  primaryDeep: '#1E3A8A',
  primarySoft: '#EFF4FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gold: '#F3B21B',
};

const WIDE_BREAKPOINT = 1024;
const MEDIUM_BREAKPOINT = 768;
const SIDEBAR_WIDE = 260;
const SIDEBAR_NARROW = 76;

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, path: '/admin', section: '핵심' },
  { key: 'stats', label: '통계', icon: BarChart3, path: '/admin-stats', section: '핵심' },
  { key: 'users', label: '회원 관리', icon: Users, path: '/admin-users', section: '회원' },
  { key: 'merchants', label: '매장 인증', icon: Store, path: '/admin-merchants', section: '회원' },
  { key: 'home-banners', label: '홈 배너', icon: ImageIcon, path: '/admin-banners?kind=home', section: '콘텐츠' },
  { key: 'search-banners', label: '매장 배너', icon: ImageIcon, path: '/admin-banners?kind=search', section: '콘텐츠' },
  { key: 'promo-codes', label: '프로모션 코드', icon: Gift, path: '/admin-promo-codes', section: '콘텐츠' },
  { key: 'inquiries', label: '문의 관리', icon: MessageCircle, path: '/admin-inquiries', section: '고객 응대' },
  { key: 'ad-inquiries', label: '광고 문의', icon: Megaphone, path: '/admin-ad-inquiries', section: '고객 응대' },
];

export default function AdminGroupLayout() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAdmin = useAdminsStore((s) => s.isAdmin);

  if (!hydrated) {
    return (
      <View style={styles.centerFull}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  if (!user) return <AdminLoginGate />;
  if (!isAdmin) return <AdminForbidden />;

  return <AdminShell />;
}

function useResponsive() {
  const [w, setW] = useState<number>(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);
  const wide = w >= WIDE_BREAKPOINT;
  const medium = w >= MEDIUM_BREAKPOINT;
  const showSidebar = Platform.OS === 'web' && medium;
  return { width: w, wide, medium, showSidebar };
}

function AdminShell() {
  const { showSidebar, wide } = useResponsive();

  if (!showSidebar) {
    // 모바일 앱 / 좁은 웹: 사이드바 없이 컨텐츠 전체 표시.
    // 각 페이지가 자체 ScreenHeader 를 갖고 있어서 UX 유지됨.
    return <Slot />;
  }

  return (
    <View style={styles.webRoot}>
      <Sidebar wide={wide} />
      <View style={styles.contentPane}>
        <Slot />
      </View>
    </View>
  );
}

function Sidebar({ wide }: { wide: boolean }) {
  const pathname = usePathname();
  const me = useAuthStore((s) => s.user);
  const narrow = !wide;

  const onLogout = () =>
    showConfirmAlert('로그아웃', '관리자 세션을 종료합니다.', () => useAuthStore.getState().signOut());

  // 섹션별로 그룹핑
  const grouped = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, it) => {
    (acc[it.section] ||= []).push(it);
    return acc;
  }, {});

  return (
    <View style={[styles.sidebar, narrow && { width: SIDEBAR_NARROW }]}>
      {/* 브랜드 */}
      <View style={styles.brandBox}>
        <View style={styles.brandBadge}>
          <Shield size={18} color="#fff" strokeWidth={2.4} />
        </View>
        {!narrow && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DDM Sherpa</Text>
            <Text style={styles.brandSub}>Admin Portal</Text>
          </View>
        )}
      </View>

      {/* 사용자 카드 */}
      {!narrow && (
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(me?.displayName?.[0] ?? me?.email?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {me?.displayName ?? '관리자'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {me?.email ?? '-'}
            </Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>ADMIN</Text>
          </View>
        </View>
      )}

      {/* 네비게이션 */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {Object.entries(grouped).map(([section, items]) => (
          <View key={section} style={{ marginTop: 12 }}>
            {!narrow && <Text style={styles.sectionLabel}>{section}</Text>}
            {items.map((item) => {
              const clean = item.path.split('?')[0];
              const isActive = pathname === clean;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.navItem,
                    isActive && styles.navItemActive,
                    narrow && styles.navItemNarrow,
                  ]}
                  onPress={() => router.push(item.path as any)}
                >
                  <item.icon
                    size={18}
                    color={isActive ? '#fff' : T.text}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  {!narrow && (
                    <Text style={[styles.navText, isActive && styles.navTextActive]}>
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* 하단 로그아웃 */}
      <View style={styles.sidebarFoot}>
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <LogOut size={16} color={T.text} strokeWidth={2.2} />
          {!narrow && <Text style={styles.logoutText}>로그아웃</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function AdminForbidden() {
  return (
    <View style={styles.centerFull}>
      <View style={styles.forbidBadge}>
        <ShieldAlert size={40} color={T.danger} strokeWidth={1.8} />
      </View>
      <Text style={styles.forbidTitle}>관리자 전용</Text>
      <Text style={styles.forbidDesc}>
        현재 로그인된 계정은 운영자 권한이 없습니다.{'\n'}관리자 계정으로 다시 로그인해 주세요.
      </Text>
      <View style={{ height: 12 }} />
      <Pressable style={styles.forbidBtn} onPress={() => useAuthStore.getState().signOut()}>
        <Text style={styles.forbidBtnText}>다른 계정으로 로그인</Text>
      </Pressable>
    </View>
  );
}

function AdminLoginGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    if (busy) return;
    setErr(null);
    if (!email.trim() || !password) {
      setErr('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email, password);
    } catch (e: unknown) {
      const errObj = e as { code?: string; message?: string };
      const code = errObj?.code ?? '';
      const msg =
        code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : code.includes('too-many-requests')
            ? '잠시 후 다시 시도해 주세요.'
            : (errObj?.message ?? '로그인 실패');
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.loginPage}>
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginCard}>
          <View style={styles.loginBrand}>
            <View style={styles.brandBadge}>
              <Shield size={20} color="#fff" strokeWidth={2.4} />
            </View>
            <View>
              <Text style={styles.loginBrandName}>DDM Sherpa</Text>
              <Text style={styles.loginBrandSub}>Admin Portal</Text>
            </View>
          </View>

          <View style={styles.loginIconWrap}>
            <Lock size={26} color={T.primary} strokeWidth={2} />
          </View>
          <Text style={styles.loginTitle}>운영자 로그인</Text>
          <Text style={styles.loginDesc}>
            관리자 포털에 접근하려면 관리자 계정으로 로그인해 주세요.
          </Text>

          <View style={styles.loginField}>
            <Text style={styles.loginLabel}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              placeholderTextColor={T.textDim}
              style={styles.loginInput}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              onSubmitEditing={onLogin}
              returnKeyType="next"
            />
          </View>

          <View style={styles.loginField}>
            <Text style={styles.loginLabel}>비밀번호</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              placeholderTextColor={T.textDim}
              style={styles.loginInput}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={onLogin}
              returnKeyType="go"
            />
          </View>

          {err && (
            <View style={styles.loginErrorBox}>
              <Text style={styles.loginErrorText}>{err}</Text>
            </View>
          )}

          <Pressable
            style={[styles.loginBtn, busy && { opacity: 0.5 }]}
            onPress={onLogin}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>로그인</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: T.bg,
  },
  webRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: T.bg,
    minHeight: '100%' as any,
  },
  sidebar: {
    width: SIDEBAR_WIDE,
    backgroundColor: T.panel,
    borderRightWidth: 1,
    borderRightColor: T.border,
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 15,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  userCard: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: T.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  userName: { fontSize: 13, color: T.text, fontWeight: '900' },
  userEmail: { fontSize: 11, color: T.textMuted, marginTop: 1 },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: T.primary,
  },
  roleBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 10,
    color: T.textDim,
    fontWeight: '900',
    paddingHorizontal: 22,
    paddingBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  navItemNarrow: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginHorizontal: 6,
  },
  navItemActive: {
    backgroundColor: T.primaryDeep,
    shadowColor: T.primaryDeep,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  navText: {
    fontSize: 13,
    color: T.text,
    fontWeight: '700',
  },
  navTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  sidebarFoot: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: T.divider,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  logoutText: {
    fontSize: 12,
    color: T.text,
    fontWeight: '800',
  },
  contentPane: {
    flex: 1,
    backgroundColor: T.bg,
    minHeight: '100%' as any,
  },

  // Forbidden
  forbidBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  forbidTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
    marginTop: 12,
  },
  forbidDesc: {
    fontSize: 13,
    color: T.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  forbidBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: T.primary,
  },
  forbidBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Login
  loginPage: {
    flex: 1,
    backgroundColor: T.bg,
  },
  loginScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    padding: 32,
    backgroundColor: T.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  loginBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  loginBrandName: { fontSize: 15, fontWeight: '900', color: T.text },
  loginBrandSub: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  loginIconWrap: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: T.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  loginDesc: {
    fontSize: 13,
    color: T.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  loginField: { gap: 6 },
  loginLabel: { fontSize: 12, color: T.text, fontWeight: '800' },
  loginInput: {
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: T.text,
    backgroundColor: T.bg,
  },
  loginErrorBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  loginErrorText: { fontSize: 12, color: T.danger, fontWeight: '700' },
  loginBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: T.primary,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
