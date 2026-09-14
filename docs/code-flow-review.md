# DDM Sherpa — 핵심 플로우 코드 정합성 검토

> 2026-05-25 Closed Alpha 출시 직전 점검. 부자재 찾기 / 매장 매칭 / 1:1 채팅 / 결제 트라이얼 / 푸시.

---

## 1. 결제 / 트라이얼 (entitlement)

**파일**: `src/lib/entitlement.ts`, `src/hooks/useEntitlement.ts`, `src/lib/purchases.ts`

| 항목 | 결과 |
|---|---|
| 신규 가입 시 30일 trial 자동 생성 (`ensureEntitlementDoc`) | ✅ |
| `isActivePremium` — grandfathered + expiresAt 모두 처리 | ✅ |
| 실시간 구독 (`subscribeEntitlement`) → UI 즉시 반영 | ✅ |
| 운영자 grant/revoke API | ✅ `adminGrantPremium`, `adminRevokePremium` |
| Firestore rules — entitlement update/delete admin only | ✅ |
| `PREMIUM_LAUNCH_EPOCH_MS = 0` | ⚠️ 모든 사용자 trial 모드 (grandfathered 없음). 정식 결제 출시 시 epoch 값 업데이트 필요 |
| RevenueCat dev 빌드 "Error fetching offerings" toast | ⚠️ DEBUG log level. production 빌드에선 silent |

**판정**: 정상. PREMIUM_LAUNCH_EPOCH_MS 는 결제 시스템 정식 도입 시점에 업데이트 예정인 의도된 placeholder.

---

## 2. 매장 매칭 (merchantClaims)

**파일**: `src/lib/merchantClaims.ts`, `app/(auth)/signup-match.tsx`, `app/admin-merchants.tsx`

| 항목 | 결과 |
|---|---|
| 본인 신청 read/create (`createMerchantClaim`) | ✅ |
| 본인 update 차단 (운영자만 status 변경) — Firestore rules | ✅ |
| `approveAndActivateClaim` — claim/user/shop 3-doc batch | ✅ writeBatch atomic |
| existing 신청: `storeCode` 의 directory 데이터로 자동 채움 | ✅ |
| new 신청: `shortId` 를 storeCode 로 사용 (예: `NEW-G98XQ`) | ✅ |
| 5자 영숫자 ID 충돌 가능성 | ⚠️ 28^5 ≈ 17M, 1만 사장님까지 충돌 0.029% — 실용상 OK |
| 거절 사유 (`rejectReason`) 저장 + 사용자에게 노출 | ✅ |
| pending → approved/rejected 후 사장님 측 즉시 반영 (`subscribeMyLatestClaim`) | ✅ onSnapshot |

**판정**: 정상.

---

## 3. 1:1 채팅 (chats)

**파일**: `src/lib/chats.ts`, `app/chat/[id].tsx`, `app/chats.tsx`, `app/(tabs)/messenger.tsx`

| 항목 | 결과 |
|---|---|
| Deterministic chatId (`${visitorUid}__${shopId}`) — 재진입 시 동일 방 | ✅ |
| `participants[]` 배열로 보안 규칙 매칭 | ✅ |
| 메시지 타입 text / image / video 분기 | ✅ |
| Storage 업로드 후 download URL 저장 | ✅ |
| 차단된 사용자 메시지 숨김 | ✅ (rendering layer 에서 blocksStore 참조) |
| `unreadFor` 카운트 (참가자별) | ✅ |
| 첨부 미디어 신고 가능 | ✅ |
| 자동 번역 (선택) — 사용자 설정에 따라 메시지 번역 | ✅ DeepL API |

**판정**: 정상.

---

## 4. 부자재 찾기 (partsRequests)

**파일**: `src/lib/partsRequests.ts`, `app/(tabs)/parts.tsx`, `app/parts/new.tsx`, `app/parts/[id].tsx`

| 항목 | 결과 |
|---|---|
| 카테고리 1~3개 다중 선택 (`MAX_CATEGORIES_PER_REQUEST = 3`) | ✅ |
| 사진 최대 5장 (`MAX_PHOTOS_PER_REQUEST = 5`) | ✅ |
| 텍스트 2000자 (`MAX_TEXT_LENGTH`) | ✅ |
| 답글 매장당 1개 강제 — `runTransaction` 으로 race condition 방지 | ✅ |
| 답글 메시지 2000자 (`MAX_MESSAGE_LENGTH`) | ✅ |
| 종료/재개/삭제 (본인만) | ✅ |
| 신고/차단 (타인 글) | ✅ |
| 프리미엄 게이트 — `useEntitlement` 로 잠금 | ✅ |
| 사장님 + 매장 카테고리 매칭 — "내 분야" 토글 | ✅ |
| ImageManipulator 로 업로드 전 리사이즈 | ✅ |

**판정**: 정상. 라이트한 사용량에 적합한 구조.

---

## 5. 푸시 알림 (pushNotifications)

**파일**: `src/lib/pushNotifications.ts`, `src/lib/pushNotifications.web.ts`

| 항목 | 결과 |
|---|---|
| Expo Go silent skip (`canUseNotifications`) | ✅ |
| Web silent skip | ✅ (web stub) |
| 시뮬레이터 silent skip (`!Device.isDevice`) | ✅ |
| 권한 거부 silent skip | ✅ |
| Android channel `default` 셋업 (HIGH importance) | ✅ |
| Firestore `users/{uid}/meta/pushToken` 저장 | ✅ |
| EAS projectId 자동 인식 | ✅ |
| **서버 발송 인프라** | ⚠️ Cloud Functions 별도 구현 필요. 현재 클라이언트 토큰 등록까지만 |

**판정**: 클라이언트 토큰 인프라 정상. 실제 푸시 발송은 별도 Cloud Functions 구현 필요 (현재 Closed Alpha 범위 밖).

---

## 6. 신고 / 차단

**파일**: `src/lib/reports.ts`, `src/lib/blocks.ts`, `src/components/common/ReportSheet.tsx`

| 항목 | 결과 |
|---|---|
| 신고 사유 6개 (스팸/욕설/부적절/허위/저작권/기타) | ✅ |
| "이 사용자도 차단" 동시 처리 | ✅ |
| 차단 시 콘텐츠 자동 숨김 — 리뷰/요청/답글/채팅 | ✅ |
| 본인 콘텐츠엔 신고 버튼 X (대신 삭제) | ✅ |
| 운영자 신고 리스트 — admin 콘솔 | ⚠️ admin-inquiries 와 분리 필요 시 별도 화면 (현재 reports/ 폴더에 데이터만 있음) |

**판정**: 사용자 측 정상. 운영자 신고 검토 화면이 별도 화면으로 분리되어 있지 않으나 Closed Alpha 범위 밖.

---

## 종합 판정: **GO** ✅

5개 핵심 플로우 모두 정합성 OK. 코드 품질·권한 분리·에러 처리 모두 출시 수준.

알려진 한계 (모두 비차단):
- RevenueCat dev-only DEBUG toast
- PREMIUM_LAUNCH_EPOCH_MS placeholder (의도됨)
- 푸시 서버 발송 Cloud Functions (Closed Alpha 범위 밖)
- 운영자 신고 검토 UI (Closed Alpha 범위 밖)
