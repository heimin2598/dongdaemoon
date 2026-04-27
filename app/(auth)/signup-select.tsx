import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';

export default function SignupSelectScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="회원가입" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>회원 유형 선택</Text>
        <Text style={styles.desc}>가입 유형을 선택해 주세요.</Text>

        <View style={styles.cardBlock}>
          <RoleCard
            badge="방문자"
            title="방문자 회원가입"
            desc={'동대문 종합시장을 방문하는\n고객을 위한 가입입니다.'}
            icon="🧭"
            onPress={() => router.push('/(auth)/signup')}
          />
          <RoleCard
            badge="매장 사장님"
            title="매장 사장님 회원가입"
            desc={'동대문 종합시장 내 매장을\n운영하시는 사장님을 위한 가입입니다.'}
            icon="🏬"
            onPress={() => router.push('/(auth)/signup-store')}
          />
        </View>

        <Text style={styles.footer}>
          이미 계정이 있으신가요?{' '}
          <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>
            로그인
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface RoleCardProps {
  badge: string;
  title: string;
  desc: string;
  icon: string;
  onPress: () => void;
}

function RoleCard({ badge, title, desc, icon, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: 10 },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, marginBottom: 28, marginTop: 6 },
  cardBlock: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconText: { fontSize: 26 },
  cardBody: { flex: 1 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginBottom: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 17 },
  chevron: { fontSize: 28, color: Colors.textMuted, marginLeft: 8 },
  footer: { marginTop: 28, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  link: { color: Colors.primary, fontWeight: '700' },
});
