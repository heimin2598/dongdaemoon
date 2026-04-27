import { NAV_EDGES, NAV_NODES } from '@/data/navigation';
import { NavEdge, NavNode, Route, RouteStep } from '@/types';

interface Graph {
  nodes: Map<string, NavNode>;
  adj: Map<string, Array<{ to: string; weight: number; edge: NavEdge }>>;
}

function buildGraph(): Graph {
  const nodes = new Map<string, NavNode>();
  const adj = new Map<string, Array<{ to: string; weight: number; edge: NavEdge }>>();
  for (const n of NAV_NODES) {
    nodes.set(n.id, n);
    adj.set(n.id, []);
  }
  for (const e of NAV_EDGES) {
    adj.get(e.from)?.push({ to: e.to, weight: e.weight, edge: e });
    adj.get(e.to)?.push({ to: e.from, weight: e.weight, edge: e });
  }
  return { nodes, adj };
}

const GRAPH = buildGraph();

function dijkstra(from: string, to: string): { path: string[]; cost: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  for (const id of GRAPH.nodes.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  if (!dist.has(from) || !dist.has(to)) return null;
  dist.set(from, 0);

  const queue: Array<[string, number]> = [[from, 0]];

  while (queue.length > 0) {
    queue.sort((a, b) => a[1] - b[1]);
    const [u, d] = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === to) break;
    const adj = GRAPH.adj.get(u) ?? [];
    for (const { to: v, weight } of adj) {
      if (visited.has(v)) continue;
      const alt = d + weight;
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt);
        prev.set(v, u);
        queue.push([v, alt]);
      }
    }
  }

  if ((dist.get(to) ?? Infinity) === Infinity) return null;
  const path: string[] = [];
  let cur: string | null = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return { path, cost: dist.get(to)! };
}

function edgeBetween(a: string, b: string): NavEdge | null {
  return (
    NAV_EDGES.find(
      (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
    ) ?? null
  );
}

function stepText(prev: NavNode, next: NavNode, mode?: NavEdge['mode']): string {
  const dest = next.label ?? next.id;
  if (prev.floor !== next.floor) {
    const direction = floorIndex(next.floor) > floorIndex(prev.floor) ? '올라가' : '내려가';
    const modeText =
      mode === 'elevator' ? '엘리베이터로' :
      mode === 'escalator' ? '에스컬레이터로' :
      mode === 'stairs' ? '계단으로' : '';
    return `${next.building}동 ${next.floor}까지 ${modeText} ${direction}세요. (${dest})`;
  }
  if (prev.building !== next.building) {
    return `${next.building}동으로 이동하세요 (${dest}).`;
  }
  if (mode === 'corridor') {
    return `연결통로를 따라 ${dest}로 이동하세요.`;
  }
  return `${dest} 방향으로 이동하세요.`;
}

function floorIndex(floor: string): number {
  if (floor === 'B1F') return -1;
  const n = parseInt(floor.replace('F', ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function findRoute(fromNodeId: string, toNodeId: string): Route | null {
  const res = dijkstra(fromNodeId, toNodeId);
  if (!res) return null;
  const nodes = res.path.map((id) => GRAPH.nodes.get(id)!).filter(Boolean);
  const edges: NavEdge[] = [];
  const steps: RouteStep[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const e = edgeBetween(nodes[i - 1].id, nodes[i].id);
    if (e) edges.push(e);
    steps.push({
      text: stepText(nodes[i - 1], nodes[i], e?.mode),
      building: nodes[i].building,
      floor: nodes[i].floor,
      mode: e?.mode,
    });
  }
  return { nodes, edges, steps, totalWeight: res.cost };
}

export function findNearestNode(
  building: string,
  floor: string,
  preferredTypes: string[] = ['entrance', 'elevator', 'escalator'],
): NavNode | null {
  const candidates = NAV_NODES.filter(
    (n) => n.building === building && n.floor === floor && preferredTypes.includes(n.type),
  );
  return candidates[0] ?? null;
}

export const NAV_GRAPH = GRAPH;
