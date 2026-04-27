import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';

const EFFECTIVE_DATE = '2026년 4월 23일';
const CONTACT_EMAIL = 'heimin2598@gmail.com';
const APP_NAME = '동대문 종합시장 셰르파';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="개인정보 처리방침" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {APP_NAME}(이하 "서비스")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련
          법령을 준수하기 위하여 노력하고 있습니다. 본 처리방침은 서비스가 이용자의 개인정보를 어떻게
          수집·이용·보관·파기하는지 안내합니다.
        </Text>

        <Section title="제1조 (총칙)">
          <P>
            본 방침은 {APP_NAME}(이하 "서비스")의 모바일 애플리케이션 및 관련 온라인 채널을 통한
            서비스 제공 과정에서 이용자의 개인정보가 처리되는 방식과 이에 관한 이용자의 권리를
            규정합니다.
          </P>
        </Section>

        <Section title="제2조 (수집하는 개인정보 항목 및 수집 방법)">
          <P>서비스는 회원 가입 및 원활한 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.</P>
          <Bullet>필수: 이메일 주소, 비밀번호(암호화 저장)</Bullet>
          <Bullet>선택: 표시 이름(닉네임)</Bullet>
          <Bullet>소셜 로그인 이용 시: 해당 서비스(Google, Apple 등)가 제공하는 고유 식별자 및 이메일</Bullet>
          <Bullet>
            자동 수집: 기기 식별자, 운영체제 정보, 앱 버전, 서비스 이용 기록(검색어, 목적지 등은 이용자
            단말 내부에만 저장되며 서버로 전송되지 않습니다)
          </Bullet>
          <P>수집 방법은 회원 가입, 서비스 이용 과정에서 이용자가 입력하는 정보, 기기에서 자동 수집되는 정보에 한정됩니다.</P>
        </Section>

        <Section title="제3조 (개인정보의 수집 및 이용 목적)">
          <Bullet>회원 식별 및 서비스 제공</Bullet>
          <Bullet>로그인 유지 및 본인 확인</Bullet>
          <Bullet>서비스 안정성 확보, 부정 이용 방지</Bullet>
          <Bullet>고객 문의 응대, 공지사항 전달</Bullet>
          <Bullet>법령 준수 및 분쟁 해결</Bullet>
        </Section>

        <Section title="제4조 (개인정보의 보유 및 이용 기간)">
          <P>
            서비스는 이용자의 개인정보를 수집·이용 목적이 달성될 때까지 보유하며, 목적 달성 후에는
            지체 없이 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안
            보관합니다.
          </P>
          <Bullet>회원 정보: 회원 탈퇴 시까지</Bullet>
          <Bullet>전자상거래 관련 법령에 따른 기록 보존: 해당 법령에서 정하는 기간</Bullet>
        </Section>

        <Section title="제5조 (개인정보의 파기 절차 및 방법)">
          <P>
            개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우, 해당 정보는 재생 불가능한 방법으로
            지체 없이 파기합니다. 전자적 파일 형태의 정보는 기록을 복구할 수 없는 기술적 방법으로
            삭제하며, 종이 문서는 분쇄 또는 소각합니다.
          </P>
        </Section>

        <Section title="제6조 (개인정보의 제3자 제공)">
          <P>
            서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 다음의 경우에는
            예외로 합니다.
          </P>
          <Bullet>이용자가 사전에 동의한 경우</Bullet>
          <Bullet>법령의 규정 또는 수사기관의 적법한 요청이 있는 경우</Bullet>
        </Section>

        <Section title="제7조 (개인정보처리 위탁)">
          <P>서비스는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 외부 사업자에게 위탁할 수 있습니다.</P>
          <Bullet>Google LLC — 회원 인증(Google 로그인)</Bullet>
          <Bullet>Apple Inc. — 회원 인증(Sign in with Apple)</Bullet>
          <Bullet>Google Firebase — 인증, 앱 운영에 필요한 인프라</Bullet>
          <P>
            위탁 업체는 개인정보 보호 관련 법령에 따라 안전하게 개인정보를 관리하며, 위탁 목적 외의 용도로
            사용할 수 없습니다.
          </P>
        </Section>

        <Section title="제8조 (이용자의 권리와 행사 방법)">
          <P>
            이용자는 언제든지 자신의 개인정보 열람·수정·삭제·처리 정지를 요청할 수 있습니다. 요청은 앱 내
            "설정" 화면 또는 개인정보 보호책임자 이메일을 통해 할 수 있으며, 서비스는 지체 없이 조치합니다.
          </P>
          <Bullet>계정 정보 수정 및 탈퇴: 앱 내 설정 → 로그아웃 후 탈퇴 요청</Bullet>
          <Bullet>기기 내 저장 데이터(검색 기록, 관심 매장, 메모) 삭제: 앱 내 설정 → 데이터 섹션</Bullet>
        </Section>

        <Section title="제9조 (개인정보 자동 수집 장치에 관한 사항)">
          <P>
            서비스는 이용자 편의를 위하여 기기 내 저장소(AsyncStorage, SecureStore)를 사용합니다. 이는
            로그인 유지, 최근 검색, 관심 매장, 메모 등 기능 제공을 위해 이용되며 외부 서버로 전송되지
            않습니다. 이용자는 기기 설정 또는 앱 삭제를 통해 언제든지 저장된 정보를 삭제할 수 있습니다.
          </P>
        </Section>

        <Section title="제10조 (개인정보의 안전성 확보 조치)">
          <Bullet>접근 권한 최소화 및 관리</Bullet>
          <Bullet>비밀번호의 단방향 암호화 저장</Bullet>
          <Bullet>전송 구간 암호화(HTTPS/TLS)</Bullet>
          <Bullet>취급 담당자 교육 및 책임 관리</Bullet>
        </Section>

        <Section title="제11조 (개인정보 보호책임자)">
          <P>이용자는 개인정보 관련 문의·민원·피해 구제 등을 아래 연락처로 요청할 수 있습니다.</P>
          <Bullet>성명: 운영 담당자</Bullet>
          <Bullet>이메일: {CONTACT_EMAIL}</Bullet>
        </Section>

        <Section title="제12조 (개인정보 처리방침의 변경)">
          <P>
            본 처리방침은 관련 법령 및 내부 방침 변경에 따라 개정될 수 있으며, 변경 시 앱 내 공지사항을
            통해 공지합니다.
          </P>
        </Section>

        <Text style={styles.footer}>시행일: {EFFECTIVE_DATE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  intro: { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  p: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bullet: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  footer: { marginTop: 28, fontSize: 12, color: Colors.textMuted, textAlign: 'right' },
});
