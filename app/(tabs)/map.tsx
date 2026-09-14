import { MapBuildingScreen } from '@/components/map/MapBuildingScreen';

/**
 * 지도 탭 — 탭 안에서 직접 지도 화면을 렌더.
 * 이전 구현은 /map-building 으로 Redirect 했는데 그 cross-navigator transition 이
 * release 빌드에서 silent native crash 를 유발. 같은 컴포넌트를 (tabs)/map 안에서
 * 직접 렌더하면 transition 자체가 일어나지 않음.
 * 탭바는 (tabs)/_layout.tsx 의 tabBarStyle 옵션으로 이 화면에서 숨김.
 */
export default MapBuildingScreen;
