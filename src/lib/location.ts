import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
}

export interface GetLocationResult {
  coords: Coords | null;
  error?: 'permission-denied' | 'services-disabled' | 'timeout' | 'unknown';
}

/**
 * 위치 권한 요청. 이미 허용된 상태면 즉시 true.
 * 거부 시 false (사용자가 시스템 설정에서 직접 변경해야 함).
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * 현재 위치 한 번 조회 (단발).
 * 결과: coords 또는 error 코드.
 */
export async function getCurrentLocation(): Promise<GetLocationResult> {
  const granted = await ensureLocationPermission();
  if (!granted) return { coords: null, error: 'permission-denied' };

  // 서비스가 꺼져 있을 수 있음 (위치 서비스 OFF)
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return { coords: null, error: 'services-disabled' };

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      },
    };
  } catch (e) {
    console.error('getCurrentLocation failed:', e);
    return { coords: null, error: 'unknown' };
  }
}

/**
 * 실시간 위치 구독 (선택 사용 — 길안내 화면 등).
 * 반환된 함수 호출로 구독 해제.
 */
export async function subscribeLocation(
  cb: (coords: Coords) => void,
  options?: { distanceInterval?: number; timeInterval?: number },
): Promise<() => void> {
  const granted = await ensureLocationPermission();
  if (!granted) return () => {};
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: options?.distanceInterval ?? 5,
      timeInterval: options?.timeInterval ?? 3000,
    },
    (pos) => {
      cb({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
  );
  return () => sub.remove();
}
