import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';

export default function SignupSelectScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('auth.signUp')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{t('auth.selectRole')}</Text>
        <Text style={styles.desc}>{t('auth.selectRoleDesc')}</Text>

        <View style={styles.cardBlock}>
          <RoleCard
            badge={t('auth.visitor')}
            title={t('auth.visitorTitle')}
            desc={t('auth.visitorDesc')}
            icon="🧭"
            onPress={() => router.push('/(auth)/signup')}
          />
          <RoleCard
            badge={t('auth.merchant')}
            title={t('auth.merchantTitle')}
            desc={t('auth.merchantDesc')}
            icon="🏬"
            onPress={() => router.push('/(auth)/signup-store')}
          />
        </View>

        <Text style={styles.footer}>
          {t('auth.alreadyHaveAccount')}{' '}
          <Text style={styles.link} onPress={() => router.replace('/(auth)/login')}>
            {t('auth.signIn')}
          </Text>
        </Text>

        <Text style={styles.legalNotice}>
          회원가입에는{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/terms-of-service')}>
            이용약관
          </Text>
          {' 및 '}
          <Text style={styles.legalLink} onPress={() => router.push('/privacy-policy')}>
            개인정보처리방침
          </Text>
          에 동의가 필요합니다.
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
      <ChevronRight size={22} color={Colors.textMuted} />
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
  legalNotice: {
    marginTop: 18,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  legalLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
});
