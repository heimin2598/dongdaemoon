// 사용자가 직접 업스케일한 PNG로 OCR 테스트.
// 결과: scripts/out/ocr_2F_upscaled.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업스케일된 원본 (데스크탑에 있음)
const PNG_PATH = 'C:/Users/1/Desktop/2층(업스케일).png';
const CELLS_JSON = path.join(__dirname, 'out/cells_2F.json');
const OUT_PATH = path.join(__dirname, 'out/ocr_2F_upscaled.json');
const TMP_DIR = path.join(__dirname, 'out/tmp_2F_upscaled');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const { viewBox, cells } = JSON.parse(fs.readFileSync(CELLS_JSON, 'utf8'));
console.log('셀 개수:', cells.length);

const img = sharp(PNG_PATH, { limitInputPixels: 2_000_000_000 });
const meta = await img.metadata();
console.log('업스케일 PNG:', meta.width, 'x', meta.height, ' | viewBox:', viewBox.w, 'x', viewBox.h);

const sx = meta.width / viewBox.w;
const sy = meta.height / viewBox.h;
console.log('scale factors:', sx.toFixed(2), sy.toFixed(2));

console.log('Tesseract 초기화...');
const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
await worker.setParameters({
  tessedit_char_whitelist: '0123456789',
  tessedit_pageseg_mode: '7',
});

const results = [];
let progress = 0;
const total = cells.length;

for (let i = 0; i < cells.length; i++) {
  const c = cells[i];
  const left = Math.max(0, Math.round(c.x * sx));
  const top = Math.max(0, Math.round(c.y * sy));
  const rawW = Math.max(1, Math.round(c.w * sx));
  const rawH = Math.max(1, Math.round(c.h * sy));
  const width = Math.min(rawW, meta.width - left);
  const height = Math.min(rawH, meta.height - top);
  const tmpFile = path.join(TMP_DIR, `cell_${i}.png`);

  try {
    await sharp(PNG_PATH, { limitInputPixels: 2_000_000_000 })
      .extract({ left, top, width, height })
      .grayscale()
      .normalize()
      // 업스케일 PNG 기반 크롭은 이미 크므로 downscale해서 tesseract 효율↑
      .resize({ width: Math.min(400, width), height: undefined, withoutEnlargement: true })
      .png()
      .toFile(tmpFile);
  } catch (e) {
    results.push({ ...c, ocr: '', error: 'crop-fail: ' + (e.message || '') });
    progress++;
    continue;
  }

  try {
    const { data } = await worker.recognize(tmpFile);
    const text = (data.text || '').replace(/\s+/g, '').trim();
    results.push({ ...c, ocr: text, conf: data.confidence ?? null });
  } catch {
    results.push({ ...c, ocr: '', error: 'ocr-fail' });
  }
  progress++;
  if (progress % 25 === 0 || progress === total) {
    process.stdout.write(`\rOCR ${progress}/${total}`);
  }
}
console.log('');

await worker.terminate();

fs.writeFileSync(OUT_PATH, JSON.stringify({ viewBox, cells: results }, null, 2));
console.log('→ saved:', OUT_PATH);

const withDigit3 = results.filter((r) => /^\d{3,4}$/.test(r.ocr));
const withDigit2plus = results.filter((r) => /^\d{2,4}$/.test(r.ocr));
console.log(`3~4자리 숫자: ${withDigit3.length}/${total} (${((withDigit3.length/total)*100).toFixed(1)}%)`);
console.log(`2~4자리 숫자: ${withDigit2plus.length}/${total} (${((withDigit2plus.length/total)*100).toFixed(1)}%)`);
