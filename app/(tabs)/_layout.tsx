import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Component,
  Home,
  Map,
  MessageCircle,
  Search,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { FEATURE_MESSENGER_ENABLED, FEATURE_PARTS_ENABLED } from '@/constants/features';

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Icon
        size={24}
        color={focused ? Colors.primary : Colors.textMuted}
        strokeWidth={focused ? 2.5 : 2}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // 삼성 3-버튼 네비게이션은 insets.bottom=0 이라 라벨이 시스템 nav 와 붙는다. 이때만 고정 여백을 주고,
  // 상단에도 같은 값을 넣어 아이콘+라벨이 탭바 안에서 세로 중앙에 오게 한다.
  // gesture nav / iPhone 홈 인디케이터 기기는 insets.bottom 을 그대로 써야 하므로 상단은 기본값 유지.
  const hasSystemInset = insets.bottom > 0;
  const tabBarPaddingBottom = hasSystemInset ? insets.bottom : 8;
  const tabBarPaddingTop = hasSystemInset ? 6 : 8;
  const tabBarHeight = 56 + tabBarPaddingBottom;

  const user = useAuthStore((s) => s.user);
  const isMerchant = user?.role === 'merchant' && user.status === 'active';
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingTop: tabBarPaddingTop,
          paddingBottom: tabBarPaddingBottom,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Map} focused={focused} />,
          // 지도 화면은 fullscreen 으로 보여줘야 하므로 이 탭에 있을 때 탭바를 숨긴다.
          // 다른 탭으로 이동하려면 화면 내부 뒤로가기 또는 Android 하드웨어 back 사용.
          tabBarStyle: { display: 'none' },
          href: isMerchant ? null : '/map',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Search} focused={focused} />,
          href: isMerchant ? null : '/search',
        }}
      />

      <Tabs.Screen
        name="customers"
        options={{
          title: t('tabs.customers'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Users} focused={focused} />,
          href: isMerchant ? '/customers' : null,
        }}
      />
      <Tabs.Screen
        name="messenger"
        options={{
          title: t('tabs.messenger'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={MessageCircle} focused={focused} />,
          // 매장 영업 활성화 전까지 탭에서 숨김. FEATURE_MESSENGER_ENABLED true 되면 다시 노출.
          href: FEATURE_MESSENGER_ENABLED ? '/messenger' : null,
        }}
      />

      <Tabs.Screen
        name="parts"
        options={{
          title: isMerchant ? t('tabs.partsSupply') : t('tabs.parts'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Component} focused={focused} />,
          // 부자재 찾기 미오픈 상태에서는 사장님에게도 숨긴다.
          // (열려 있어도 visitor 는 탭 대신 홈 진입 바를 쓴다)
          href: FEATURE_PARTS_ENABLED && isMerchant ? '/parts' : null,
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
