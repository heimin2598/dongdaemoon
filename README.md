# 동대문 종합시장 셰르파 (DDM Sherpa)

동대문 종합시장 내 **호수 / 카테고리 / 편의시설**을 빠르게 찾고, **수동 출발지 선택 기반 실내 길안내**를 제공하는 iOS·Android 크로스플랫폼 가이드 앱.

## 1. 기술 스택
- React Native + Expo (Expo Router v3, typed routes)
- TypeScript
- Zustand (상태 관리)
- react-native-svg (지도 렌더링)
- AsyncStorage (최근 검색·로그인 상태)
- Firebase Authentication **예정** — 현재는 교체 가능한 mock 인증 사용

## 2. 설치 및 실행

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 실행 (QR 스캔 → Expo Go 앱)
npm run start

# 3) 플랫폼별 직접 실행
npm run ios       # macOS + Xcode 필요
npm run android   # Android Studio 에뮬레이터 또는 실기기
npm run web       # 브라우저에서 바로 확인
```

Expo Go(앱스토어 / Play 스토어) 를 이용하면 Mac 없이 iOS 실기기로 확인 가능합니다.

## 3. 프로젝트 구조

```
app/                       # Expo Router 파일 기반 라우팅
  _layout.tsx              # 전역 레이아웃 + 인증 가드
  index.tsx                # 엔트리 리다이렉트
  (auth)/                  # 비로그인 그룹
    title.tsx
    login.tsx
    signup.tsx
    forgot-password.tsx
  home.tsx                 # 홈
  map-building.tsx         # 동별 보기
  map-floor.tsx            # 층별 보기 (좌우 스와이프)
  search.tsx               # 통합 검색
  account.tsx              # 내 계정
  route/
    destination-summary.tsx
    start-select.tsx
    navigation.tsx

src/
  components/
    common/                # Button, TextInput, ScreenHeader
    map/                   # MapCanvas, BuildingTabs, FloorSelector
  constants/               # 색상, 건물, 층, 카테고리, 시설
  data/
    maps/                  # 층별 지도 데이터 (B_6F, C_6F …)
    navigation.ts          # 길찾기 노드/엣지
    keywords.ts            # 카테고리 키워드 사전
  features/
    search/searchEngine.ts # 호수/카테고리/시설 통합 검색
    navigation/pathfinding.ts # Dijkstra 기반 길찾기
  lib/firebase.ts          # Firebase app/auth/firestore 초기화
  lib/auth/firebaseAuth.ts # Firebase 인증 (이메일) + Firestore 프로필
  lib/auth/mockAuth.ts     # 로컬 목 인증 (현재 미사용, 롤백용 보존)
  stores/                  # Zustand: auth, map, search, route
  types/                   # 공통 TypeScript 타입

assets/
  images/                  # 앱 아이콘·스플래시 (교체 필요)
  maps/raw_reference/      # 기획용 원본 지도 PNG
```

## 4. 주요 기능

| 영역 | 기능 |
|---|---|
| 로그인 | 이메일/비밀번호, Google(모의), Apple(iOS만, 모의), 비밀번호 재설정 |
| 홈 | 검색창, 빠른 메뉴(호수/원단/부자재/식당가/카페/화장실/엘베/ATM), 동별·층별 진입, 최근 검색/목적지 |
| 지도 | A/B/C/N 4개 동 + B1F~9F 층 전환, 세부 지도(6F) / 자동 스텁(나머지) |
| 검색 | 호수 번호(215, 215호), 카테고리(원단/부자재…), 시설(화장실/ATM…), 점포명(공차/뉴욕버거…) |
| 길찾기 | 수동 출발지 선택 → Dijkstra 경로 계산 → 지도 위 경로선 + 단계별 문장 안내 |

## 5. 지도 데이터 확장 가이드

각 층의 세부 지도는 `src/data/maps/{동}_{층}.ts` 파일로 추가합니다. MVP 에서는 **B_6F / A_6F / C_6F / N_6F** 가 세부 데이터로 구축되어 있고, 나머지는 `stub.ts` 에서 자동 생성되어 앱이 깨지지 않습니다.

새 층 데이터 추가 순서:
1. `src/data/maps/{B|A|C|N}_{층}.ts` 작성 — `stores`, `facilities`, `regions` 좌표 입력
2. `src/data/maps/index.ts` 의 `REGISTRY` 에 새 맵 등록
3. `src/data/navigation.ts` 에 출입구/엘리베이터/에스컬레이터 노드 추가 후 엣지 연결
4. 필요 시 `src/constants/categories.ts` `CATEGORY_DISTRIBUTION` 에 분포 추가

좌표계: 각 `FloorMap` 은 `viewBox`(width, height) 를 가지며, 모든 좌표는 이 기준의 상대값입니다. 실제 화면에서는 `react-native-svg` 가 `preserveAspectRatio="xMidYMid meet"` 로 알아서 스케일링합니다.

## 6. Firebase 연결 (현재 상태)

**이메일/비밀번호 인증 + Firestore 프로필**이 연결되어 있습니다 (`firebase` JS SDK v12).

- 초기화: `src/lib/firebase.ts` (config + AsyncStorage 영구 저장)
- 인증: `src/lib/auth/firebaseAuth.ts`
- 데이터 모델: `users/{uid} = { email, displayName, role, status, createdAt, approvedAt }`
- 사장님 가입은 `status: 'pending'`으로 생성 → 어드민이 Firebase Console에서 `'active'`로 변경

추가 작업 예정:
1. Firestore 보안 규칙 적용 (현재 테스트 모드, 30일 후 만료)
2. Google 로그인 (`expo-auth-session` + Firebase credential)
3. Apple 로그인 (`expo-apple-authentication`, iOS 빌드 시)
4. 카카오 로그인 (Cloud Functions로 Custom Token 발급)

## 7. 빌드

```bash
# 개발 빌드 (EAS)
npx expo install expo-dev-client
npx eas build --profile development --platform android
npx eas build --profile development --platform ios

# 프로덕션 빌드
npx eas build --profile production --platform all
```

App Store / Play Store 제출 전에 `app.json` 의 `ios.bundleIdentifier`, `android.package`, 버전 번호, 개인정보처리방침 링크를 실제 값으로 교체하세요.

## 8. 테스트 계정 (심사 제출용)

현재는 mock 인증이라 아무 이메일/비밀번호로 회원가입 후 로그인 가능합니다. Firebase 교체 후에는 Apple / Google 심사를 위한 테스트 계정을 별도로 만들어 첨부해야 합니다.

## 9. 알려진 제한
- **점포 세부 데이터는 6F 중심**으로만 구축됨. B1F~5F, 7F~9F 는 자동 스텁으로 그림만 나오고 클릭 가능한 점포가 적음.
- **GPS 미지원** — 1차 MVP 는 수동 출발지 선택 방식.
- **실제 좌표 정확도**는 기획서 A-1/A-2/A-3 예시 기준의 근사치. 실제 배포 전 현장 검증 필요.

## 10. 다음 할 일
- [ ] B1F ~ 9F 전 층 상세 좌표 입력 (기획서 14-5 참고)
- [ ] Firebase Authentication 연동
- [ ] Sign in with Apple
- [ ] 확대/축소 제스처 (react-native-gesture-handler + reanimated 로 pinch/pan 구현)
- [ ] 점포 상세정보 2차 확장 (이름, 사진, 연락처)
- [ ] 다국어 (ko / en / zh)
