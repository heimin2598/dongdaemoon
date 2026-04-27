import { FloorCode } from '@/types';

/**
 * 층별 배경 지도 이미지 (원본 PNG).
 * 번들러가 정적 참조를 요구하므로 switch로 작성.
 */

export interface FloorImageMeta {
  /** Metro가 번들링하는 require() 결과 */
  source: any;
  width: number;
  height: number;
}

const DIMENSIONS: Record<FloorCode, { w: number; h: number }> = {
  B1F: { w: 4612, h: 3190 },
  '1F': { w: 4381, h: 3203 },
  '2F': { w: 4406, h: 3077 },
  '3F': { w: 4312, h: 3088 },
  '4F': { w: 4300, h: 3094 },
  '5F': { w: 4344, h: 3090 },
  '6F': { w: 4359, h: 3128 },
  '7F': { w: 4311, h: 3125 },
  '8F': { w: 4311, h: 3125 },
  '9F': { w: 4311, h: 3125 },
};

export function getFloorImage(floor: FloorCode): FloorImageMeta | null {
  const dim = DIMENSIONS[floor];
  if (!dim) return null;
  let source: any;
  switch (floor) {
    case 'B1F': source = require('@assets/maps/floors/floor_B1F.png'); break;
    case '1F':  source = require('@assets/maps/floors/floor_1F.png');  break;
    case '2F':  source = require('@assets/maps/floors/floor_2F.png');  break;
    case '3F':  source = require('@assets/maps/floors/floor_3F.png');  break;
    case '4F':  source = require('@assets/maps/floors/floor_4F.png');  break;
    case '5F':  source = require('@assets/maps/floors/floor_5F.png');  break;
    case '6F':  source = require('@assets/maps/floors/floor_6F.png');  break;
    case '7F':  source = require('@assets/maps/floors/floor_7F.png');  break;
    case '8F':  source = require('@assets/maps/floors/floor_8F.png');  break;
    case '9F':  source = require('@assets/maps/floors/floor_9F.png');  break;
    default: return null;
  }
  return { source, width: dim.w, height: dim.h };
}
