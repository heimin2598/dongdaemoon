import { BuildingCode, FloorCode } from '@/types';

export type MainCategory =
  | '원단'
  | '부자재'
  | '혼수/홈인테리어'
  | '실'
  | '레이스'
  | '식음시설'
  | '편의시설'
  | '기타';

export interface Store {
  id: number;
  /** ex. "B-4F-062" */
  code: string | null;
  name: string;
  category: MainCategory;
  subCategory: string | null;
  /** Normalized single letter or null */
  building: BuildingCode | null;
  /** "1F" | "B1F" | "4F" ... */
  floor: FloorCode | null;
  unit: string | null;
  location: string | null;
  phone: string | null;
  keywords: string;
  description: string;
  images: string[];
  sourceUrl: string | null;
}

export const MAIN_CATEGORIES: MainCategory[] = [
  '원단',
  '부자재',
  '혼수/홈인테리어',
  '실',
  '레이스',
  '식음시설',
  '편의시설',
  '기타',
];

export const MAIN_CATEGORY_EMOJI: Record<MainCategory, string> = {
  원단: '🧵',
  부자재: '🪡',
  '혼수/홈인테리어': '🛏️',
  실: '🧶',
  레이스: '✨',
  식음시설: '🍱',
  편의시설: '🏧',
  기타: '📦',
};

export const MAIN_CATEGORY_COLOR: Record<MainCategory, string> = {
  원단: '#2E8B57',
  부자재: '#D4A017',
  '혼수/홈인테리어': '#8E44AD',
  실: '#1F4FB0',
  레이스: '#D4345A',
  식음시설: '#E67E22',
  편의시설: '#16A085',
  기타: '#6B7280',
};
