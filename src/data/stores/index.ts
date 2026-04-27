import { BuildingCode, FloorCode } from '@/types';
import directoryJson from './directory.json';
import categoryTreeJson from './category_tree.json';
import { MainCategory, Store } from './types';

/**
 * 동대문 종합시장 전체 점포 디렉터리 (3,662개)
 * - JSON은 번들 시점에 로드됨
 * - 인덱스는 첫 접근 시 lazy 구축되어 메모리에 캐시됨
 */

const STORES: Store[] = directoryJson as unknown as Store[];

export const CATEGORY_TREE: Record<MainCategory, string[]> =
  categoryTreeJson as Record<MainCategory, string[]>;

// ── Lazy Indexes ────────────────────────────────────────────────

let _byCode: Map<string, Store> | null = null;
let _byBF: Map<string, Store[]> | null = null;
let _byCat: Map<MainCategory, Store[]> | null = null;
let _bySub: Map<string, Store[]> | null = null;

function byCode(): Map<string, Store> {
  if (_byCode) return _byCode;
  const m = new Map<string, Store>();
  for (const s of STORES) {
    if (s.code) m.set(s.code, s);
  }
  _byCode = m;
  return m;
}

function byBF(): Map<string, Store[]> {
  if (_byBF) return _byBF;
  const m = new Map<string, Store[]>();
  for (const s of STORES) {
    if (!s.building || !s.floor) continue;
    const key = `${s.building}_${s.floor}`;
    const arr = m.get(key) ?? [];
    arr.push(s);
    m.set(key, arr);
  }
  // stable sort by unit number (numeric ascending)
  for (const arr of m.values()) {
    arr.sort((a, b) => {
      const na = parseInt(String(a.unit ?? '').replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(String(b.unit ?? '').replace(/\D/g, ''), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.unit ?? '').localeCompare(String(b.unit ?? ''));
    });
  }
  _byBF = m;
  return m;
}

function byCat(): Map<MainCategory, Store[]> {
  if (_byCat) return _byCat;
  const m = new Map<MainCategory, Store[]>();
  for (const s of STORES) {
    const arr = m.get(s.category) ?? [];
    arr.push(s);
    m.set(s.category, arr);
  }
  _byCat = m;
  return m;
}

function bySub(): Map<string, Store[]> {
  if (_bySub) return _bySub;
  const m = new Map<string, Store[]>();
  for (const s of STORES) {
    if (!s.subCategory) continue;
    const arr = m.get(s.subCategory) ?? [];
    arr.push(s);
    m.set(s.subCategory, arr);
  }
  _bySub = m;
  return m;
}

// ── Public API ─────────────────────────────────────────────────

export function getAllStores(): Store[] {
  return STORES;
}

export function getStoreByCode(code: string): Store | undefined {
  return byCode().get(code);
}

export function getStoreById(id: number): Store | undefined {
  return STORES.find((s) => s.id === id);
}

export function getStoresByBuildingFloor(building: BuildingCode, floor: FloorCode): Store[] {
  return byBF().get(`${building}_${floor}`) ?? [];
}

export function getStoresByCategory(cat: MainCategory): Store[] {
  return byCat().get(cat) ?? [];
}

export function getStoresBySubCategory(sub: string): Store[] {
  return bySub().get(sub) ?? [];
}

export function countStores(): number {
  return STORES.length;
}

export function getStoreCounts(): {
  total: number;
  byCategory: Record<string, number>;
  byBuildingFloor: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byBuildingFloor: Record<string, number> = {};
  for (const s of STORES) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    if (s.building && s.floor) {
      const k = `${s.building}_${s.floor}`;
      byBuildingFloor[k] = (byBuildingFloor[k] || 0) + 1;
    }
  }
  return { total: STORES.length, byCategory, byBuildingFloor };
}

// ── Keyword tokenization ───────────────────────────────────────

/**
 * "니트, 프로모션" 또는 "짬뽕, 식당" 같은 키워드 문자열을 개별 태그 배열로 쪼갠다.
 * 쉼표, 공백, 슬래시, 파이프, 세미콜론 모두 구분자.
 */
export function parseKeywordTags(keywords: string): string[] {
  if (!keywords) return [];
  return keywords
    .split(/[,/|;\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** 점포의 모든 검색 가능한 태그(대카, 세부카, 키워드 토큰 전체 합집합) */
export function getStoreTags(s: Store): string[] {
  const tags: string[] = [];
  if (s.category) tags.push(s.category);
  if (s.subCategory) tags.push(s.subCategory);
  tags.push(...parseKeywordTags(s.keywords));
  // 중복 제거
  return [...new Set(tags)];
}

// ── Full-text search ───────────────────────────────────────────

interface MatchResult {
  store: Store;
  score: number;
}

/**
 * 점포만 검색 (대·세부 카테고리 집계 결과는 포함하지 않음).
 *
 * 점수 체계
 * - 상호명 정확 일치: 100
 * - 상호명 접두 일치: 60
 * - 상호명 포함: 40
 * - 호수 번호 일치: 90  / 코드(동-층-호) 일치: 30
 * - 전화번호 포함 (4자리 이상): 40
 * - 세부카테고리 정확 일치: 80  / 포함: 50
 * - 대카테고리 정확 일치: 60  / 포함: 40
 * - 키워드 태그 정확 일치: 70  / 부분 포함: 30
 * - 상세설명 포함: 10
 */
export function searchStores(query: string, limit = 100): Store[] {
  const q = query.trim();
  if (!q) return [];
  const lq = q.toLowerCase();
  const digits = q.replace(/\D/g, '');

  const results: MatchResult[] = [];

  for (const s of STORES) {
    let score = 0;

    // 상호명
    const name = (s.name || '').toLowerCase();
    if (name === lq) score += 100;
    else if (name.startsWith(lq)) score += 60;
    else if (name.includes(lq)) score += 40;

    // 호수 (숫자)
    if (digits && s.unit && String(s.unit).includes(digits)) score += 90;
    if (digits && s.code && s.code.includes(digits)) score += 30;

    // 전화번호
    if (digits && s.phone && s.phone.includes(digits) && digits.length >= 4) score += 40;

    // 대카테고리
    const cat = (s.category || '').toLowerCase();
    if (cat === lq) score += 60;
    else if (cat.includes(lq)) score += 40;

    // 세부카테고리 (강하게)
    const sub = (s.subCategory || '').toLowerCase();
    if (sub && sub === lq) score += 80;
    else if (sub && sub.includes(lq)) score += 50;

    // 키워드 태그 (토큰 단위 + 전체 문자열 검색 둘 다)
    const tags = parseKeywordTags(s.keywords);
    for (const t of tags) {
      const lt = t.toLowerCase();
      if (lt === lq) {
        score += 70;
        break;
      } else if (lt.includes(lq) || lq.includes(lt)) {
        score += 30;
      }
    }

    // 상세설명
    const desc = (s.description || '').toLowerCase();
    if (desc.includes(lq)) score += 10;

    if (score > 0) results.push({ store: s, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 동점이면 상호명 오름차순
    return (a.store.name || '').localeCompare(b.store.name || '');
  });
  return results.slice(0, limit).map((r) => r.store);
}

/** 특정 태그(키워드/서브카테고리/대카테고리) 값과 정확히 매칭되는 점포 전체 */
export function getStoresByTag(tag: string): Store[] {
  const lt = tag.toLowerCase();
  return STORES.filter((s) => {
    if ((s.category || '').toLowerCase() === lt) return true;
    if ((s.subCategory || '').toLowerCase() === lt) return true;
    const tags = parseKeywordTags(s.keywords).map((t) => t.toLowerCase());
    return tags.includes(lt);
  });
}
