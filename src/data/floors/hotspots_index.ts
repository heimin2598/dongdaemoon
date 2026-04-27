import { FloorCode } from '@/types';
import { FloorHotspotData } from '@/components/map/ImageOverlayMap';
import { HOTSPOTS_B1F } from './hotspots_B1F';
import { HOTSPOTS_1F } from './hotspots_1F';
import { HOTSPOTS_2F } from './hotspots_2F';
import { HOTSPOTS_3F } from './hotspots_3F';
import { HOTSPOTS_4F } from './hotspots_4F';
import { HOTSPOTS_5F } from './hotspots_5F';
import { HOTSPOTS_6F } from './hotspots_6F';
import { HOTSPOTS_7F } from './hotspots_7F';
import { HOTSPOTS_8F } from './hotspots_8F';
import { HOTSPOTS_9F } from './hotspots_9F';

const REGISTRY: Partial<Record<FloorCode, FloorHotspotData>> = {
  B1F: HOTSPOTS_B1F,
  '1F': HOTSPOTS_1F,
  '2F': HOTSPOTS_2F,
  '3F': HOTSPOTS_3F,
  '4F': HOTSPOTS_4F,
  '5F': HOTSPOTS_5F,
  '6F': HOTSPOTS_6F,
  '7F': HOTSPOTS_7F,
  '8F': HOTSPOTS_8F,
  '9F': HOTSPOTS_9F,
};

export function getHotspots(floor: FloorCode): FloorHotspotData | null {
  return REGISTRY[floor] ?? null;
}

export function hasHotspots(floor: FloorCode): boolean {
  return floor in REGISTRY;
}
