export type BuildingCode = 'A' | 'B' | 'C' | 'N';

export type FloorCode =
  | 'B1F'
  | '1F'
  | '2F'
  | '3F'
  | '4F'
  | '5F'
  | '6F'
  | '7F'
  | '8F'
  | '9F';

export type FacilityType =
  | 'toilet'
  | 'elevator'
  | 'escalator'
  | 'stairs'
  | 'atm'
  | 'parking'
  | 'corridor'
  | 'entrance'
  | 'subway'
  | 'pharmacy'
  | 'food'
  | 'cafe'
  | 'bank';

export type CategoryKey =
  | 'fabric'
  | 'accessory'
  | 'bedding'
  | 'thread'
  | 'curtain'
  | 'clothing_accessory'
  | 'home_interior'
  | 'lace'
  | 'button'
  | 'fur'
  | 'hanbok'
  | 'leather'
  | 'handicraft'
  | 'towel'
  | 'food_court'
  | 'cafe'
  | 'restaurant'
  | 'medical'
  | 'pharmacy'
  | 'atm'
  | 'bank'
  | 'studio'
  | 'office'
  | 'parking';

export interface StoreShape {
  unitNumber: string;
  name?: string;
  category?: CategoryKey | CategoryKey[];
  shape: 'rect' | 'polygon';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<[number, number]>;
  label?: string;
}

export interface FacilityPoint {
  id: string;
  type: FacilityType;
  x: number;
  y: number;
  label?: string;
}

export interface FloorMap {
  building: BuildingCode;
  floor: FloorCode;
  viewBox: { width: number; height: number };
  stores: StoreShape[];
  facilities: FacilityPoint[];
  regions?: Array<{
    id: string;
    label: string;
    color?: string;
    points: Array<[number, number]>;
  }>;
}

export interface NavNode {
  id: string;
  building: BuildingCode;
  floor: FloorCode;
  x: number;
  y: number;
  type: FacilityType | 'junction' | 'store';
  label?: string;
}

export interface NavEdge {
  from: string;
  to: string;
  weight: number;
  mode?: 'walk' | 'elevator' | 'escalator' | 'stairs' | 'corridor';
}

export interface SearchResult {
  kind: 'unit' | 'category' | 'facility' | 'store';
  building: BuildingCode;
  floor: FloorCode;
  unitNumber?: string;
  name?: string;
  category?: CategoryKey;
  facility?: FacilityType;
  nodeId?: string;
}

export interface RouteStep {
  text: string;
  building: BuildingCode;
  floor: FloorCode;
  mode?: NavEdge['mode'];
}

export interface Route {
  nodes: NavNode[];
  edges: NavEdge[];
  steps: RouteStep[];
  totalWeight: number;
}

export type UserRole = 'visitor' | 'merchant';
export type UserStatus = 'active' | 'pending' | 'rejected';

export type EntitlementPlan = 'free' | 'premium';
export type EntitlementSource = 'free' | 'apple' | 'google' | 'manual' | 'trial' | 'promo';

export interface Entitlement {
  plan: EntitlementPlan;
  expiresAt: number | null;     // ms epoch, null = 영구 (grandfathered/manual) 또는 무료
  grandfathered: boolean;       // 유료화 이전 가입자
  source: EntitlementSource;
  /** 30일 무료 체험을 이미 한 번 사용했는지. 한 계정당 1회만 가능. */
  trialUsed?: boolean;
  updatedAt?: number;
}

/**
 * 사장님이 등록한 "매장 단위".
 * 한 사장님이 여러 shop을 가질 수 있고, 한 shop이 여러 호수(storeCodes)를 포함할 수 있다.
 * (예: 한 사업자가 215호 + 216호 두 호수를 한 매장처럼 운영)
 *
 * categories: 사장님이 명시한 취급 분야 — 부자재 찾기 피드의 "내 분야" 필터에 사용된다.
 */
export type OperatingStatus = 'open' | 'lunch' | 'away' | 'closed';
export type PaymentMethod = 'card' | 'cash' | 'kakao' | 'naver' | 'samsung' | 'transfer';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface BusinessHourEntry {
  day: DayOfWeek;
  enabled: boolean;
  start?: string;  // 'HH:MM'
  end?: string;
}

export interface ShopPhoto {
  url: string;
  storagePath: string;
  caption?: string;
  uploadedAt: number;
}

/**
 * 매장 사장님이 등록하는 상품. shops/{shopId}/products/{productId}
 * - 사진 최대 3장, 가격대는 자유 텍스트 (예: "5,000원", "도매 1,000원~")
 */
export interface ShopProduct {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  priceText?: string;          // 자유 입력 가격 (단가/도매가/단가별 등)
  photos: ShopPhoto[];          // 최대 3장
  createdAt: number;
  updatedAt: number;
}

export interface Shop {
  id: string;              // shopId (Firestore doc id)
  ownerUid: string;
  storeCodes: string[];    // ['B-6F-215', 'B-6F-216']
  displayName: string;     // 사장님이 부여한 매장 이름
  phone: string;           // 사장님이 입력한 최신 전화번호
  businessHours: string;   // 영업시간 자유 입력 (예: "월-토 09:00-18:00")
  description: string;     // 매장 소개·취급 품목
  categories?: PartsCategory[];
  /** 실시간 영업 상태. 사장님이 토글. 미설정 시 'open' (기본). */
  operatingStatus?: OperatingStatus;
  /** 'lunch' / 'away' 상태일 때 복귀 예정 시각 (epoch ms). null/미설정 시 무기한. */
  operatingStatusUntil?: number | null;
  /** 받는 결제 수단. 매장 상세에 배지 노출. */
  paymentMethods?: PaymentMethod[];
  /** 사장님이 업로드한 매장 사진 (간이 카탈로그). 최대 MAX_SHOP_PHOTOS 장. */
  photos?: ShopPhoto[];
  /** 요일별 영업시간 스케줄 (월~일 7개). 미설정 시 기존 businessHours 자유 텍스트 사용. */
  businessHoursSchedule?: BusinessHourEntry[];
  /**
   * 운영자가 매장 정보를 검증해 "인증 매장" 으로 표시할지 여부.
   * - 사장님이 직접 등록한 매장은 기본 false → 미인증 상태
   * - 운영자가 admin-merchants 콘솔의 매칭 신청 승인 / 직접 verify 시 true
   * - false 인 매장은 visitor 시점에서 인증 배지/채팅 CTA/영업상태 등 노출 안 됨
   */
  verified?: boolean;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  provider: 'email' | 'google' | 'apple';
  role: UserRole;
  status: UserStatus;
  entitlement?: Entitlement;
  /** 5자리 영숫자 고유 ID. QR / 검색 / 표시용. 회원가입 시 자동 부여. */
  shortId?: string;
  /** 운영자가 차단한 회원. 로그인 후 즉시 차단 안내 + 로그아웃. */
  disabled?: boolean;
  /** 운영자가 소프트 삭제한 회원 (시각). 표시용. Auth 계정은 별도 콘솔에서 삭제 필요. */
  deletedAt?: number | null;
}

export interface PartsPhoto {
  url: string;
  storagePath: string;
  width?: number;
  height?: number;
}

export type PartsRequestStatus = 'open' | 'closed';

/**
 * 부자재 찾기 요청에서 사용하는 카테고리.
 * 매장 카테고리(CategoryKey) 의 제품군 부분집합 + 'etc'(기타).
 */
export type PartsCategory =
  | 'fabric'
  | 'lace'
  | 'button'
  | 'thread'
  | 'accessory'
  | 'clothing_accessory'
  | 'bedding'
  | 'curtain'
  | 'home_interior'
  | 'towel'
  | 'leather'
  | 'fur'
  | 'hanbok'
  | 'handicraft'
  | 'etc';

/**
 * "부자재 찾기" 요청 — 이용자가 사진/설명을 올리면 사장님들이 답글로 매칭한다.
 * categories 는 1~3개의 PartsCategory.
 */
export interface PartsRequest {
  id: string;
  authorUid: string;
  authorName: string;
  categories?: PartsCategory[];
  text: string;
  photos: PartsPhoto[];
  status: PartsRequestStatus;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 사장님이 자신의 매장(shop) 단위로 한 요청에 다는 답글.
 * 매장당 한 요청에 최대 1개 (doc id == shopId).
 */
export interface PartsReply {
  shopId: string;
  ownerUid: string;
  shopDisplayName: string;
  shopStoreCodes: string[];
  message: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 매장 사장님이 가입 후 어떤 매장과 연동할지 신청하는 클레임.
 * - 'existing': 정적 디렉터리(3,689개) 의 storeCode 에 매칭
 * - 'new': 디렉터리에 없는 신규 매장 — 운영자가 승인 시 매장 DB 에도 추가
 *
 * 흐름:
 *   회원가입 (status='pending') → 매칭 페이지 → 클레임 생성
 *   → 운영자 승인 → users/{uid}.status='active' + shops/{shopId} 생성
 */
export type MerchantClaimType = 'existing' | 'new';
export type MerchantClaimStatus = 'pending' | 'approved' | 'rejected';

export interface MerchantClaimNewStore {
  name: string;
  phone: string;
  building?: BuildingCode | null;
  floor?: FloorCode | null;
  unit?: string | null;
  address?: string;
  category?: string;
  description?: string;
}

export interface MerchantClaim {
  id: string;
  uid: string;
  shortId: string;                       // 5자리 영숫자 (사용자에게 보여줄 신청번호)
  claimType: MerchantClaimType;
  storeCode?: string;                    // claimType='existing'
  newStore?: MerchantClaimNewStore;      // claimType='new'
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  status: MerchantClaimStatus;
  rejectReason?: string;
  createdAt: number;
  reviewedAt: number | null;
  reviewerUid: string | null;
}

/**
 * 1:1 채팅 (방문자 ↔ 사장님). 한 visitorUid + shopId 조합당 한 채팅.
 * 채팅방 id 는 deterministic: `${visitorUid}_${shopId}` (sort 보장).
 */
export interface Chat {
  id: string;
  participants: string[];        // [visitorUid, merchantUid]
  visitorUid: string;
  visitorDisplayName?: string;
  merchantUid: string;
  shopId: string;
  shopDisplayName: string;
  lastMessage?: string;
  lastMessageAt: number;
  lastSenderUid?: string;
  unreadFor?: Record<string, number>; // 미읽음 카운트 (선택)
}

export type ChatMessageType = 'text' | 'image' | 'video';

export interface ChatMessage {
  id: string;
  senderUid: string;
  type: ChatMessageType;
  text?: string;
  mediaUrl?: string;
  storagePath?: string;
  width?: number;
  height?: number;
  createdAt: number;
}

export type ReportReason =
  | 'spam'
  | 'abuse'
  | 'inappropriate'
  | 'fake'
  | 'copyright'
  | 'other';

export type ReportTargetType =
  | 'review'
  | 'partsRequest'
  | 'partsReply'
  | 'user';

/**
 * 사용자가 부적절한 콘텐츠를 신고한 기록.
 * 작성만 가능 — 읽기/수정/삭제는 관리자만 (Firestore 콘솔).
 */
export interface Report {
  id: string;
  reporterUid: string;
  targetType: ReportTargetType;
  targetId: string;        // review: shopCode/uid, partsRequest: rid, partsReply: rid/shopId, user: uid
  targetOwnerUid: string;  // 신고당한 콘텐츠 작성자
  reason: ReportReason;
  detail?: string;         // 자유 입력 (선택)
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: number;
}
