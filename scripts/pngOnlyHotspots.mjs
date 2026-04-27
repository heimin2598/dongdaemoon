// SVG 의존 없이 PNG만으로 층 핫스팟 생성.
// 1. PNG 을 타일(3x2 = 6분할, 20% 중복)로 나눠 각 타일을 upscale 후 OCR.
// 2. word bbox를 전역 좌표로 변환, 3~4자리 숫자만 수집.
// 3. 각 숫자 hit를 디렉터리와 매칭 (해당 층 모든 동에서 exact/endsWith).
// 4. 매칭된 hit 주위에 기본 크기(80x100) 박스를 만들어 hotspots_*.ts 로 저장.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'out');
const TS_OUT_DIR = path.join(ROOT, 'src/data/floors');

const FLOORS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['B1F'];

// 타일 분할: cols × rows 격자, 15% overlap
const COLS = 4;
const ROWS = 3;
const OVERLAP = 0.12;
const UPSCALE = 3; // 타일 내부 3x — 작은 글자 OCR을 위해 업스케일 강화

async function ocrTile(worker, pngPath, extract, tmpFile, psm = '11') {
  const buf = await sharp(pngPath)
    .extract(extract)
    .grayscale()
    .normalize()
    .resize({ width: extract.width * UPSCALE, kernel: 'lanczos3' })
    .sharpen({ sigma: 1.0 })
    .png()
    .toBuffer();
  fs.writeFileSync(tmpFile, buf);
  await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: '0123456789' });
  const { data } = await worker.recognize(tmpFile, {}, { blocks: true });
  const hits = [];
  for (const b of (data.blocks || []))
    for (const p of (b.paragraphs || []))
      for (const l of (p.lines || []))
        for (const w of (l.words || [])) {
          const t = (w.text || '').replace(/\s+/g, '');
          if (!/^\d{3,4}$/.test(t)) continue;
          // 업스케일 좌표 → 원본 타일 좌표 → 전역 좌표
          hits.push({
            text: t,
            conf: w.confidence,
            // bbox는 업스케일된 타일 기준
            x: extract.left + w.bbox.x0 / UPSCALE,
            y: extract.top + w.bbox.y0 / UPSCALE,
            w: (w.bbox.x1 - w.bbox.x0) / UPSCALE,
            h: (w.bbox.y1 - w.bbox.y0) / UPSCALE,
          });
        }
  return hits;
}

async function processFloor(worker, floor, directory) {
  const pngPath = path.join(ROOT, `assets/maps/floors/floor_${floor}.png`);
  if (!fs.existsSync(pngPath)) {
    console.log(`[${floor}] PNG 없음`);
    return null;
  }
  const meta = await sharp(pngPath).metadata();
  console.log(`\n══ ${floor} PNG: ${meta.width}x${meta.height} ══`);

  const tmpDir = path.join(OUT_DIR, `pngocr_${floor}`);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tileW = Math.ceil(meta.width / COLS);
  const tileH = Math.ceil(meta.height / ROWS);
  const padW = Math.round(tileW * OVERLAP);
  const padH = Math.round(tileH * OVERLAP);

  const allHits = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const left = Math.max(0, c * tileW - padW);
      const top = Math.max(0, r * tileH - padH);
      const right = Math.min(meta.width, (c + 1) * tileW + padW);
      const bottom = Math.min(meta.height, (r + 1) * tileH + padH);
      const extract = { left, top, width: right - left, height: bottom - top };
      const t0 = Date.now();
      const hits = await ocrTile(worker, pngPath, extract, path.join(tmpDir, `tile_${r}_${c}.png`));
      console.log(`  tile[${r},${c}] extract=${left},${top},${extract.width}x${extract.height} hits=${hits.length} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
      allHits.push(...hits);
    }
  }

  // 중복 제거: 같은 숫자가 여러 타일에서 잡힐 수 있으므로, bbox가 가까우면(50px 이내) 하나로 병합
  const dedup = [];
  for (const h of allHits) {
    const dup = dedup.find((d) => d.text === h.text && Math.abs(d.x - h.x) < 50 && Math.abs(d.y - h.y) < 50);
    if (!dup) dedup.push(h);
    else if (h.conf > dup.conf) { dup.x = h.x; dup.y = h.y; dup.w = h.w; dup.h = h.h; dup.conf = h.conf; }
  }
  console.log(`  총 hits=${allHits.length} → dedup ${dedup.length}`);

  // 디렉터리 매칭 (이 층의 모든 동 중에서 찾기)
  const dirFloor = directory.filter((s) => s.floor === floor && s.building && s.unit);
  const used = new Set();
  const matched = [];
  for (const h of dedup) {
    const exact = dirFloor.filter((s) => s.unit === h.text);
    let picked = null;
    if (exact.length === 1) picked = exact[0];
    else if (exact.length > 1) {
      // 같은 숫자의 여러 동 후보 — 위치(x좌표) 기준으로 동 추정은 스킵하고 첫 매칭만 (보수적)
      // 실제로는 동 추정이 중요하지만 PNG만으로는 색깔 추정 필요 — 일단 단순화
      picked = exact[0];
    } else {
      const ends = dirFloor.filter((s) => String(s.unit).endsWith(h.text));
      if (ends.length === 1) picked = ends[0];
      else if (ends.length > 1) {
        ends.sort((a, b) => String(a.unit).length - String(b.unit).length);
        picked = ends[0];
      }
    }
    if (picked && !used.has(picked.code)) {
      used.add(picked.code);
      // 기본 핫스팟 박스: OCR bbox 중심 기준 80x100
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h / 2;
      const boxW = 80;
      const boxH = 100;
      matched.push({
        code: picked.code,
        name: picked.name,
        x: +(cx - boxW / 2).toFixed(2),
        y: +(cy - boxH / 2).toFixed(2),
        w: boxW,
        h: boxH,
        ocr: h.text,
        conf: h.conf,
      });
    }
  }
  console.log(`  매칭: ${matched.length}/${dirFloor.length} (디렉터리 ${floor} 기준)`);

  fs.writeFileSync(path.join(OUT_DIR, `pngocr_matched_${floor}.json`), JSON.stringify({ meta: { w: meta.width, h: meta.height }, matched }, null, 2));

  return { floor, meta, matched, dirTotal: dirFloor.length };
}

function writeHotspotsTs(floor, meta, matched) {
  const stores = matched.map((m) => ({ code: m.code, x: m.x, y: m.y, width: m.w, height: m.h }));
  const body = `// AUTO-GENERATED by scripts/pngOnlyHotspots.mjs
// ${floor} PNG 전체 OCR 기반 매칭 (SVG 없이)
// 총 ${matched.length}개 매칭

import { FloorHotspotData } from '@/components/map/ImageOverlayMap';

const W = ${meta.width};
const H = ${meta.height};

const STORES = ${JSON.stringify(stores, null, 2)};

export const HOTSPOTS_${floor}: FloorHotspotData = {
  floor: '${floor}',
  imageWidth: W,
  imageHeight: H,
  regions: [],
  stores: STORES,
  facilities: [],
};
`;
  // 기존 SVG 기반 hotspots_*.ts를 덮어쓰지 않고 staging으로 저장. 검토 후 수동 교체.
  const outPath = path.join(OUT_DIR, `staging_hotspots_${floor}.ts`);
  fs.writeFileSync(outPath, body);
  return outPath;
}

async function main() {
  const directory = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/stores/directory.json'), 'utf8'));
  console.log('Tesseract 초기화 (fast + 타일 OCR)...');
  const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });

  const results = [];
  for (const floor of FLOORS) {
    const r = await processFloor(worker, floor, directory);
    if (r && r.matched.length > 0) {
      const ts = writeHotspotsTs(r.floor, r.meta, r.matched);
      console.log(`  → ${path.relative(ROOT, ts)}`);
      results.push({ floor: r.floor, matched: r.matched.length, dirTotal: r.dirTotal });
    }
  }

  await worker.terminate();
  console.log('\n═════════ 결과 요약 ═════════');
  console.table(results);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
