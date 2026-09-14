/**
 * 번들 HTML → 정적 사이트 변환.
 *
 * 문제: 디자인 툴이 만들어준 index.html 은 폰트·이미지 21개를 base64 로 통째로 품고 있어
 *       22.9MB. 방문자 1명당 22.9MB 를 받아가 Firebase Hosting 무료 10GB 한도를
 *       450 방문 만에 소진 (2026-07-13 사이트 차단됨).
 *
 * 해결: 브라우저가 런타임에 하던 일(manifest 디코드 → Blob URL → template 치환) 을
 *       빌드 타임에 미리 수행한다.
 *       - 에셋 21개를 /assets/<uuid>.<ext> 파일로 추출
 *       - template 안의 uuid 를 그 파일 경로로 치환
 *       - 결과를 index.html 로 저장 (번들 런타임 자체가 사라짐)
 *
 * 효과: HTML 22.9MB → 약 28KB. 폰트/이미지는 firebase.json 의 1년 immutable 캐시 적용.
 *       브라우저는 실제로 쓰는 폰트 포맷(woff2) 만 받아가고 재방문 시엔 0바이트.
 *
 * 원본은 index.bundle.html 로 백업된다. 재실행해도 항상 원본에서 다시 만든다(idempotent).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = __dirname;
const SRC_BUNDLE = path.join(DIR, 'index.bundle.html');
const INDEX = path.join(DIR, 'index.html');
const ASSET_DIR = path.join(DIR, 'assets');

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'text/css': 'css',
};

// 최초 1회: 현재 index.html 이 번들이면 원본으로 백업.
if (!fs.existsSync(SRC_BUNDLE)) {
  const cur = fs.readFileSync(INDEX, 'utf8');
  if (!cur.includes('__bundler/manifest')) {
    console.error('index.html 이 번들 형식이 아니고 백업본도 없습니다. 중단.');
    process.exit(1);
  }
  fs.writeFileSync(SRC_BUNDLE, cur);
  console.log('원본 백업 → index.bundle.html');
}

const bundle = fs.readFileSync(SRC_BUNDLE, 'utf8');

const manifestMatch = bundle.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
const templateMatch = bundle.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!manifestMatch || !templateMatch) {
  console.error('manifest / template 스크립트를 찾지 못했습니다.');
  process.exit(1);
}

const manifest = JSON.parse(manifestMatch[1]);
let template = JSON.parse(templateMatch[1]);

fs.mkdirSync(ASSET_DIR, { recursive: true });

let written = 0;
let totalBytes = 0;
for (const [uuid, entry] of Object.entries(manifest)) {
  let bytes = Buffer.from(entry.data, 'base64');
  // compressed=true 는 gzip — 런타임의 DecompressionStream('gzip') 과 동일하게 해제.
  if (entry.compressed) bytes = zlib.gunzipSync(bytes);
  const ext = EXT_BY_MIME[entry.mime] || 'bin';
  const fileName = `${uuid}.${ext}`;
  fs.writeFileSync(path.join(ASSET_DIR, fileName), bytes);
  written++;
  totalBytes += bytes.length;
  // 런타임이 하던 것과 동일한 치환 — uuid 문자열이 곧 URL placeholder.
  template = template.split(uuid).join(`/assets/${fileName}`);
}

// === 애드푸딩 카드 추가 (2026-07-29) ===
// 디자인 번들에는 3개 앱(StockRadar/BIFIX/Sherpa)만 있어서, 네 번째 앱 카드를 빌드 타임에 끼워넣는다.
// 문구는 adpudding.com 실제 소개 내용을 그대로 따랐다.
// i18n(ko/en) 사전과 렌더 값(apFeatures/apMail) 도 함께 주입해야 {{ }} 바인딩이 동작한다.
const AP = {
  color: '#F0812A',      // 애드푸딩 브랜드 오렌지
  colorBg: '#FDEFE3',
  colorBorder: '#f7d7bd',
  site: 'https://adpudding.com/',
};

// 1) 카드 마크업 — Sherpa 카드 뒤에 삽입.
const AP_CARD = `

        <!-- AdPudding -->
        <article id="app-adpudding" style="border:1px solid #e8e8e8;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:#fff;scroll-margin-top:90px">
          <div style="height:3px;background:${AP.color}"></div>
          <div style="padding:26px 26px 0">
            <div style="display:flex;align-items:center;gap:11px;margin-bottom:16px">
              <span style="width:38px;height:38px;border-radius:10px;background:${AP.colorBg};display:flex;align-items:center;justify-content:center;flex:none">
                <span style="width:12px;height:12px;border-radius:50%;background:${AP.color}"></span>
              </span>
              <h3 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em"><a href="${AP.site}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:1px">{{ t.apName }}</a></h3>
            </div>
            <p style="margin:0 0 20px;font-size:14.5px;line-height:1.62;color:#555;letter-spacing:-0.01em;min-height:70px">{{ t.apDesc }}</p>
          </div>
          <div id="shot-adpudding" style="width:calc(100% - 52px);height:360px;margin:0 26px 22px;background:linear-gradient(180deg, #FAFAFA 0%, #EDEDED 100%);border:1px solid #E6E6E6;border-radius:12px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;padding:20px 0;box-sizing:border-box"><img src="/images/adpudding.jpg" alt="애드푸딩 앱 스크린샷" loading="lazy" style="max-height:100%;max-width:170px;width:auto;height:auto;object-fit:contain;border-radius:14px;display:block;box-shadow:0 14px 36px -12px rgba(0,0,0,0.32)"></div>
          <div style="padding:0 26px 8px;flex:1">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin-bottom:12px">{{ t.featuresLabel }}</div>
            <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px">
              <sc-for list="{{ apFeatures }}" as="f" hint-placeholder-count="5">
                <li style="display:flex;gap:10px;font-size:14px;color:#333;line-height:1.4;letter-spacing:-0.01em"><span style="color:${AP.color};flex:none">—</span>{{ f }}</li>
              </sc-for>
            </ul>
          </div>
          <div style="padding:22px 26px 26px">
            <a href="{{ apMail }}" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#fff;color:${AP.color};border:1px solid ${AP.colorBorder};text-decoration:none;font-size:14px;font-weight:600;padding:12px;border-radius:8px;letter-spacing:-0.01em">{{ t.apBtn }} <span>→</span></a>
          </div>
        </article>`;

{
  // Sherpa 카드(마지막 article) 뒤에 삽입 — 카드 그리드 닫는 </div> 직전.
  const anchor = '\n      </div>\n    </section>';
  const shIdx = template.indexOf('id="app-sherpa"');
  const insertAt = shIdx >= 0 ? template.indexOf(anchor, shIdx) : -1;
  if (insertAt >= 0) {
    template = template.slice(0, insertAt) + AP_CARD + template.slice(insertAt);
    console.log('애드푸딩 카드 삽입됨');
  } else {
    console.warn('⚠ 애드푸딩 카드 삽입 위치를 찾지 못했습니다');
  }
}

// 2) 카드 그리드 3열 → 4장이 되었으니 2열 2행 (1열 orphan 방지).
template = template.split('grid-template-columns:repeat(3,1fr);gap:24px')
  .join('grid-template-columns:repeat(2,1fr);gap:24px');

// 3) i18n 사전에 애드푸딩 항목 추가 + 기존 "세 개의 앱" 문구 갱신.
const AP_I18N_KO = `
    apName:"애드푸딩",
    apDesc:"애드푸딩은 상품 손익 기준으로 Meta 광고를 자동 운영하는 SaaS입니다. 손익분기 ROAS를 기준으로 소재를 테스트하고, 성과 좋은 소재는 안전한 범위 안에서 자동 증액합니다.",
    apFeatures:["상품 원가·수수료 기반 손익분기 ROAS 자동 계산","실시간 성과와 손익 기준 비교 판정","승인·쿨다운·상한으로 예산 폭주 차단","AI 카피·소재 전략 제안","웹 대시보드 + 모바일 앱 연동"],
    apBtn:"애드푸딩 지원 문의",`;
const AP_I18N_EN = `
    apName:"AdPudding",
    apDesc:"AdPudding automates Meta ads based on per-product profitability. It tests creatives against break-even ROAS and scales the winners within safe limits.",
    apFeatures:["Break-even ROAS from product cost and fees","Live performance judged against profit thresholds","Approval, cooldown and spend caps to prevent runaway budgets","AI copy and creative strategy suggestions","Web dashboard synced with the mobile app"],
    apBtn:"Contact AdPudding support",`;

{
  const koAnchor = '    srDesc:';
  const enIdx = template.indexOf('  en: {');
  const koIdx = template.indexOf(koAnchor);
  if (koIdx >= 0 && enIdx > koIdx) {
    template = template.slice(0, koIdx) + AP_I18N_KO.trimStart() + '\n' + template.slice(koIdx);
  } else {
    console.warn('⚠ ko 사전 삽입 위치를 찾지 못했습니다');
  }
  const enIdx2 = template.indexOf('  en: {');
  const enSrIdx = enIdx2 >= 0 ? template.indexOf('    srDesc:', enIdx2) : -1;
  if (enSrIdx >= 0) {
    template = template.slice(0, enSrIdx) + AP_I18N_EN.trimStart() + '\n' + template.slice(enSrIdx);
  } else {
    console.warn('⚠ en 사전 삽입 위치를 찾지 못했습니다');
  }
}

// 앱 개수를 언급하는 문구 갱신 (세 개 → 네 개).
const TEXT_FIX = [
  ['세 개의 앱은 각각 투자, 라이딩, 시장이라는 서로 다른 현장의 문제를 다룹니다.',
   '네 개의 앱은 각각 투자, 라이딩, 시장, 광고 운영이라는 서로 다른 현장의 문제를 다룹니다.'],
  ['현재 스톡레이더, 바이픽스, 동대문종합시장 셰르파를 개발하고 운영하고 있습니다.',
   '현재 스톡레이더, 바이픽스, 동대문종합시장 셰르파, 애드푸딩을 개발하고 운영하고 있습니다.'],
  ['헤이민 스튜디오는 스톡레이더, 바이픽스, 동대문종합시장 셰르파를 개발하고 운영하는 앱 스튜디오입니다.',
   '헤이민 스튜디오는 스톡레이더, 바이픽스, 동대문종합시장 셰르파, 애드푸딩을 개발하고 운영하는 앱 스튜디오입니다.'],
];
for (const [from, to] of TEXT_FIX) {
  if (template.includes(from)) template = template.split(from).join(to);
  else console.warn(`⚠ 문구 갱신 대상 못 찾음: ${from.slice(0, 24)}…`);
}

// 4) 렌더 값에 apFeatures / apMail 노출 (없으면 {{ }} 가 빈 값으로 나온다).
{
  const from = 'srFeatures: t.srFeatures, bfFeatures: t.bfFeatures, shFeatures: t.shFeatures,';
  const to = 'srFeatures: t.srFeatures, bfFeatures: t.bfFeatures, shFeatures: t.shFeatures, apFeatures: t.apFeatures,';
  if (template.includes(from)) template = template.replace(from, to);
  else console.warn('⚠ features 렌더 값 주입 실패');
  const from2 = 'shMail: subj("Sherpa"),';
  const to2 = 'shMail: subj("Sherpa"), apMail: subj("AdPudding"),';
  if (template.includes(from2)) template = template.replace(from2, to2);
  else console.warn('⚠ mail 렌더 값 주입 실패');
}

// 5) 히어로 우측 "운영 중인 제품" 목록에도 애드푸딩 추가 (카드로 스크롤).
{
  const marker = '<a href="#app-sherpa"';
  const start = template.indexOf(marker);
  const end = start >= 0 ? template.indexOf('</a>', start) + 4 : -1;
  if (end > 0) {
    const sherpaRow = template.slice(start, end);
    const apRow = sherpaRow
      .replace('#app-sherpa', '#app-adpudding')
      .replace(/background:#5A4B9C/, `background:${AP.color}`)
      .replace('{{ t.sherpaShort }}', '{{ t.apName }}');
    template = template.slice(0, end) + '\n          ' + apRow + template.slice(end);
    console.log('히어로 제품 목록에 애드푸딩 추가');
  } else {
    console.warn('⚠ 히어로 제품 목록 삽입 실패');
  }
}

// === 카드 노출 순서 (사용자 지정 2026-07-29: 바이픽스·애드푸딩을 위로) ===
// 2×2 그리드라 앞의 두 개가 윗줄이 된다.
const CARD_ORDER = ['app-bifix', 'app-adpudding', 'app-stockradar', 'app-sherpa'];

{
  // 각 카드 = (앞의 주석) + <article id="app-*"> … </article>. article 중첩은 없다.
  const re = /(?:[ \t]*<!--[^>]*-->\s*)?<article id="(app-[a-z]+)"[\s\S]*?<\/article>/g;
  const found = [];
  let m;
  while ((m = re.exec(template)) !== null) found.push({ id: m[1], html: m[0], start: m.index, end: m.index + m[0].length });

  if (found.length === CARD_ORDER.length) {
    const byId = Object.fromEntries(found.map((f) => [f.id, f.html]));
    const missing = CARD_ORDER.filter((id) => !byId[id]);
    if (missing.length) {
      console.warn(`⚠ 카드 정렬 건너뜀 — 못 찾은 id: ${missing.join(', ')}`);
    } else {
      const from = found[0].start;
      const to = found[found.length - 1].end;
      const reordered = CARD_ORDER.map((id) => byId[id]).join('\n\n        ');
      template = template.slice(0, from) + reordered + template.slice(to);
      console.log(`카드 순서 재배치: ${CARD_ORDER.join(' → ')}`);
    }
  } else {
    console.warn(`⚠ 카드 정렬 건너뜀 — article ${found.length}개 발견 (기대 ${CARD_ORDER.length})`);
  }

  // 히어로 "운영 중인 제품" 목록도 같은 순서로 맞춘다.
  const linkRe = /[ \t]*<a href="#(app-[a-z]+)"[\s\S]*?<\/a>/g;
  const links = [];
  let lm;
  while ((lm = linkRe.exec(template)) !== null) links.push({ id: lm[1], html: lm[0], start: lm.index, end: lm.index + lm[0].length });
  if (links.length === CARD_ORDER.length) {
    const byId = Object.fromEntries(links.map((l) => [l.id, l.html]));
    if (CARD_ORDER.every((id) => byId[id])) {
      const from = links[0].start;
      const to = links[links.length - 1].end;
      template = template.slice(0, from) + CARD_ORDER.map((id) => byId[id]).join('\n') + template.slice(to);
      console.log('히어로 제품 목록도 같은 순서로 정렬');
    }
  } else {
    console.warn(`⚠ 히어로 목록 정렬 건너뜀 — 링크 ${links.length}개 발견`);
  }
}

// === 앱 카드 제목 → 각 앱 홍보 사이트 링크 ===
// 카드 제목(h3)을 외부 링크로. 새 탭 + rel=noopener (탭 탈취 방지).
// 홍보 사이트가 있는 앱만 등록한다 — 없는 앱은 그대로 텍스트.
const APP_SITES = {
  BIFIX: 'https://bifix.app/',
};
let linkedCount = 0;
for (const [name, url] of Object.entries(APP_SITES)) {
  const re = new RegExp(`(<h3[^>]*>)${name}(</h3>)`, 'g');
  const before = template;
  template = template.replace(re, (m, open, close) =>
    `${open}<a href="${url}" target="_blank" rel="noopener noreferrer"`
    + ` style="color:inherit;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:1px">`
    + `${name}</a>${close}`
  );
  if (template !== before) linkedCount++;
  else console.warn(`⚠ '${name}' 카드 제목을 못 찾아 링크를 걸지 못했습니다`);
}
console.log(`앱 카드 제목 링크 ${linkedCount}개 연결`);

// === 앱 스크린샷 — <image-slot> 을 빌드 타임에 실제 <img> 로 확정 ===
//
// 원래는 inject-screenshots.js 가 만든 스크립트가 로드 후 DOM 을 갈아끼우는 방식이었는데,
// 디자인 툴의 image-slot 커스텀 엘리먼트 런타임과 경합해서 실서버에서 교체가 되돌려졌다
// (로컬은 외부 CDN 스크립트가 안 붙어서 우연히 성공 → 라이브에서만 스크린샷이 안 보임).
// 스크립트 경합을 없애려면 슬롯 자체를 남기지 말아야 한다 → HTML 에 <img> 를 박아버린다.
//
// 스크린샷 경량화: 원본은 853~1242px 폭에 1.7~2.0MB 인데 실제 표시는 170px 폭.
// 400px JPEG 로 재인코딩(합계 5.4MB → 257KB). 원본은 images/original/ 보관 (배포 제외).
const SHOTS = {
  'shot-stockradar': { src: '/images/stockradar.jpg', alt: 'StockRadar 앱 스크린샷' },
  'shot-bifix': { src: '/images/bifix.jpg', alt: 'BIFIX 앱 스크린샷' },
  'shot-sherpa': { src: '/images/sherpa.jpg', alt: '동대문 셰르파 앱 스크린샷' },
};
const WRAP_STYLE = [
  'width:calc(100% - 52px)', 'height:360px', 'margin:0 26px 22px',
  'background:linear-gradient(180deg, #FAFAFA 0%, #EDEDED 100%)',
  'border:1px solid #E6E6E6', 'border-radius:12px', 'overflow:hidden',
  'position:relative', 'display:flex', 'align-items:center', 'justify-content:center',
  'padding:20px 0', 'box-sizing:border-box',
].join(';');
const IMG_STYLE = [
  'max-height:100%', 'max-width:170px', 'width:auto', 'height:auto',
  'object-fit:contain', 'border-radius:14px', 'display:block',
  'box-shadow:0 14px 36px -12px rgba(0,0,0,0.32)',
].join(';');

let shotCount = 0;
template = template.replace(
  /<image-slot\b[^>]*\bid="(shot-[a-z]+)"[^>]*>\s*(?:<\/image-slot>)?/gi,
  (whole, id) => {
    const cfg = SHOTS[id];
    if (!cfg) return whole;
    shotCount++;
    return `<div id="${id}" style="${WRAP_STYLE}">`
      + `<img src="${cfg.src}" alt="${cfg.alt}" loading="lazy" style="${IMG_STYLE}">`
      + `</div>`;
  }
);
// 짝이 안 맞아 남은 닫는 태그 제거.
template = template.replace(/<\/image-slot>/gi, '');
console.log(`스크린샷 슬롯 ${shotCount}개 → <img> 로 확정`);
if (shotCount !== Object.keys(SHOTS).length) {
  console.warn(`⚠ 슬롯 개수 불일치 (기대 ${Object.keys(SHOTS).length}, 실제 ${shotCount}) — 확인 필요`);
}

fs.writeFileSync(INDEX, template);

const before = Buffer.byteLength(bundle);
const after = Buffer.byteLength(template);
console.log(`에셋 ${written}개 추출 → assets/ (${(totalBytes / 1048576).toFixed(2)} MB)`);
console.log(`index.html ${(before / 1048576).toFixed(2)} MB → ${(after / 1024).toFixed(1)} KB`);
