// 2F 셀 OCR — 단순화 버전 (원본 작동 로직 + 5배 업스케일만)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PNG_PATH = path.join(ROOT, 'assets/maps/floors/floor_2F.png');
const CELLS_JSON = path.join(__dirname, 'out/cells_2F.json');
const OUT_PATH = path.join(__dirname, 'out/ocr_2F.json');
const TMP_DIR = path.join(__dirname, 'out/tmp_2F');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const { viewBox, cells } = JSON.parse(fs.readFileSync(CELLS_JSON, 'utf8'));
console.log('셀 개수:', cells.length);

const img = sharp(PNG_PATH);
const meta = await img.metadata();
console.log('PNG 크기:', meta.width, 'x', meta.height, ' | viewBox:', viewBox.w, 'x', viewBox.h);

const sx = meta.width / viewBox.w;
const sy = meta.height / viewBox.h;

console.log('Tesseract 초기화...');
const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
await worker.setParameters({
  tessedit_char_whitelist: '0123456789',
  tessedit_pageseg_mode: '7',
});

const results = [];
let progress = 0;
const total = cells.length;
const PAD = 0;
const UPSCALE = 2;

for (let i = 0; i < cells.length; i++) {
  const c = cells[i];
  const left = Math.max(0, Math.round((c.x - PAD) * sx));
  const top = Math.max(0, Math.round((c.y - PAD) * sy));
  const rawW = Math.max(1, Math.round((c.w + PAD * 2) * sx));
  const rawH = Math.max(1, Math.round((c.h + PAD * 2) * sy));
  const width = Math.min(rawW, meta.width - left);
  const height = Math.min(rawH, meta.height - top);
  const tmpFile = path.join(TMP_DIR, `cell_${i}.png`);

  try {
    await sharp(PNG_PATH)
      .extract({ left, top, width, height })
      .grayscale()
      .normalize()
      .resize({ width: Math.max(80, width * UPSCALE), height: Math.max(60, height * UPSCALE) })
      .png()
      .toFile(tmpFile);
  } catch (e) {
    results.push({ ...c, ocr: '', error: 'crop-fail' });
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
  if (progress % 50 === 0 || progress === total) {
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
