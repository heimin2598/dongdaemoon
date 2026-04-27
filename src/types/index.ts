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

/**
 * 사장님이 등록한 "매장 단위".
 * 한 사장님이 여러 shop을 가질 수 있고, 한 shop이 여러 호수(storeCodes)를 포함할 수 있다.
 * (예: 한 사업자가 215호 + 216호 두 호수를 한 매장처럼 운영)
 */
export interface Shop {
  id: string;              // shopId (Firestore doc id)
  ownerUid: string;
  storeCodes: string[];    // ['B-6F-215', 'B-6F-216']
  displayName: string;     // 사장님이 부여한 매장 이름
  phone: string;           // 사장님이 입력한 최신 전화번호
  businessHours: string;   // 영업시간 자유 입력 (예: "월-토 09:00-18:00")
  description: string;     // 매장 소개·취급 품목
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  provider: 'email' | 'google' | 'apple';
  role: UserRole;
  status: UserStatus;
}
