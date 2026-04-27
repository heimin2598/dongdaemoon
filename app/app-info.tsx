import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';

const APP_NAME = '동대문 종합시장 셰르파';
const APP_NAME_EN = 'DDM Sherpa';
const VERSION = '0.1.0';
const BUILD_DATE = '2026년 4월 23일';
const CONTACT_EMAIL = 'heimin2598@gmail.com';
const AD_EMAIL = 'rothy2874@naver.com';
const DEVELOPER = '동대문 셰르파 팀';

export default function AppInfoScreen() {
  const openMail = (to: string, subject: string) => {
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="앱 정보" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 앱 히어로 */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>셰르파</Text>
          </View>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.appNameEn}>{APP_NAME_EN}</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>v{VERSION}</Text>
          </View>
        </View>

        {/* 소개 */}
        <Section title="서비스 소개">
          <P>
            {APP_NAME}는 동대문 종합시장을 방문하는 분들이 원하는 점포와 편의시설을 쉽게 찾을 수 있도록
            돕는 가이드 앱입니다. 3,662여 개 업체 정보와 층별 배치도, 실내 길안내, 관심 매장 관리까지
            한 앱에서 제공합니다.
          </P>
        </Section>

        <Section title="주요 기능">
          <Bullet>🔎 상호명·품목·호수·전화번호 통합 검색</Bullet>
          <Bullet>🗺️ 10개 층 × 4개 동(B/A/C/N) 배치도 열람</Bullet>
          <Bullet>📍 수동 출발지 기반 실내 길안내</Bullet>
          <Bullet>❤️ 관심 매장 등록 및 순서 변경</Bullet>
          <Bullet>📝 매장별 메모 기능</Bullet>
          <Bullet>📞 원탭 전화 연결</Bullet>
        </Section>

        {/* 버전/빌드 정보 */}
        <Section title="버전 정보">
          <Row label="앱 버전" value={VERSION} />
          <Row label="빌드 일자" value={BUILD_DATE} />
          <Row label="플랫폼" value={Platform.OS === 'web' ? '웹' : Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} />
        </Section>

        {/* 개발자 정보 */}
        <Section title="개발자">
          <Row label="제작" value={DEVELOPER} />
          <Pressable onPress={() => openMail(CONTACT_EMAIL, '[앱 문의]')}>
            <Row label="문의" value={CONTACT_EMAIL} link />
          </Pressable>
          <Pressable onPress={() => openMail(AD_EMAIL, '[광고 문의]')}>
            <Row label="광고 문의" value={AD_EMAIL} link />
          </Pressable>
        </Section>

        {/* 데이터 출처 */}
        <Section title="데이터 출처 및 고지">
          <P>
            본 앱의 점포·카테고리·위치 정보는 동대문 종합시장 공식 안내 자료 및 공개된 입주상인
            디렉터리를 기반으로 수집·정리되었습니다. 정확성을 위해 노력하고 있으나 실제 운영 현황과
            다를 수 있으며, 오류 발견 시 설정 → "업체 정보 변경 신청 및 신규업체 등록" 으로 제보해
            주시면 신속히 반영하겠습니다.
          </P>
        </Section>

        <Section title="오픈소스 고지">
          <Bullet>React Native, Expo — Facebook/Expo (MIT)</Bullet>
          <Bullet>Zustand — Poimandres (MIT)</Bullet>
          <Bullet>react-native-svg — Software Mansion (MIT)</Bullet>
          <Bullet>react-native-reanimated — Software Mansion (MIT)</Bullet>
          <Bullet>react-native-draggable-flatlist — computerjazz (MIT)</Bullet>
        </Section>

        <Text style={styles.copyright}>
          © {new Date().getFullYear()} {DEVELOPER}. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bullet}>{children}</Text>;
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, link && styles.rowValueLink]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  appName: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  appNameEn: { fontSize: 13, color: Colors.textMuted, marginTop: 2, letterSpacing: 1 },
  versionPill: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.divider,
  },
  versionText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '800', marginBottom: 8 },
  card: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  p: { fontSize: 13, color: Colors.text, lineHeight: 20, padding: 10 },
  bullet: { fontSize: 13, color: Colors.text, lineHeight: 22, paddingHorizontal: 10, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLabel: { width: 92, fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '600' },
  rowValueLink: { color: Colors.primary, fontWeight: '700' },

  copyright: { marginTop: 28, fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
});
