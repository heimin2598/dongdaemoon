import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { isAdminEmail } from '@/constants/admin';

/**
 * MY 탭 — 유저 요약 + 찜한 매장/설정 진입점.
 */
export default function MyTab() {
  const user = useAuthStore((s) => s.user);
  const favoritesCount = useFavoritesStore((s) => s.codes.length);
  const isAdmin = isAdminEmail(user?.email);
  const isMerchantActive = user?.role === 'merchant' && user?.status === 'active';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MY</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
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
        </View>

        {isMerchantActive && (
          <View style={[styles.menu, styles.merchantMenu]}>
            <MenuItem
              icon="🏬"
              label="내 매장 관리"
              hint="사장님"
              onPress={() => router.push('/my-shops')}
            />
          </View>
        )}

        {isAdmin && (
          <View style={[styles.menu, styles.adminMenu]}>
            <MenuItem
              icon="🛠️"
              label="매장 사장님 승인 관리"
              hint="어드민"
              onPress={() => router.push('/admin-merchants')}
            />
          </View>
        )}

        <View style={styles.menu}>
          <MenuItem
            icon="❤️"
            label="관심 매장"
            hint={`${favoritesCount}개`}
            onPress={() => router.push('/favorites')}
          />
          <MenuItem
            icon="⚙️"
            label="설정 및 문의"
            onPress={() => router.push('/settings')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 24, color: '#fff', fontWeight: '800' },
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
  menuIcon: { fontSize: 22 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  menuHint: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  menuArrow: { fontSize: 22, color: Colors.textMuted },
});
