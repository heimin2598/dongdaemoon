// 2F SVG를 파싱해서 점포 후보 셀의 폴리곤 + 바운딩 박스 + 색상을 뽑아낸다.
// 결과: scripts/out/cells_2F.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import svgPathParser from 'svg-path-parser';
const { parseSVG, makeAbsolute } = svgPathParser;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SVG_PATH = path.join(ROOT, 'assets/maps/floors/floor_2F.svg');
const OUT_DIR = path.join(__dirname, 'out');
const OUT_PATH = path.join(OUT_DIR, 'cells_2F.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const svgText = fs.readFileSync(SVG_PATH, 'utf8');

// ── 1. style 블록에서 클래스 → hex 컬러 매핑 ─────────────────
const classMap = {};
const styleMatch = svgText.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (styleMatch) {
  const ruleRe = /\.(st\d+)\s*\{\s*fill:\s*(#[0-9A-Fa-f]+)/g;
  let m;
  while ((m = ruleRe.exec(styleMatch[1]))) classMap[m[1]] = m[2].toUpperCase();
}

// ── 2. viewBox ───────────────────────────────────────────────
const viewBoxMatch = svgText.match(/viewBox=\"([\d\.\s]+)\"/);
const [vbX, vbY, vbW, vbH] = viewBoxMatch
  ? viewBoxMatch[1].split(/\s+/).map(Number)
  : [0, 0, 4406, 3077];

// ── 3. path 전부 추출 ────────────────────────────────────────
const pathRe = /<path\s+class=\"(st\d+)\"\s+d=\"([^\"]+)\"/g;
const rawPaths = [];
let pm;
while ((pm = pathRe.exec(svgText))) {
  rawPaths.push({ cls: pm[1], d: pm[2] });
}

// ── 4. 색상 → 동 분류 (RGB로 색상 거리 계산) ───────────────────
function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
const REF = {
  B: hexToRgb('#CA3653'), // 빨강/핑크
  A: hexToRgb('#15457F'), // 진한 파랑
  C: hexToRgb('#2E8B3D'), // 초록
  N: hexToRgb('#ECB823'), // 노랑/주황
  grey: [128, 128, 128],
  white: [240, 240, 240],
};
function classify(hex) {
  const rgb = hexToRgb(hex);
  let best = null, bestD = Infinity;
  for (const [k, ref] of Object.entries(REF)) {
    const d = dist(rgb, ref);
    if (d < bestD) { bestD = d; best = k; }
  }
  // 회색/흰색은 시설·복도일 가능성 높음
  if (best === 'grey' || best === 'white') return null;
  // 컬러 거리가 너무 크면 신뢰 안 함
  if (bestD > 130) return null;
  return best;
}

// ── 5. 각 path → bounding box ────────────────────────────────
function pathBBox(d) {
  try {
    const cmds = makeAbsolute(parseSVG(d));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cmds) {
      if (typeof c.x === 'number') { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); }
      if (typeof c.y === 'number') { minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); }
      // 곡선의 컨트롤 포인트도 포함하면 bbox가 과장됨 — end point만 사용
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  } catch (e) {
    return null;
  }
}

// ── 6. 모든 path 돌려서 셀 후보 추출 ─────────────────────────
const cells = [];
let total = 0, filteredByColor = 0, filteredBySize = 0;
for (const p of rawPaths) {
  total++;
  const hex = classMap[p.cls];
  if (!hex) continue;
  const bld = classify(hex);
  if (!bld) { filteredByColor++; continue; }
  const bbox = pathBBox(p.d);
  if (!bbox) continue;
  // 점포 셀 크기 필터: 너무 작거나 너무 큰 건 제외
  // 4406x3077 canvas 기준: 점포 셀은 대략 30x20 ~ 300x200
  if (bbox.w < 20 || bbox.h < 15 || bbox.w > 800 || bbox.h > 600) {
    filteredBySize++; continue;
  }
  // 아주 얇은 선(구분선)은 제외
  const ar = bbox.w / bbox.h;
  if (ar < 0.2 || ar > 6) { filteredBySize++; continue; }

  cells.push({
    building: bld,
    cls: p.cls,
    hex,
    x: Math.round(bbox.x * 100) / 100,
    y: Math.round(bbox.y * 100) / 100,
    w: Math.round(bbox.w * 100) / 100,
    h: Math.round(bbox.h * 100) / 100,
  });
}

// ── 7. 빌딩별 카운트 ─────────────────────────────────────────
const byBld = cells.reduce((acc, c) => { acc[c.building] = (acc[c.building] || 0) + 1; return acc; }, {});

console.log('paths 총:', total);
console.log('색상 필터:', filteredByColor, '/ 크기 필터:', filteredBySize);
console.log('최종 셀 후보:', cells.length);
console.log('빌딩별:', byBld);

fs.writeFileSync(
  OUT_PATH,
  JSON.stringify({ viewBox: { x: vbX, y: vbY, w: vbW, h: vbH }, cells }, null, 2),
);
console.log('→ saved:', OUT_PATH);
