# DDM Sherpa (동대문 종합시장 셰르파) — 에이전트 작업 지침

이 파일은 이 프로젝트에서 작업하는 Claude 에이전트가 반드시 따라야 하는 규칙과 컨텍스트를 담는다. 모든 작업 시작 전에 읽고 적용한다.

## ⚡ 가장 중요한 원칙 — 능동적 개선 (PROACTIVE QUALITY)

사용자의 요청을 **그 문자 그대로만 처리하는 것은 충분하지 않다.** 사용자가 "X를 추가해 줘"라고 하면, 그 X 가 앱 전체 맥락에서 자연스럽게 동작하기 위해 함께 손봐야 할 곳까지 능동적으로 판단해 처리한다.

매 작업마다 다음을 스스로 점검하라:

1. **고객 편의성** — 이 변경이 일반 사용자/사장님/운영자 각각의 입장에서 자연스러운가? 한 번 더 누르거나, 의미를 추측해야 하지 않는가?
2. **앱 전체 일관성** — 이 변경이 같은 카테고리(가입/관리/리스트/상세) 의 다른 화면들과 비슷한 패턴/색상/문구를 쓰는가?
3. **상태 전이 누락** — 새 데이터/상태를 도입했다면, loading/empty/error/success/permission-denied 다섯 가지 표시가 모두 처리됐는가?
4. **권한과 보안** — 새로 만든 컬렉션/스토리지 경로는 `firestore.rules` / `storage.rules` 에 규칙이 추가됐는가? 클라이언트 검증만으로는 부족하다.
5. **iOS/Android/Web 호환** — 새 import 가 웹/Expo Go 에서 깨지지 않는가? Platform.OS 분기나 `.web.ts` stub 가 필요한가?
6. **하단 safe area** — 새 화면이 `SafeAreaView edges={['top','bottom']}` 또는 `useSafeAreaInsets` 로 갤럭시 3-버튼 nav 와 안 겹치는가? (탭 화면 예외)
7. **결과 검증** — 만든 코드를 실제로 실행하거나 빌드해서 동작/타입 모두 통과하는지 확인했는가? "tsc 만 통과"는 "테스트 됐다" 가 아니다.
8. **회귀 방지 (REGRESSION CHECK)** — 작동하던 기능이 깨지지 않았는가?
   - 새로 추가한 `<Modal>` 에 `visible={...}` 명시했는가? (누락 시 투명 풀스크린이 모든 터치 가로챔)
   - `<View style={StyleSheet.absoluteFill}>` 가 터치 가능한 요소 위를 덮으면 `pointerEvents="none"` 필수
   - 무한 애니메이션(`withRepeat`) 이 메인 UI thread 막지 않는가?
   - `useEffect` 무한 루프(deps 가 매 렌더 새로 생성되는 객체)는 없는가?
   - 공통 컴포넌트(LanguagePicker, HomeQrWidget, ShopStatusToggle, NotificationBar 등) 수정 후 그 컴포넌트를 쓰는 화면 모두 정상 동작하는가?

요청에 명시 안 됐어도 위 항목 중 빠진 게 있으면 같은 PR 안에서 해결한다. 그것이 "능동적 개선"이다.

## 출력 / 응답 스타일

- 답변은 짧고 명확하게. 불필요한 머리말/맺음말 없이.
- 작업 시작 전에 한 문장으로 "지금 무엇을 한다" 알린다.
- 작업 중에는 결과/방향 전환/막힘만 짧게 보고. 내부 생각의 흐름을 중계하지 않는다.
- 작업 종료 시 1~2 문장 요약: 무엇이 바뀌었고 다음에 무엇이 필요한지.
- 사용자가 PROCEED 묻지 말라고 했음 — autonomous 모드로 작업한다. 단, **destructive / 비가역 작업(파일 대량 삭제, db drop, force push 등)** 은 반드시 확인 받는다.
- 이모지는 사용자가 명시적으로 요청한 경우에만.

## 프로젝트 컨텍스트

- **앱 이름**: 동대문 종합시장 셰르파 (DDM Sherpa)
- **목적**: 동대문 종합시장 3,662개 점포 가이드 / 길안내 / 사장님-방문자 매칭
- **스택**: React Native + Expo SDK 54, Firebase (Auth/Firestore/Storage), Zustand, expo-router
- **사업자**: 헤이민 / 정혜민 / 665-38-00101 (강원도 원주시 개운4길 1-5 3층)
- **운영자**: heimin2598@gmail.com (Firestore `admins/{uid}` 컬렉션으로 권한 부여)
- **회원 유형**: visitor (일반 방문자) / merchant (매장 사장님)
  - merchant 가입 시 status='pending' → 운영자 승인 → 'active'
- **유료 모델**: free (30일 trial) / premium (월간 결제 예정). 부자재 찾기 / 메모 / 포토메모 는 premium 전용.

## 디렉터리 구조 핵심

```
app/                       # expo-router 라우트
  (auth)/                  # 로그인/회원가입 (로그아웃 상태 전용)
  (tabs)/                  # 메인 탭 (home/map/search/parts/account)
  admin-*.tsx              # 운영자 콘솔
  store/[code].tsx         # 매장 상세
  parts/                   # 부자재 찾기
src/
  components/common/       # 재사용 UI (Button, ScreenHeader, PaywallSheet 등)
  lib/                     # Firestore CRUD, auth, etc
    firebase.ts            # RN 진입
    firebase.web.ts        # 웹 진입 (browserLocalPersistence)
    auth/firebaseAuth.ts   # users/{uid} 관리
  stores/                  # zustand
  data/stores/             # 정적 점포 디렉터리 3,662개 + 카테고리
constants/                 # Colors, FLOORS, BUILDING_ORDER, etc
```

## 데이터 모델 (Firestore)

| 컬렉션 | 용도 | 비고 |
| --- | --- | --- |
| `users/{uid}` | role / status / email | merchant 는 pending → active |
| `users/{uid}/meta/entitlement` | 유료/체험 | client 가 best-effort 생성 |
| `users/{uid}/meta/pushToken` | 푸시 토큰 | Expo push |
| `users/{uid}/blocked/{blockedUid}` | 차단 | |
| `admins/{uid}` | 운영자 권한 | 자체 read + admin read |
| `shops/{shopId}` | 매장 사장님 등록 매장 | ownerUid + storeCodes[] |
| `merchantClaims/{claimId}` | 매장 매칭 신청 | type='existing'/'new', status='pending'/'approved'/'rejected' |
| `reviews/...` | 매장 리뷰 (1계정 1매장 1리뷰) | |
| `partsRequests/{rid}` | 부자재 찾기 | 프리미엄 |
| `partsRequests/{rid}/replies/{shopId}` | 1 shop 1 reply | |
| `homeBanners`, `searchBanners` | 운영자 배너 | |
| `settings/global` | 배너 모드 등 글로벌 설정 | |
| `inquiries`, `adInquiries`, `reports` | 문의/광고/신고 | |
| `chats/{chatId}` | 방문자 ↔ 사장님 1:1 채팅 | participants[] |
| `chats/{chatId}/messages/{mid}` | 메시지 (text/image/video) | |

## 코딩 컨벤션

- **import alias**: `@/components/...`, `@/lib/...`, `@/stores/...`, `@/types`, `@/constants/...` (tsconfig `baseUrl=src` 와 일부 `@/...` 매핑)
- **Colors**: `Colors.primary` (#0B2E5A), `Colors.danger`, `Colors.text`, `Colors.textMuted`, `Colors.surface`, `Colors.border`, `Colors.divider`, `Colors.background`
- **헤더 컴포넌트**: `<ScreenHeader title="..." />` (뒤로가기 자동)
- **버튼**: `<Button label primary/secondary/danger />`
- **알림**: `showInfoAlert(title, body, onClose?, btn?)` — RN/web 차이 자동 처리. 절대 `Alert.alert` 직접 사용 금지 (웹 콜백 미동작).
- **푸시 알림**: `pushNotifications.ts` — Expo Go 에서는 dynamic require 로 skip. 새 알림 추가 시 같은 패턴 유지.
- **Comments**: 기본은 주석 없이. 비자명한 WHY(제약·invariant·우회·미래 함정) 만 한 줄로.

## 출시·환경

- **EAS**: project id `7bc7aeed-7d3e-497f-85c9-f213b7111bc5`, owner `heiminstudio`, bundle `com.ddmsherpa.app`
- **Apple**: Team ID/Services ID/Key ID 보관 (memory)
- **Firebase project**: `dongdaemoon-vscode`
- **git push**: 권한 차단됨 — 사용자가 터미널에서 직접 실행

## 절대 하지 말 것

- `git push --force`, `git reset --hard`, 무단 destructive 명령
- 사용자 동의 없이 destructive Firestore 작업 (대량 doc 삭제 등)
- 새 컬렉션 만들고 `firestore.rules` 안 건드리기
- `Alert.alert(... multiButton callback ...)` (웹에서 무동작)
- 의미 없는 주석 추가 ("// this is X")
- 의미 없는 backward-compat shim, `_unused` 변수 리네이밍
- 사용 안 하는 import 그대로 두기

## 작업 시작 체크리스트

새 작업을 시작할 때 다음을 차례로 한다:

1. 사용자 요청을 한 문장으로 재진술 (속으로). 정확히 무엇을 무엇으로 바꾸는가?
2. 영향 받는 화면/컬렉션/규칙 후보를 머리에 그린다.
3. 능동적 개선 7항목 점검.
4. TaskCreate 로 3단계 이상이면 작업 분해.
5. 변경 전 영향 파일 Read, 패턴/네이밍 파악.
6. 변경 후 `npx tsc --noEmit` 으로 타입 통과 확인. 가능하면 빌드/런타임도.
7. 끝나면 한 줄 요약.
