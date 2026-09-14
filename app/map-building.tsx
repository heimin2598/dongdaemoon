import { MapBuildingScreen } from '@/components/map/MapBuildingScreen';

/**
 * /map-building 라우트 — 매장 상세 등 deep link 용.
 * 실제 구현은 공유 컴포넌트에 있고 (tabs)/map 도 동일 컴포넌트를 사용.
 * 두 라우트가 같은 컴포넌트를 렌더하기 때문에 navigator 경계를 넘는 transition 없음.
 */
export default MapBuildingScreen;
