# Play Console 앱 단위 이관 런북 (DDM Sherpa)

전제 — **앱 단위 이관(App transfer)**, 대상 계정 = **개인 계정 (2023-11-13 이후 생성)**.
Play Console 만 이관하고 AdMob / RevenueCat / Firebase / Apple 계정은 그대로 유지한다고 가정.

---

## 실행 결과 (2026-09-14 완료)

이관 대상 계정 = **HEIMIN STUDIO / heimindrive@gmail.com** (개인 계정, ID 7595859281407191395). 앱 5개 전부 이관됨.

| 항목 | 결과 |
| --- | --- |
| 프로덕션 액세스 | **승계됨.** 셰르파·바이픽스 모두 "프로덕션" 유지. 테스트 요건 작업 항목 안 뜸 |
| 기본 통화 | **KRW 일치.** 인앱 상품 있는 앱 자동 미게시 발생 안 함 |
| 서비스 계정 | GCP `heimin-studio-play` (heimindrive 소유) → `revenuecat-play@heimin-studio-play.iam.gserviceaccount.com` |
| 서비스 계정 역할 | Pub/Sub **관리자** + 모니터링 뷰어. 편집자로는 RTDN 구독 관리가 막힐 수 있어 관리자로 부여 |
| Play 권한 부여 방식 | **앱 권한**(셰르파)만. 계정 권한은 미부여 |
| RevenueCat 자격증명 | **즉시 Valid.** 36시간 전파 대기 발생 안 함 |
| RTDN | 토픽 `projects/heimin-studio-play/topics/Play-Store-Notifications`, 테스트 알림 수신 확인 |
| RTDN 알림 콘텐츠 | **"모든 일회성 제품" 포함**으로 변경. `premium_lifetime` 이 일회성이라 필수 |
| 앱 콘텐츠 / 데이터 보안 | 전부 승계됨 ("주의 필요" 없음) |
| 사람 권한 | heimin2598 = 활성 + 관리자(모든 권한) |
| AdMob | 게시자 ID·앱 ID 불변. 스토어 링크 신규 연결. `app-ads.txt` 를 heiminstudio.com 에 배포 |

**GCP 결제 계정 — 반드시 확인할 것**

`heimin-studio-play` 는 생성 직후 **결제 계정이 없는 상태**였다. Pub/Sub 은 무료 한도(월 10GiB) 안이어도 프로젝트에 활성 결제 계정이 연결돼 있어야 동작한다. 결제 계정 없이도 당장은 RTDN 이 동작했지만, 끊기면 에러 없이 조용히 알림만 안 오는 실패 모드라 위험하다.

→ heimin2598 소유의 기존 결제 계정 **`Firebase 결제` (015BE4-D2DDC2-068720, `dongdaemoon-vscode` 와 동일)** 를 연결해 해결. 카드 신규 등록 불필요.

절차: heimin2598 로 결제 계정 → 권한 → `heimindrive@gmail.com` 에 **결제 계정 사용자** 역할 부여 → heimindrive 로 프로젝트에서 결제 계정 연결. 확인은 **결제 → 계정 관리** 화면의 프로젝트 목록으로 한다 (heimin2598 의 `결제 계정 관리 → 프로젝트` 탭에는 안 보인다. 그 계정에 프로젝트 조회 권한이 없어서다).

**남은 항목**

- Play 결제 프로필 은행 계좌 `···741` — **확인 대기중**. 소액 테스트 입금 오면 금액 입력해야 지급 가능
- AdMob 애드센스 신원 확인 — 제출 완료, 심사 대기. 승인되면 지급 보류 자동 해제. 수익 US$0.63 / 기준액 US$100 이라 급하지 않음
- AdMob 앱 인증 — app-ads.txt 크롤이 24시간 주기라 익일 자동 통과 예상

**해결된 것 — Firebase ↔ Play 링크**

"일치하는 Play 앱을 찾을 수 없음" 의 원인은 권한이 아니라 **`dongdaemoon-vscode` 에 Firebase Android 앱이 없었던 것**이었다. 이 앱은 Firebase 웹 SDK(`appId: 1:387030473505:web:...`)로 동작해 `google-services.json` 자체가 없다. Google Play 통합은 Firebase **Android 앱**을 패키지명으로 매칭하므로 매칭 대상이 없었다.

→ Firebase 에 Android 앱 `com.ddmsherpa.app` 등록(SHA-1 없이, `google-services.json` 은 프로젝트에 넣지 않음) 후 연결 성공. 앱 배포/Crashlytics/애널리틱스 3개 통합 모두 사용 설정. 앱 코드는 변경 없음.
- 프로덕션 미출시 앱 3개(스톡레이더·애드푸딩·영월산업진흥원)는 새 계정에서 12명×14일을 새로 채워야 함

---

## 0. 이 앱의 Play 의존성 지도

이관으로 **깨지지 않는 것** (조치 불필요):

| 항목 | 이유 |
| --- | --- |
| 패키지명 `com.ddmsherpa.app` | 이관해도 불변 |
| 앱 서명 키 (Play App Signing) | 앱과 함께 이관됨. 기존 설치 사용자 업데이트 정상 |
| Firebase (Auth / Firestore / Storage) | Play 와 무관. 프로젝트 `dongdaemoon-vscode` 유지 |
| Google 로그인 | `GOOGLE_ANDROID_CLIENT_ID = undefined` → 웹 OAuth 클라이언트만 사용. SHA-1 / Play 비의존 |
| Apple 로그인 | App Store 측. 무관 |
| RevenueCat API 키 `goog_mAfXoQ...` | RC 프로젝트 소유. Play 계정과 무관 |
| Sentry / DeepL | 무관 |
| EAS 업로드 키스토어 | Expo 계정 `heiminstudio` 가 관리. 무관 |
| 리뷰 / 평점 / 설치 기반 / 구독자 | 앱과 함께 이관됨 |

이관으로 **깨지는 것** (조치 필수):

| 항목 | 증상 |
| --- | --- |
| RevenueCat ↔ Play 서비스 자격증명 | **신규 결제 전부 실패.** 최대 36시간 |
| RTDN (실시간 개발자 알림) Pub/Sub | 갱신·해지가 Firestore entitlement 에 반영 안 됨 |
| Play Console 사용자 권한 | 운영자·서비스 계정 권한 전부 초기화 |
| AdMob ↔ Play 스토어 링크 | 광고 매칭·수익 최적화 저하 가능 |
| 보고서 / 정산 이력 | 이관 안 됨. **사전 다운로드 필수** |
| 이관 전 주문의 환불 | 구계정에서만 가능 |

---

## 1. 이관 전 (오늘 저녁 전에 반드시)

### 1-1. 12명×14일 클로즈드 테스트 요건 — 실제 적용 범위

**결론: 이미 프로덕션에 게시된 DDM Sherpa 는 이관 후에도 업데이트 출시가 가능할 가능성이 높다.**

- 요건은 **계정 단위가 아니라 앱 단위**로, 각 앱의 **첫 프로덕션 출시**를 막는 게이트다.
- 이미 프로덕션 액세스를 가진 앱의 **업데이트에는 적용되지 않는다.** ("once an app has production access, its updates never need testers again")
- DDM Sherpa 는 이미 프로덕션에 게시돼 있고, 게시 상태·통계·리뷰가 앱과 함께 이관된다.

남는 불확실성 — 공식 문서가 "이관된 앱" 케이스를 명시적으로 다루지 않는다. 커뮤니티에는 아직 요건을 못 채운 앱이 이관될 때 **기존 테스트 의무가 따라온다**는 언급이 있다. 우리 앱은 이미 요건을 충족(프로덕션 게시)한 상태라 해당되지 않을 것으로 본다.

**조치:**

- 이관 승인 직후 새 계정 Play Console → 앱 대시보드에 **"테스트 요건" 작업 항목이 떠 있는지 즉시 확인**한다. 없으면 정상.
- 떠 있으면 그 즉시 Play 지원에 이관 건임을 명시해 이의 제기. 구계정을 살려 둔 상태여야 근거 제시가 쉽다.
- ⚠️ **아직 프로덕션에 올라가지 않은 앱**(내부/비공개 테스트 단계)을 함께 이관한다면, 그 앱들은 새 계정에서 **12명×14일을 새로 채워야 한다.** 이관 목록에 그런 앱이 있는지 확인할 것.
- ⚠️ 이관 후 새 계정에서 **새로 만드는 앱**은 예외 없이 12명×14일 대상이다.

### 1-2. 기본 통화(default currency)를 KRW 로 맞출 것

대상 계정의 기본 통화가 원계정과 다르면, **인앱 상품이 있는 앱은 이관 직후 자동으로 미게시(unpublished)** 되고 모든 인앱 상품에 새 통화 가격을 다시 넣어야 재게시된다. 이 앱은 `premium_monthly` / `premium_lifetime` 인앱 상품이 있으므로 직격탄.

→ 대상 계정 설정에서 기본 통화가 **KRW** 인지 확인. 다르면 이관 전에 변경.

### 1-3. 대상 계정 결제 프로필 활성화

인앱 상품이 있는 앱은 대상 계정에 **활성 결제 프로필(payments profile)** 이 없으면 이관 자체가 승인되지 않는다. 사업자 정보·세금 정보·은행 계좌까지 입력 완료 상태여야 한다.

### 1-4. 양쪽 계정의 등록 거래 ID 확보

이관 신청 폼에 원계정·대상 계정 각각의 **개발자 등록비 거래 ID** 가 필요하다. 각 계정 소유자 Gmail 에서 `developer registration fee` 로 검색하거나 payments.google.com 에서 확인. 형식 예: `Registration-1234ab56-...` 또는 `0123...token.0123...`. 제출 시 `0.G.` 같은 앞부분은 제거한다.

### 1-5. 보고서 전부 다운로드 (이관되지 않음)

Play Console → 다운로드 보고서에서 아래를 **오늘 안에** 내려받는다.

- 대량 내보내기(bulk export) 보고서
- 예상 판매 보고서 (estimated sales)
- 수익 지급(payout) / 수익(earnings) 보고서
- 리뷰 내보내기 CSV
- 통계(설치·평점·비정상 종료) 내보내기

### 1-6. 진행 중인 릴리스를 남기지 말 것

- **오늘 새 AAB 를 올리지 않는다.** 검토 중(In review) 릴리스, 대기 중인 변경, 업로드 키 재설정 요청이 있으면 이관이 차단되거나 지연된다.
- 모든 트랙(내부·비공개·프로덕션)에 "검토 중" 상태가 없는지 확인.
- 결제 프로필 변경 진행 중인 것도 없어야 한다.

### 1-7. RevenueCat 용 서비스 계정을 미리 만들어 둔다 (다운타임 최소화)

자격증명은 **최대 36시간** 전파된다. 이 시간을 줄이려면 대상 계정 소유 GCP 프로젝트에서 미리 준비해 둔다.

1. 대상 계정 Google 계정으로 GCP 프로젝트 생성 (또는 기존 것 사용)
2. API 3개 사용 설정: **Google Play Android Developer API**, **Google Play Developer Reporting API**, **Cloud Pub/Sub API**
3. IAM → 서비스 계정 만들기 (예: `revenuecat-ddm`)
4. 역할 부여: **Pub/Sub 편집자**, **모니터링 뷰어** (권한 오류 시 Pub/Sub 관리자)
5. 키 관리 → 키 추가 → **JSON** 다운로드 → 안전 보관
6. 서비스 계정 이메일(`...@....iam.gserviceaccount.com`) 을 메모

※ Play Console 초대는 앱이 이관된 **후에만** 가능하므로 여기까지만 준비.

### 1-8. 업로드 키스토어 백업

현재 업로드 키는 EAS 가 관리 중 (`android/keystores/` 비어 있음). 만약을 위해 로컬 백업:

```
eas credentials --platform android
# → production → Keystore → Download
```

### 1-9. 이관 전 상태 스냅샷 (사후 대조용)

숫자를 적어 둔다. 이관 후 이 숫자가 유지되는지로 사고를 감지한다.

- RevenueCat 대시보드: 활성 구독자 수 / 활성 entitlement 수
- Play Console: 활성 설치 수, 평점, 리뷰 수
- AdMob: 최근 7일 노출수·수익 (이관 후 급락 시 스토어 링크 문제)

---

## 2. 이관 후 즉시 복구해야 하는 권한 (순서대로)

> 이관 승인은 보통 영업일 2일 이내. 승인 알림을 받은 직후 아래를 **위에서부터** 진행한다.
> 1~3번은 결제 관련이라 지연될수록 매출 손실이 난다.

### ① Play Console — 서비스 계정 초대 (최우선)

Play Console(새 계정) → **사용자 및 권한** → 사용자 초대 → 1-7 에서 만든 서비스 계정 이메일 입력.

- 앱 권한: `동대문 종합시장 셰르파` 추가
- 계정 권한 4개 체크:
  - 앱 정보 보기 및 대량 보고서 다운로드 (읽기 전용)
  - 재무 데이터, 주문, 해지 설문 응답 보기
  - 주문 및 구독 관리
  - 스토어 등록정보 관리

### ② RevenueCat — Play 서비스 자격증명 교체

app.revenuecat.com → 프로젝트 → **Android 앱** → App Settings → Service Credentials → 새 JSON 업로드 → 저장.

- 전파에 **최대 36시간**. 그동안 Android 신규 결제 실패. **기존 구독자는 영향 없음.**
- 빨리 활성화시키는 요령: Play Console → 수익 창출 → 상품 → 구독(`premium_monthly`) 설명을 아무거나 수정 후 저장.
- 검증: RC 대시보드에 `Invalid Play Store credentials` (503/521) 경고가 사라졌는지.

### ③ RTDN (실시간 개발자 알림) 재연결

RC → Android 앱 설정 → Google Play Notifications → Pub/Sub 토픽 ID 생성/복사
→ Play Console → **수익 창출 → 수익 창출 설정** → 실시간 개발자 알림에 토픽 ID 붙여넣기 → **테스트 알림 보내기** 로 성공 확인.

이게 빠지면 갱신·해지·환불이 Firestore `users/{uid}/meta/entitlement` 에 반영되지 않아 **해지한 사용자가 계속 프리미엄** 이거나 그 반대가 된다.

### ④ Play Console — 사람 권한 재부여

- 운영자 계정(heimin2598@gmail.com 등) 을 사용자 및 권한에 다시 초대
- 필요한 역할: 앱 액세스, 릴리스 관리, 스토어 등록정보 관리, 재무 데이터 보기, 리뷰 답글

### ⑤ 앱 대시보드 — 테스트 요건 표시 여부 확인 (이관 직후 최우선 확인)

새 계정 Play Console → 앱 → 대시보드에 **"비공개 테스트 실행" / "프로덕션 액세스 신청"** 작업이 떠 있는지 본다.

- 안 떠 있으면 정상 — 업데이트 출시에 제약 없음.
- 떠 있으면 즉시 Play 지원에 이관 건으로 이의 제기. 동시에 12명 테스터 모집을 시작해 14일 시계를 바로 돌린다 (늦게 시작할수록 손해).

### ⑥ 테스트 트랙 / 테스터 그룹 재생성

테스터 그룹은 **이관되지 않는다.** 내부 테스트·비공개 테스트 이메일 목록을 다시 만든다.

### ⑦ 라이선스 테스트 계정 재등록

Play Console → 설정 → 라이선스 테스트 → 결제 테스트용 Gmail 재등록. (₩0 로 결제 흐름 검증용)

### ⑧ AdMob ↔ Play 스토어 링크 재연결

AdMob(계정 변경 없음) → 앱 → `동대문 종합시장 셰르파` → 스토어 링크 상태 확인.
끊겼으면 **앱 추가 → 스토어 검색 → com.ddmsherpa.app** 로 다시 연결.

- 스토어 링크 반영에 24~48시간(최대 1주) 소요될 수 있다.
- **AdMob 앱 ID / 광고 단위 ID 는 바뀌지 않는다** (AdMob 계정을 안 옮겼으므로). `app.json` 수정·재빌드 불필요.
- AdMob 계정도 함께 옮긴다면 → 앱 ID·단위 ID 전부 교체 + 새 AAB 필수. 지금 계획엔 없음.

### ⑨ Firebase ↔ Play 링크 (선택)

Firebase Console → 프로젝트 설정 → 통합 → Google Play 링크. 끊겼으면 새 개발자 계정으로 다시 연결.
**Android Vitals / Crashlytics 연동용일 뿐이며, 앱 동작(Auth·Firestore)에는 영향 없다.**

### ⑩ 개인정보 / 데이터 안전 섹션 재확인

Play Console → 정책 → 앱 콘텐츠 에서 아래가 승계됐는지 확인. 누락 시 업데이트가 반려된다.

- 데이터 보안(Data safety) 양식
- 개인정보처리방침 URL
- 계정 삭제 URL (`docs/delete-account.html`)
- 광고 포함 여부, 타겟 연령층, 콘텐츠 등급

### ⑪ 이관 전 주문 환불 경로 확인

이관 전에 발생한 주문은 **구계정에서만** 환불 가능하다. 구계정을 최소 6개월은 살려 두고 접근 권한을 유지한다.

---

## 3. 이관 후 회귀 검증 (실기기 Android)

앱 코드가 안 바뀌었어도 반드시 한 바퀴 돈다.

- [ ] 스토어에서 앱이 정상 노출 (`com.ddmsherpa.app`)
- [ ] 기존 설치 사용자에게 업데이트가 정상 제공 (서명 키 승계 확인)
- [ ] 신규 설치 → 실행 → 로그인 (이메일 / Google) 정상
- [ ] **기존 프리미엄 계정** 로그인 → 프리미엄 기능(부자재 찾기·메모·포토메모) 접근 유지
- [ ] 페이월 → 요금제 선택 → 결제 시트 노출 (자격증명 활성화 후)
- [ ] 결제 완료 → 몇 초 내 프리미엄 전환 (RTDN + webhook 확인)
- [ ] 구매 복원 정상
- [ ] 배너·전면 광고 노출
- [ ] 푸시 알림 수신 (Expo push — Play 무관이나 확인)

---

## 4. 이 런북과 함께 들어간 코드 조치

`src/lib/purchases.ts` — 자격증명 전파 지연으로 offerings 가 비었을 때의 오류 문구를
`판매 중인 상품이 없습니다.` → **`스토어 상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요. 이미 결제한 이용권은 그대로 유지됩니다.`** 로 변경.

영구 장애처럼 읽혀 이탈·저평점으로 이어지는 것을 막는다. `purchases.web.ts` 에도 동일 상수 추가.

**이 변경은 이관 전에 배포하지 않는다** (1-6: 검토 중 릴리스가 이관을 막는다). 이관 완료 후 대시보드에 테스트 요건이 없는 걸 확인하고(2-⑤) 다음 버전에 함께 나간다.

---

## 참고 문서

- [Transfer apps to a different developer account](https://support.google.com/googleplay/android-developer/answer/6230247)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [RevenueCat — Creating Play Service Credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)
- [RevenueCat — Google Play Checklists](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials/google-play-checklists)
- [AdMob — Link your app to an app store](https://support.google.com/admob/answer/10037806)
