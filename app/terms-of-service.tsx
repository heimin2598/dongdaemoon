import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';

const EFFECTIVE_DATE = '2026년 4월 29일';
const CONTACT_EMAIL = 'heimin2598@gmail.com';
const APP_NAME = '동대문 종합시장 셰르파';

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="이용약관" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          본 약관은 {APP_NAME}(이하 "서비스")의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및
          책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다. 이용자는 서비스를 이용함으로써 본
          약관에 동의한 것으로 간주됩니다.
        </Text>

        <Section title="제1조 (목적)">
          <P>
            본 약관은 서비스가 제공하는 동대문 종합시장 내 점포 검색, 길안내, 관심 매장 관리 등의 모바일
            애플리케이션 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무·책임사항을 규정합니다.
          </P>
        </Section>

        <Section title="제2조 (정의)">
          <Bullet>"서비스": 이용자가 단말기(모바일 기기)를 통해 접속하여 이용할 수 있는 {APP_NAME} 애플리케이션 및 부수적 서비스</Bullet>
          <Bullet>"이용자": 본 약관에 동의하고 서비스에 접속하여 이용하는 회원 또는 비회원</Bullet>
          <Bullet>"회원": 회원 가입 절차를 완료하고 서비스를 지속적으로 이용할 수 있는 자</Bullet>
          <Bullet>"콘텐츠": 서비스에서 제공되는 지도, 점포 정보, 검색 결과, 이미지 등 일체의 정보</Bullet>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <P>
            1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 그 효력이 발생합니다.
          </P>
          <P>
            2. 서비스는 관련 법령에 위배되지 않는 범위에서 약관을 개정할 수 있으며, 약관이 변경될 경우
            변경 사항 및 시행일을 공지합니다. 이용자가 변경된 약관에 동의하지 않을 경우 회원 탈퇴 또는
            서비스 이용 중단을 통해 거부 의사를 표시할 수 있습니다.
          </P>
        </Section>

        <Section title="제4조 (서비스의 제공 및 변경)">
          <Bullet>동대문 종합시장 점포·카테고리·편의시설 검색 기능</Bullet>
          <Bullet>매장 위치 지도 및 실내 길안내(수동 출발지 기반)</Bullet>
          <Bullet>관심 매장 등록 및 메모 기능</Bullet>
          <Bullet>매장 리뷰·평점 작성 기능</Bullet>
          <Bullet>부자재 찾기 요청 작성 및 사장님 응답 기능</Bullet>
          <Bullet>공지사항 및 업데이트 안내</Bullet>
          <P>
            서비스는 운영상·기술상 필요한 경우 제공 중인 서비스의 전부 또는 일부를 변경할 수 있으며,
            중요한 변경 사항은 사전에 공지합니다.
          </P>
        </Section>

        <Section title="제5조 (서비스의 중단)">
          <P>
            서비스는 시스템 점검, 장비 교체, 천재지변, 전시·사변, 통신 장애 등 불가항력적 사유가 발생한
            경우 서비스 제공을 일시 중단할 수 있으며, 이러한 경우 서비스는 이로 인해 이용자가 입은 손해에
            대하여 고의 또는 중대한 과실이 없는 한 책임지지 않습니다.
          </P>
        </Section>

        <Section title="제6조 (회원 가입)">
          <P>
            1. 이용자는 서비스에서 정한 양식에 따라 회원 정보를 기입한 후 본 약관 및 개인정보 처리방침에
            동의함으로써 회원 가입을 신청합니다.
          </P>
          <P>
            2. 서비스는 다음 각 호에 해당하는 신청에 대해서는 가입을 승낙하지 않거나 사후 해지할 수 있습니다.
          </P>
          <Bullet>타인의 명의를 이용한 경우</Bullet>
          <Bullet>허위 정보를 기재하거나 필수 정보를 누락한 경우</Bullet>
          <Bullet>관련 법령 또는 본 약관에 위반되는 경우</Bullet>
        </Section>

        <Section title="제7조 (회원 탈퇴 및 자격 상실)">
          <P>
            회원은 언제든지 앱 내 설정 메뉴 또는 이메일({CONTACT_EMAIL})을 통해 탈퇴를 요청할 수 있으며,
            서비스는 요청을 확인한 후 즉시 탈퇴 처리를 진행합니다. 회원이 약관에 위반되는 행위를 한 경우
            서비스는 사전 통지 없이 회원 자격을 정지하거나 상실시킬 수 있습니다.
          </P>
        </Section>

        <Section title="제8조 (이용자의 의무)">
          <Bullet>회원 정보(이메일, 비밀번호 등)를 타인과 공유하지 않을 것</Bullet>
          <Bullet>서비스의 운영을 방해하는 일체의 행위를 하지 않을 것</Bullet>
          <Bullet>타인의 권리를 침해하거나 명예를 훼손하는 행위를 하지 않을 것</Bullet>
          <Bullet>서비스에서 제공하는 콘텐츠를 상업적 목적으로 무단 이용하지 않을 것</Bullet>
          <Bullet>관련 법령, 본 약관, 서비스 공지사항을 준수할 것</Bullet>
        </Section>

        <Section title="제9조 (이용자 게시물)">
          <P>
            1. "이용자 게시물"이란 이용자가 서비스 내에 작성·업로드하는 리뷰, 평점, 부자재 찾기 요청
            글·사진, 사장님 답글, 매장 소개 등 일체의 콘텐츠를 의미합니다.
          </P>
          <P>2. 이용자는 다음 각 호에 해당하는 게시물을 작성·업로드해서는 안 됩니다.</P>
          <Bullet>욕설, 비방, 차별, 혐오 표현이 포함된 게시물</Bullet>
          <Bullet>음란하거나 폭력적이거나 청소년 유해 콘텐츠</Bullet>
          <Bullet>허위 사실, 과장 광고, 사기성 정보</Bullet>
          <Bullet>제3자의 저작권·초상권·상표권 등 권리를 침해하는 게시물</Bullet>
          <Bullet>스팸, 무단 광고, 도배성 게시물</Bullet>
          <Bullet>개인정보(연락처·주소·계좌번호 등)를 제3자가 알 수 있는 형태로 노출하는 게시물</Bullet>
          <Bullet>관련 법령 또는 본 약관에 위반되는 일체의 게시물</Bullet>
          <P>
            3. 이용자는 본인이 작성·업로드한 이용자 게시물에 대한 모든 책임(민·형사상 책임 포함)을 부담하며,
            이로 인해 발생하는 분쟁에 대해 서비스는 책임지지 않습니다.
          </P>
          <P>
            4. 서비스는 이용자 게시물이 본 약관 또는 관련 법령에 위반되거나 권리 침해 신고가 접수된 경우,
            사전 통지 없이 해당 게시물을 비공개·삭제하거나 작성자의 서비스 이용을 일시 정지·영구 정지할
            수 있습니다.
          </P>
          <P>
            5. 이용자는 부적절한 게시물을 발견한 경우 앱 내 신고 기능을 통해 신고할 수 있으며, 서비스는
            신고 접수 후 24시간 이내에 검토하여 필요한 조치를 취합니다.
          </P>
          <P>
            6. 이용자는 다른 이용자를 차단할 수 있으며, 차단된 이용자의 게시물은 차단을 설정한 이용자의
            화면에 노출되지 않습니다.
          </P>
        </Section>

        <Section title="제10조 (저작권의 귀속 및 이용 제한)">
          <P>
            1. 서비스가 작성한 저작물, 디자인, 지도 데이터, 검색 결과, 이미지 등에 대한 저작권 및 기타
            지적재산권은 서비스에 귀속됩니다.
          </P>
          <P>
            2. 이용자가 서비스 내에 등록·업로드한 이용자 게시물의 저작권은 작성자 본인에게 귀속됩니다.
            다만 이용자는 서비스가 해당 게시물을 서비스 운영, 홍보, 통계 분석 등을 위해 무상으로
            이용·복제·수정·배포·전송할 수 있는 비독점적 권리를 보유함에 동의합니다.
          </P>
          <P>
            3. 이용자는 서비스가 제공하는 정보를 서비스의 사전 동의 없이 복제·전송·출판·배포·방송 기타
            상업적 목적으로 이용하거나 제3자에게 제공할 수 없습니다.
          </P>
        </Section>

        <Section title="제11조 (면책조항)">
          <P>
            1. 서비스는 천재지변, 전쟁, 기간통신사업자의 서비스 중지, 시스템 점검 등 불가항력적 사유로
            서비스를 제공할 수 없는 경우 책임이 면제됩니다.
          </P>
          <P>
            2. 서비스는 이용자의 귀책 사유로 인한 서비스 이용 장애, 이용자 간 또는 이용자와 제3자 간의
            서비스를 매개로 한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임을 지지
            않습니다.
          </P>
          <P>
            3. 서비스가 제공하는 점포 정보는 제3자로부터 수집한 자료에 기반하며, 정확성·최신성을 위해
            노력하나 오류·누락 가능성이 있습니다. 이로 인한 직·간접적 손해에 대해 서비스는 고의 또는
            중대한 과실이 없는 한 책임을 지지 않습니다.
          </P>
        </Section>

        <Section title="제12조 (분쟁의 해결)">
          <P>
            서비스와 이용자 간 발생한 분쟁은 상호 협의를 통해 해결하는 것을 원칙으로 합니다. 협의가
            이루어지지 않을 경우 전자상거래 소비자 보호 관련 법령 및 기타 관계 법령에 따라 해결합니다.
          </P>
        </Section>

        <Section title="제13조 (재판권 및 준거법)">
          <P>
            본 약관은 대한민국 법률에 따라 규율되고 해석됩니다. 본 약관과 관련하여 발생한 분쟁에 대한
            관할 법원은 민사소송법에 따른 관할 법원으로 합니다.
          </P>
        </Section>

        <Section title="문의">
          <P>이용약관 관련 문의는 아래 연락처로 연락해 주시기 바랍니다.</P>
          <Bullet>이메일: {CONTACT_EMAIL}</Bullet>
        </Section>

        <Section title="서비스 운영자 정보">
          <Bullet>상호: 헤이민</Bullet>
          <Bullet>대표자: 정혜민</Bullet>
          <Bullet>사업자등록번호: 665-38-00101</Bullet>
          <Bullet>통신판매업 신고번호: 제 2017-강원원주-00079호</Bullet>
          <Bullet>사업장 주소: 강원도 원주시 개운4길 1-5 3층</Bullet>
          <Bullet>고객센터 전화: 033-761-2560</Bullet>
          <Bullet>이메일: rothy2874@naver.com</Bullet>
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
