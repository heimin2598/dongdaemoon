import { FacilityType } from '@/types';

export const FACILITY_LABEL: Record<FacilityType, string> = {
  toilet: '화장실',
  elevator: '엘리베이터',
  escalator: '에스컬레이터',
  stairs: '계단',
  atm: 'ATM',
  parking: '주차',
  corridor: '연결통로',
  entrance: '출입구',
  subway: '지하철',
  pharmacy: '약국',
  food: '식당가',
  cafe: '카페',
  bank: '은행',
};

export const FACILITY_ICON: Record<FacilityType, string> = {
  toilet: 'WC',
  elevator: 'EV',
  escalator: 'ES',
  stairs: '계',
  atm: '$',
  parking: 'P',
  corridor: '↔',
  entrance: '출',
  subway: '지',
  pharmacy: '℞',
  food: '식',
  cafe: '☕',
  bank: '은',
};
