// 모든 층 (B1F ~ 9F) SVG 파싱 + PNG OCR + 디렉터리 매칭 일괄 실행.
// 실행: node scripts/buildAllHotspots.mjs [floor1 floor2 ...]  (인자 없으면 전 층)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import svgPathParser from 'svg-path-parser';

const { parseSVG, makeAbsolute } = svgPathParser;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ALL_FLOORS = ['B1F', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F'];
const ARG_FLOORS = process.argv.slice(2);
const FLOORS = ARG_FLOORS.length > 0 ? ARG_FLOORS : ALL_FLOORS;

const OUT_DIR = path.join(__dirname, 'out');
const TS_OUT_DIR = path.join(ROOT, 'src/data/floors');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 색상 분류 (동) ───────────────────────────────────────────
function hexToRgb(h) {
  const c = h.startsWith('#') ? h.slice(1) : h;
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}
function distRGB(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
// 동대문종합시장 컬러 팔레트 — SVG마다 살짝 다른 톤을 허용하기 위해 여러 기준점
const REF = {
  B: [hexToRgb('#CA3653'), hexToRgb('#BE3F5B'), hexToRgb('#D4345A')],
  A: [hexToRgb('#15457F'), hexToRgb('#284C7F'), hexToRgb('#1F4FB0')],
  C: [hexToRgb('#2E8B3D'), hexToRgb('#448A47'), hexToRgb('#2E8B57')],
  N: [hexToRgb('#ECB823'), hexToRgb('#E0AC41'), hexToRgb('#E5B720')],
};
const GREY_LIKE = (rgb) => {
  const [r, g, b] = rgb;
  return Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25;
};
function classify(hex) {
  const rgb = hexToRgb(hex);
  if (GREY_LIKE(rgb)) return null; // 회색/흰색 — 시설/복도
  let best = null;
  let bestD = Infinity;
  for (const [k, refs] of Object.entries(REF)) {
    for (const ref of refs) {
      const d = distRGB(rgb, ref);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
  }
  if (bestD > 90) return null;
  return best;
}

// ── 1. SVG 파싱 → 셀 후보 (두 가지 SVG 포맷 모두 지원) ─────────
function extractAttr(tag, name) {
  const re = new RegExp(`${name}="([^"]+)"`);
  const m = tag.match(re);
  return m ? m[1] : null;
}
function parseTransform(transform) {
  // translate(x,y) 또는 translate(x y) 만 지원. 복잡한 transform은 무시.
  if (!transform) return { tx: 0, ty: 0 };
  const m = transform.match(/translate\s*\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/);
  return m ? { tx: parseFloat(m[1]), ty: parseFloat(m[2]) } : { tx: 0, ty: 0 };
}

function parseSvgFile(svgPath) {
  const svgText = fs.readFileSync(svgPath, 'utf8');

  // viewBox 추출
  const vbMatch = svgText.match(/viewBox="([\d\.\s-]+)"/);
  const [vbX, vbY, vbW, vbH] = vbMatch
    ? vbMatch[1].split(/\s+/).map(Number)
    : [0, 0, 4406, 3077];

  // style 블록: 클래스 → hex
  // 주의: `.stN{fill-rule:evenodd;clip-rule:evenodd;fill:#XXXXXX;}` 같이 fill이 앞쪽에 다른
  // 속성이 오는 복합 정의도 지원해야 함 (B1F의 .st7 = C동 초록색이 이 패턴)
  const classMap = {};
  const styleMatches = [...svgText.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  for (const sm of styleMatches) {
    const blockRe = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{([^}]*)\}/g;
    let m;
    while ((m = blockRe.exec(sm[1]))) {
      const name = m[1];
      const body = m[2];
      // body에서 fill:#hex 찾기 (fill-rule 무시 위해 ;로 구분된 속성으로 취급)
      const fm = body.match(/(?:^|;)\s*fill:\s*(#[0-9A-Fa-f]+)/);
      if (fm) classMap[name] = fm[1].toUpperCase();
    }
  }

  // 모든 <path ...> 태그 캡처 (속성 순서 무관하게)
  const pathTagRe = /<path\s+([^>]+?)\/?>/g;
  const paths = [];
  let pm;
  while ((pm = pathTagRe.exec(svgText))) {
    const attrs = pm[1];
    const d = extractAttr(attrs, 'd');
    if (!d) continue;
    // 색상: class 우선, 없으면 inline fill
    const cls = extractAttr(attrs, 'class');
    const inlineFill = extractAttr(attrs, 'fill');
    let hex = null;
    if (cls && classMap[cls]) hex = classMap[cls];
    else if (inlineFill && /^#[0-9A-Fa-f]+$/.test(inlineFill)) hex = inlineFill.toUpperCase();
    if (!hex) continue;

    // transform
    const transform = extractAttr(attrs, 'transform');
    const { tx, ty } = parseTransform(transform);

    paths.push({ cls: cls ?? '', hex, d, tx, ty });
  }

  // path → bbox
  const cells = [];
  for (const p of paths) {
    const bld = classify(p.hex);
    if (!bld) continue;
    try {
      const cmds = makeAbsolute(parseSVG(p.d));
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const c of cmds) {
        if (typeof c.x === 'number') {
          minX = Math.min(minX, c.x);
          maxX = Math.max(maxX, c.x);
        }
        if (typeof c.y === 'number') {
          minY = Math.min(minY, c.y);
          maxY = Math.max(maxY, c.y);
        }
      }
      if (!isFinite(minX)) continue;
      // transform 적용
      minX += p.tx;
      maxX += p.tx;
      minY += p.ty;
      maxY += p.ty;
      const bw = maxX - minX;
      const bh = maxY - minY;
      // 엄격한 점포 셀 크기 필터 — 너무 작거나 너무 크거나 얇은 것 제외
      if (bw < 35 || bh < 30 || bw > 400 || bh > 300) continue;
      const ar = bw / bh;
      if (ar < 0.35 || ar > 4) continue;
      // 면적 필터 — 너무 가느다란 장식 제외
      const area = bw * bh;
      if (area < 1500 || area > 60000) continue;
      cells.push({
        building: bld,
        hex: p.hex,
        x: +minX.toFixed(2),
        y: +minY.toFixed(2),
        w: +bw.toFixed(2),
        h: +bh.toFixed(2),
      });
    } catch {
      // ignore
    }
  }

  return { viewBox: { x: vbX, y: vbY, w: vbW, h: vbH }, paths: paths.length, cells };
}

// ── 2. OCR (여러 전처리 + PSM 모드 시도, 성공하면 early-exit) ────
async function ocrOnce(worker, file, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  try {
    const { data } = await worker.recognize(file);
    const text = (data.text || '').replace(/\s+/g, '').trim();
    return { text, conf: data.confidence ?? 0 };
  } catch {
    return { text: '', conf: 0 };
  }
}

async function cropVariant(pngPath, extract, width, height, variant) {
  // 다양한 전처리 변형
  let s = sharp(pngPath).extract(extract);
  if (variant === 'v1') {
    // 표준: grayscale + normalize + 3x lanczos
    s = s
      .grayscale()
      .normalize()
      .resize({ width: Math.max(120, width * 3), height: Math.max(90, height * 3), kernel: 'lanczos3' });
  } else if (variant === 'v2') {
    // 2x + threshold (문자 대비 극대화)
    s = s
      .grayscale()
      .normalize()
      .resize({ width: Math.max(120, width * 2), height: Math.max(90, height * 2), kernel: 'lanczos3' })
      .threshold(130);
  } else if (variant === 'v3') {
    // 4x + sharpen
    s = s
      .grayscale()
      .normalize()
      .resize({ width: Math.max(150, width * 4), height: Math.max(100, height * 4), kernel: 'lanczos3' })
      .sharpen({ sigma: 1 });
  } else if (variant === 'v4') {
    // 흰 배경에 검은 글자로 강제 반전 (색깔 배경이 진한 경우 대응)
    // 색상 bg → 밝게 노말라이즈 → threshold → 반전으로 글자가 검은색이 되도록
    s = s
      .grayscale()
      .normalize()
      .resize({ width: Math.max(140, width * 3), height: Math.max(100, height * 3), kernel: 'lanczos3' })
      .negate()
      .threshold(140);
  }
  return s.png().toBuffer();
}

async function ocrFloor(worker, pngPath, cells, viewBox, tmpDir) {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const meta = await sharp(pngPath).metadata();
  const sx = meta.width / viewBox.w;
  const sy = meta.height / viewBox.h;

  const results = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const left = Math.max(0, Math.round(c.x * sx));
    const top = Math.max(0, Math.round(c.y * sy));
    const rawW = Math.max(1, Math.round(c.w * sx));
    const rawH = Math.max(1, Math.round(c.h * sy));
    const width = Math.min(rawW, meta.width - left);
    const height = Math.min(rawH, meta.height - top);
    const extract = { left, top, width, height };

    // 변형 v1 + PSM 7 먼저
    let best = { text: '', conf: 0 };
    try {
      const tmpFile = path.join(tmpDir, `cell_${i}.png`);
      const buf1 = await cropVariant(pngPath, extract, width, height, 'v1');
      fs.writeFileSync(tmpFile, buf1);
      const r1 = await ocrOnce(worker, tmpFile, '7');
      if (/^\d{3,4}$/.test(r1.text) && r1.conf >= 50) {
        // 명확한 결과면 여기서 종결
        results.push({ ...c, ocr: r1.text, conf: r1.conf });
        continue;
      }
      best = r1;

      // 2차: v3 (4x + sharpen) + PSM 8
      const buf3 = await cropVariant(pngPath, extract, width, height, 'v3');
      fs.writeFileSync(tmpFile, buf3);
      const r3 = await ocrOnce(worker, tmpFile, '8');
      if (/^\d{3,4}$/.test(r3.text) && r3.conf > best.conf) best = r3;
      if (/^\d{3,4}$/.test(best.text) && best.conf >= 60) {
        results.push({ ...c, ocr: best.text, conf: best.conf });
        continue;
      }

      // 3차: v2 (threshold) + PSM 7
      const buf2 = await cropVariant(pngPath, extract, width, height, 'v2');
      fs.writeFileSync(tmpFile, buf2);
      const r2 = await ocrOnce(worker, tmpFile, '7');
      if (/^\d{3,4}$/.test(r2.text) && r2.conf > best.conf) best = r2;
      if (/^\d{3,4}$/.test(best.text) && best.conf >= 60) {
        results.push({ ...c, ocr: best.text, conf: best.conf });
        continue;
      }

      // 4차: v4 (반전) + PSM 7 — 진한 배경에 흰 글자 대응
      const buf4 = await cropVariant(pngPath, extract, width, height, 'v4');
      fs.writeFileSync(tmpFile, buf4);
      const r4 = await ocrOnce(worker, tmpFile, '7');
      if (/^\d{3,4}$/.test(r4.text) && r4.conf > best.conf) best = r4;

      // 5차: v4 + PSM 8 (한 글자씩 처리)
      if (!/^\d{3,4}$/.test(best.text) || best.conf < 60) {
        const r4b = await ocrOnce(worker, tmpFile, '8');
        if (/^\d{3,4}$/.test(r4b.text) && r4b.conf > best.conf) best = r4b;
      }

      results.push({ ...c, ocr: best.text, conf: best.conf });
    } catch {
      results.push({ ...c, ocr: '', error: 'crop/ocr-fail' });
    }
  }
  return results;
}

// ── 3. 디렉터리 매칭 ─────────────────────────────────────────
function matchStoresForFloor(floor, directory, ocrCells) {
  const dirFloor = directory.filter((s) => s.floor === floor && s.building && s.code);
  const byBuilding = { A: [], B: [], C: [], N: [] };
  for (const s of dirFloor) if (byBuilding[s.building]) byBuilding[s.building].push(s);

  const assigned = new Set();
  const matched = [];
  let modeEnds = 0,
    modeMulti = 0;

  for (const c of ocrCells) {
    if (!/^\d{3,4}$/.test(c.ocr || '')) continue;
    const list = byBuilding[c.building] ?? [];
    const exact = list.filter((s) => s.unit === c.ocr);
    let picked = null;
    let mode = '';
    if (exact.length === 1) {
      picked = exact[0];
      mode = 'exact';
      modeEnds++;
    } else {
      const ends = list.filter((s) => s.unit && String(s.unit).endsWith(c.ocr));
      if (ends.length === 1) {
        picked = ends[0];
        mode = 'endsWith';
        modeEnds++;
      } else if (ends.length > 1) {
        ends.sort((a, b) => String(a.unit).length - String(b.unit).length);
        picked = ends[0];
        mode = 'endsWith-multi';
        modeMulti++;
      }
    }
    if (picked && !assigned.has(picked.code)) {
      assigned.add(picked.code);
      matched.push({ ...c, code: picked.code, name: picked.name, mode });
    }
  }

  return { matched, dirTotal: dirFloor.length, stats: { modeEnds, modeMulti } };
}

// ── 4. TypeScript 파일 생성 ──────────────────────────────────
function writeHotspotsTs(floor, viewBox, matched, dirTotal) {
  const cellsTs = matched.map((c) => ({
    code: c.code,
    x: Math.round(c.x * 100) / 100,
    y: Math.round(c.y * 100) / 100,
    width: Math.round(c.w * 100) / 100,
    height: Math.round(c.h * 100) / 100,
  }));

  // 동별 영역(regions) 계산: 해당 동 매칭 셀들의 bbox 합집합 → 사각 폴리곤
  const byBld = { A: [], B: [], C: [], N: [] };
  for (const c of matched) {
    if (byBld[c.building]) byBld[c.building].push(c);
  }
  const regionsTs = [];
  for (const [bld, list] of Object.entries(byBld)) {
    if (list.length === 0) continue;
    const minX = Math.min(...list.map((c) => c.x));
    const minY = Math.min(...list.map((c) => c.y));
    const maxX = Math.max(...list.map((c) => c.x + c.w));
    const maxY = Math.max(...list.map((c) => c.y + c.h));
    regionsTs.push({
      building: bld,
      polygon: [
        [+minX.toFixed(2), +minY.toFixed(2)],
        [+maxX.toFixed(2), +minY.toFixed(2)],
        [+maxX.toFixed(2), +maxY.toFixed(2)],
        [+minX.toFixed(2), +maxY.toFixed(2)],
      ],
    });
  }

  const body = `// AUTO-GENERATED by scripts/buildAllHotspots.mjs
// ${floor} SVG 파싱 + PNG OCR 매칭 결과
// 총 ${matched.length}개 셀 매칭 (디렉터리 ${floor}: ${dirTotal}개)

import { FloorHotspotData } from '@/components/map/ImageOverlayMap';

const W = ${viewBox.w};
const H = ${viewBox.h};

const REGIONS = ${JSON.stringify(regionsTs, null, 2)};

const STORES = ${JSON.stringify(cellsTs, null, 2)};

export const HOTSPOTS_${floor}: FloorHotspotData = {
  floor: '${floor}',
  imageWidth: W,
  imageHeight: H,
  regions: REGIONS,
  stores: STORES,
  facilities: [],
};
`;

  const outPath = path.join(TS_OUT_DIR, `hotspots_${floor}.ts`);
  fs.writeFileSync(outPath, body);
  return outPath;
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const directory = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/stores/directory.json'), 'utf8'),
  );

  console.log('Tesseract 초기화 (LSTM-fast + v4 반전 변형)...');
  // tessdata_fast: 속도 최적화 모델 (best는 3배 느린데 개선이 5% 미만이라 fast 유지)
  const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: '7',
  });

  const report = [];

  for (const floor of FLOORS) {
    const svgPath = path.join(ROOT, `assets/maps/floors/floor_${floor}.svg`);
    const pngPath = path.join(ROOT, `assets/maps/floors/floor_${floor}.png`);
    if (!fs.existsSync(svgPath)) {
      console.log(`[${floor}] SKIP: ${svgPath} 없음`);
      continue;
    }
    if (!fs.existsSync(pngPath)) {
      console.log(`[${floor}] SKIP: ${pngPath} 없음`);
      continue;
    }

    console.log(`\n══════ ${floor} ══════`);

    // 1. SVG 파싱
    const { viewBox, paths, cells } = parseSvgFile(svgPath);
    const byB = cells.reduce((a, c) => ({ ...a, [c.building]: (a[c.building] || 0) + 1 }), {});
    console.log(`  SVG paths=${paths}, 셀 후보=${cells.length}`, byB);

    if (cells.length === 0) {
      console.log(`  ⚠️ 셀 후보 0 — SVG 형식 다르거나 점포 paths 없음, 스킵`);
      report.push({ floor, cells: 0, matched: 0, dirTotal: 0 });
      continue;
    }

    // 2. OCR
    const tmpDir = path.join(OUT_DIR, `tmp_${floor}`);
    fs.writeFileSync(path.join(OUT_DIR, `cells_${floor}.json`), JSON.stringify({ viewBox, cells }, null, 2));
    const t0 = Date.now();
    const ocrResults = await ocrFloor(worker, pngPath, cells, viewBox, tmpDir);
    const withDigit = ocrResults.filter((r) => /^\d{3,4}$/.test(r.ocr));
    console.log(`  OCR: ${withDigit.length}/${cells.length} 3~4자리 인식 (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
    fs.writeFileSync(path.join(OUT_DIR, `ocr_${floor}.json`), JSON.stringify({ viewBox, cells: ocrResults }, null, 2));

    // 3. 매칭
    const { matched, dirTotal, stats } = matchStoresForFloor(floor, directory, ocrResults);
    console.log(`  매칭: ${matched.length}/${dirTotal} (exact/endsWith=${stats.modeEnds}, multi=${stats.modeMulti})`);

    // 4. TS 생성
    const tsPath = writeHotspotsTs(floor, viewBox, matched, dirTotal);
    console.log(`  → ${path.relative(ROOT, tsPath)}`);

    report.push({ floor, cells: cells.length, matched: matched.length, dirTotal });
  }

  await worker.terminate();

  console.log('\n═════════ 결과 요약 ═════════');
  console.table(report);
  const tot = report.reduce(
    (a, r) => ({ cells: a.cells + r.cells, matched: a.matched + r.matched, dirTotal: a.dirTotal + r.dirTotal }),
    { cells: 0, matched: 0, dirTotal: 0 },
  );
  console.log(`합계: ${tot.matched}/${tot.dirTotal} 매칭 (셀 후보 ${tot.cells})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
