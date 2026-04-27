// 각 층 hotspots_*.ts 의 regions 필드를, SVG 색칠 분류 결과(cells_*.json)에서 계산한 동별 bbox로 교체.
// 기존 방식(매칭된 셀의 code에서 동 추출) 과 달리, OCR 매칭 실패한 셀까지 포함해 동 영역 전체를 커버.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'src/data/floors');
const CACHE = path.join(__dirname, 'out');

const FLOORS = ['B1F', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F'];

for (const floor of FLOORS) {
  const tsFile = path.join(DIR, `hotspots_${floor}.ts`);
  const cacheFile = path.join(CACHE, `cells_${floor}.json`);
  if (!fs.existsSync(tsFile)) continue;
  if (!fs.existsSync(cacheFile)) { console.log(`${floor}: cells 캐시 없음 (skip)`); continue; }

  const { cells } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  // 동별 bbox 계산 (SVG에서 파싱한 모든 분류된 셀 기준)
  const byBld = { A: [], B: [], C: [], N: [] };
  for (const c of cells) if (byBld[c.building]) byBld[c.building].push(c);

  const regions = [];
  for (const [bld, list] of Object.entries(byBld)) {
    if (list.length === 0) continue;
    const minX = Math.min(...list.map((c) => c.x));
    const minY = Math.min(...list.map((c) => c.y));
    const maxX = Math.max(...list.map((c) => c.x + c.w));
    const maxY = Math.max(...list.map((c) => c.y + c.h));
    regions.push({
      building: bld,
      polygon: [
        [+minX.toFixed(2), +minY.toFixed(2)],
        [+maxX.toFixed(2), +minY.toFixed(2)],
        [+maxX.toFixed(2), +maxY.toFixed(2)],
        [+minX.toFixed(2), +maxY.toFixed(2)],
      ],
    });
  }

  const src = fs.readFileSync(tsFile, 'utf8');
  const regionsLiteral = `const REGIONS: FloorHotspotData['regions'] = ${JSON.stringify(regions, null, 2)} as FloorHotspotData['regions'];\n\n`;
  let out;
  if (/const REGIONS[^\n]*\n/.test(src)) {
    out = src.replace(/const REGIONS[\s\S]*?\](?:\s*as[^;]*)?;\s*\n/, regionsLiteral);
  } else {
    // STORES 선언 전체를 보존하면서 앞에 REGIONS 삽입 (lookahead 사용)
    out = src.replace(/(?=const STORES)/, regionsLiteral);
  }
  out = out.replace(/regions:\s*\[\s*\]/, 'regions: REGIONS');

  fs.writeFileSync(tsFile, out);
  const stats = regions.map((r) => `${r.building}:${byBld[r.building].length}`).join(' ');
  console.log(`${floor.padEnd(4)}: regions=${regions.length} (${stats})`);
}
