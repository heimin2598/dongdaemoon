// 화장실 위치를 Store 엔트리로 directory.json에 추가.
// 입력: 데스크탑의 "화장실 위치.txt" (형식 "B1층 A동 117호 옆" 또는 "5층 B동 던킨도너츠 옆" 등)
// 출력: category='편의시설', subCategory='화장실', keywords='화장실' 으로 27개 추가.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIR_PATH = path.join(ROOT, 'src/data/stores/directory.json');
const TOILET_TXT = 'C:/Users/1/Desktop/화장실 위치.txt';

// "B1층" → "B1F", "5층" → "5F", "지하1층" → "B1F"
function floorToCode(txt) {
  if (/^B1층|^지하\s*1\s*층/.test(txt)) return 'B1F';
  const m = txt.match(/^(\d+)층/);
  return m ? `${m[1]}F` : null;
}

function parseLine(line) {
  // 형식들:
  //   "B1층 A동 117호 옆"
  //   "1층 B동 380호 옆"
  //   "2층 B동 94-1호 옆"
  //   "5층 B동 던킨도너츠 옆"
  //   "6층 N동 엘리베이터 옆"
  //   "7층 N동 피부과 입구"
  //   "8층 N동 동대문 풀필먼트 센터 입구"
  //   "9층 N동 공연장 입구"
  const trimmed = line.trim();
  if (!trimmed || trimmed === '화장실 위치') return null;
  // 우선 "X층 Y동 ..." 패턴 추출
  const m = trimmed.match(/^(B1층|\d+층)\s*([ABCN])동\s*(.+)$/);
  if (!m) return null;
  const floor = floorToCode(m[1]);
  const building = m[2];
  const near = m[3].trim(); // 예: "117호 옆", "던킨도너츠 옆", "엘리베이터 옆", "피부과 입구"
  if (!floor) return null;
  return { floor, building, near, raw: trimmed };
}

const raw = fs.readFileSync(TOILET_TXT, 'utf8');
const lines = raw.split(/\r?\n/);

const parsed = [];
for (const l of lines) {
  const p = parseLine(l);
  if (p) parsed.push(p);
}
console.log(`파싱된 화장실 항목: ${parsed.length}개`);

// 기존 디렉터리 로드
const directory = JSON.parse(fs.readFileSync(DIR_PATH, 'utf8'));
const existingIds = new Set(directory.map((s) => s.id));

// 이전에 추가한 화장실 엔트리 제거 (멱등성)
const filtered = directory.filter((s) => !(s.category === '편의시설' && s.subCategory === '화장실'));
const removed = directory.length - filtered.length;
if (removed > 0) console.log(`기존 화장실 엔트리 ${removed}개 제거 후 재생성`);

// 새 ID 할당 (기존과 충돌하지 않도록 9000000부터 시작)
const BASE_ID = 9_000_000;
let nextId = BASE_ID;
while (existingIds.has(nextId)) nextId++;

// 동+층별 순번 (코드 고유성을 위해)
const seqMap = {};
const newEntries = [];
for (const p of parsed) {
  const key = `${p.building}-${p.floor}`;
  seqMap[key] = (seqMap[key] || 0) + 1;
  const seq = String(seqMap[key]).padStart(2, '0');
  const code = `${p.building}-${p.floor}-WC${seq}`;
  // name: 짧게. location에 상세 위치 정보. description에 원문.
  const name = '화장실';
  const location = `${p.building}동 ${p.floor} ${p.near}`;
  const description = `${p.raw} 위치의 공용 화장실`;
  newEntries.push({
    id: nextId++,
    code,
    name,
    category: '편의시설',
    subCategory: '화장실',
    building: p.building,
    floor: p.floor,
    unit: null,
    location,
    phone: null,
    keywords: '화장실',
    description,
    images: [],
    sourceUrl: null,
  });
}

const merged = [...filtered, ...newEntries];
fs.writeFileSync(DIR_PATH, JSON.stringify(merged));
console.log(`추가됨: ${newEntries.length}개 → ${DIR_PATH}`);
console.log('샘플:', JSON.stringify(newEntries[0], null, 2));
