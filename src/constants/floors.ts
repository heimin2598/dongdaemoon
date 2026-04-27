import { FloorCode } from '@/types';

export const FLOORS: FloorCode[] = [
  '9F',
  '8F',
  '7F',
  '6F',
  '5F',
  '4F',
  '3F',
  '2F',
  '1F',
  'B1F',
];

export const FLOOR_LABEL: Record<FloorCode, string> = {
  B1F: '지하 1층',
  '1F': '1층',
  '2F': '2층',
  '3F': '3층',
  '4F': '4층',
  '5F': '5층',
  '6F': '6층',
  '7F': '7층',
  '8F': '8층',
  '9F': '9층',
};

export const FLOOR_INDEX: Record<FloorCode, number> = {
  B1F: -1,
  '1F': 1,
  '2F': 2,
  '3F': 3,
  '4F': 4,
  '5F': 5,
  '6F': 6,
  '7F': 7,
  '8F': 8,
  '9F': 9,
};
