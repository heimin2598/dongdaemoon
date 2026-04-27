import { CategoryKey } from '@/types';

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  fabric: '원단',
  accessory: '액세서리부자재',
  bedding: '침구',
  thread: '실',
  curtain: '커튼',
  clothing_accessory: '의류부자재',
  home_interior: '홈인테리어',
  lace: '레이스',
  button: '단추',
  fur: '모피',
  hanbok: '한복',
  leather: '인조 피혁',
  handicraft: '수예',
  towel: '타월',
  food_court: '푸드코트',
  cafe: '카페',
  restaurant: '식당',
  medical: '병·의원',
  pharmacy: '약국',
  atm: 'ATM',
  bank: '은행',
  studio: '스튜디오',
  office: '사무실',
  parking: '주차장',
};

export interface CategoryDistribution {
  category: CategoryKey;
  building: 'A' | 'B' | 'C' | 'N';
  floor: string;
  note?: string;
}

export const CATEGORY_DISTRIBUTION: CategoryDistribution[] = [
  { category: 'fabric', building: 'A', floor: '2F', note: '커튼, 원단, 레이스, 모피' },
  { category: 'fabric', building: 'A', floor: '3F' },
  { category: 'fabric', building: 'B', floor: '2F', note: '원단, 레이스, 단추' },
  { category: 'fabric', building: 'B', floor: '3F' },
  { category: 'fabric', building: 'C', floor: '1F', note: '원단, 의류부자재, 침구' },
  { category: 'fabric', building: 'C', floor: '2F' },
  { category: 'fabric', building: 'C', floor: '3F' },
  { category: 'fabric', building: 'C', floor: '5F' },
  { category: 'fabric', building: 'N', floor: '2F' },
  { category: 'fabric', building: 'N', floor: '3F' },
  { category: 'fabric', building: 'N', floor: '4F' },

  { category: 'accessory', building: 'A', floor: '5F' },
  { category: 'accessory', building: 'A', floor: '6F' },
  { category: 'accessory', building: 'B', floor: '5F' },
  { category: 'accessory', building: 'C', floor: '5F' },

  { category: 'clothing_accessory', building: 'A', floor: '1F' },
  { category: 'clothing_accessory', building: 'B', floor: '1F' },
  { category: 'clothing_accessory', building: 'C', floor: '1F' },
  { category: 'clothing_accessory', building: 'N', floor: '1F' },

  { category: 'bedding', building: 'A', floor: 'B1F' },
  { category: 'bedding', building: 'A', floor: '1F' },
  { category: 'bedding', building: 'B', floor: 'B1F' },
  { category: 'bedding', building: 'B', floor: '1F' },
  { category: 'bedding', building: 'C', floor: 'B1F' },
  { category: 'bedding', building: 'C', floor: '1F' },
  { category: 'bedding', building: 'N', floor: 'B1F' },

  { category: 'thread', building: 'A', floor: 'B1F' },
  { category: 'thread', building: 'B', floor: 'B1F' },
  { category: 'thread', building: 'C', floor: 'B1F' },

  { category: 'curtain', building: 'A', floor: '2F' },
  { category: 'curtain', building: 'C', floor: 'B1F' },
  { category: 'curtain', building: 'N', floor: 'B1F' },

  { category: 'food_court', building: 'B', floor: '6F', note: '식당가, 카페' },
  { category: 'food_court', building: 'N', floor: '5F', note: '푸드코트' },
  { category: 'food_court', building: 'N', floor: '6F', note: '푸드코트' },
  { category: 'cafe', building: 'B', floor: '5F', note: '던킨도너츠' },
  { category: 'cafe', building: 'B', floor: '6F' },

  { category: 'medical', building: 'A', floor: '7F', note: '내과·검진센터' },
  { category: 'medical', building: 'B', floor: '6F', note: '치과' },
  { category: 'medical', building: 'N', floor: '5F', note: '정형외과' },
  { category: 'medical', building: 'N', floor: '6F', note: '치과' },
  { category: 'medical', building: 'N', floor: '7F', note: '피부과' },
  { category: 'pharmacy', building: 'A', floor: '7F' },
  { category: 'pharmacy', building: 'N', floor: 'B1F' },

  { category: 'atm', building: 'B', floor: '6F' },
  { category: 'atm', building: 'C', floor: '5F' },
  { category: 'atm', building: 'N', floor: '5F' },
  { category: 'atm', building: 'N', floor: '6F' },
  { category: 'bank', building: 'N', floor: '2F', note: '하나은행' },

  { category: 'studio', building: 'A', floor: '4F', note: '무신사 스튜디오' },
  { category: 'studio', building: 'B', floor: '4F', note: '셰어라운지, 사진·방송 스튜디오' },
  { category: 'studio', building: 'C', floor: '4F', note: '무신사 스튜디오' },

  { category: 'office', building: 'A', floor: '6F' },
  { category: 'office', building: 'A', floor: '7F' },
  { category: 'office', building: 'A', floor: '8F' },

  { category: 'parking', building: 'A', floor: 'B1F', note: '지하주차장 연결통로' },
  { category: 'parking', building: 'A', floor: '8F', note: '옥상주차장' },
  { category: 'parking', building: 'B', floor: '7F', note: '옥상주차장' },
  { category: 'parking', building: 'C', floor: '7F', note: '옥상주차장' },
  { category: 'parking', building: 'N', floor: '1F', note: '옥상주차장 입·출구' },
  { category: 'parking', building: 'N', floor: '7F', note: '옥상주차장 연결통로' },
];
