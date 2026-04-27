import { create } from 'zustand';
import { Route, SearchResult } from '@/types';

interface RouteState {
  origin: { nodeId: string; label: string } | null;
  destination: SearchResult | null;
  route: Route | null;
  setOrigin: (o: { nodeId: string; label: string } | null) => void;
  setDestination: (d: SearchResult | null) => void;
  setRoute: (r: Route | null) => void;
  reset: () => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  origin: null,
  destination: null,
  route: null,
  setOrigin: (o) => set({ origin: o }),
  setDestination: (d) => set({ destination: d }),
  setRoute: (r) => set({ route: r }),
  reset: () => set({ origin: null, destination: null, route: null }),
}));
