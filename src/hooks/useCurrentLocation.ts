import { useCallback, useEffect, useState } from 'react';
import { Coords, getCurrentLocation, GetLocationResult } from '@/lib/location';

interface State {
  coords: Coords | null;
  loading: boolean;
  error: GetLocationResult['error'];
}

/**
 * 컴포넌트 마운트 시 현재 위치 한 번 조회.
 * autoFetch=false 면 refetch() 호출 시점에만 가져옴.
 */
export function useCurrentLocation(autoFetch: boolean = true) {
  const [state, setState] = useState<State>({
    coords: null,
    loading: !!autoFetch,
    error: undefined,
  });

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    const result = await getCurrentLocation();
    setState({
      coords: result.coords,
      loading: false,
      error: result.error,
    });
  }, []);

  useEffect(() => {
    if (autoFetch) refetch();
  }, [autoFetch, refetch]);

  return { ...state, refetch };
}
