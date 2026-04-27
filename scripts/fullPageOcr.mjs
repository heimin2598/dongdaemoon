// 전체 페이지 OCR 후 bbox 기반 SVG 셀 매칭 실험.
// 핵심 가설: 셀별 크롭 대신 PNG 전체를 한번에 OCR → 모든 숫자의 bbox 수집 → SVG 셀 내부에 떨어지는 숫자를 매칭.
// PNG-SVG aspect mismatch를 bbox 교차 기반으로 허용.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FLOORS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['1F'];

async function ocrFullPage(worker, pngPath) {
  // 큰 이미지를 처리할 때 PSM 11 (sparse_text) — 페이지 전체에서 텍스트 덩어리 찾기
  await worker.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '0123456789' });
  const { data } = await worker.recognize(pngPath);
  // data.words 에는 각 단어의 bbox(x0,y0,x1,y1)와 text, confidence 들어있음
  const hits = (data.words || [])
    .filter((w) => w && w.text && /^\d{3,4}$/.test(w.text.replace(/\s+/g, '')))
    .map((w) => ({
      text: w.text.replace(/\s+/g, ''),
      conf: w.confidence,
      bbox: w.bbox,
    }));
  return { hits, allWords: (data.words || []).length };
}

async function main() {
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: () => {},
    langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
  });

  for (const floor of FLOORS) {
    const pngPath = path.join(ROOT, `assets/maps/floors/floor_${floor}.png`);
    const cellsPath = path.join(__dirname, `out/cells_${floor}.json`);
    if (!fs.existsSync(pngPath) || !fs.existsSync(cellsPath)) {
      console.log(`${floor}: skip (missing file)`);
      continue;
    }

    console.log(`\n══ ${floor} ══`);
    const meta = await sharp(pngPath).metadata();
    const { viewBox, cells } = JSON.parse(fs.readFileSync(cellsPath, 'utf8'));
    const sx = meta.width / viewBox.w;
    const sy = meta.height / viewBox.h;

    const t0 = Date.now();
    const { hits, allWords } = await ocrFullPage(worker, pngPath);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  Full-page OCR: ${hits.length} 숫자 히트 / ${allWords} 총 단어 (${dt}초)`);
    fs.writeFileSync(path.join(__dirname, `out/fullocr_${floor}.json`), JSON.stringify({ hits, meta: { w: meta.width, h: meta.height } }, null, 2));

    // 각 SVG 셀에 대해, 셀 bbox (PNG 좌표계) 내부에 떨어지는 숫자 hit 찾기
    let matched = 0;
    let multiple = 0;
    const cellHits = [];
    for (const c of cells) {
      const cLeft = c.x * sx;
      const cTop = c.y * sy;
      const cRight = (c.x + c.w) * sx;
      const cBot = (c.y + c.h) * sy;
      // 여유: mismatch 보정을 위해 셀 크기의 20% padding
      const padX = (c.w * sx) * 0.2;
      const padY = (c.h * sy) * 0.2;
      const inside = hits.filter((h) => {
        const bx = (h.bbox.x0 + h.bbox.x1) / 2;
        const by = (h.bbox.y0 + h.bbox.y1) / 2;
        return bx >= cLeft - padX && bx <= cRight + padX && by >= cTop - padY && by <= cBot + padY;
      });
      if (inside.length >= 1) {
        // 가장 confidence 높은 것 선택
        inside.sort((a, b) => b.conf - a.conf);
        cellHits.push({ ...c, ocr: inside[0].text, conf: inside[0].conf });
        matched++;
        if (inside.length > 1) multiple++;
      } else {
        cellHits.push({ ...c, ocr: '', conf: 0 });
      }
    }
    console.log(`  셀 매칭: ${matched}/${cells.length} (셀 내부 hit, 중복 후보=${multiple})`);
    fs.writeFileSync(path.join(__dirname, `out/fullocr_cells_${floor}.json`), JSON.stringify({ viewBox, cells: cellHits }, null, 2));
  }

  await worker.terminate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
