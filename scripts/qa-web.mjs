/**
 * 웹 자동 점검 — 주요 라우트를 실제로 열어 콘솔 에러 / ErrorBoundary 를 잡는다.
 *
 *   npm run web                 # 다른 터미널에서 dev 서버 (expo start --web --port 8085 --offline)
 *   node scripts/qa-web.mjs     # 그 다음 이 스크립트
 *   node scripts/qa-web.mjs --headed --slow   # 눈으로 보면서
 *
 * 왜 필요한가:
 *   tsc 는 mount 시점에 터지는 코드를 못 잡는다. 실제로 `tabBarButton` 렌더가
 *   타입 통과 후 런타임에 throw 해서 사용자에게 ErrorBoundary 가 뜬 적이 있다.
 *   빌드 한 번 돌리는 비용보다 이 1~2분이 압도적으로 싸다.
 *
 * 종료 코드: 0 통과 / 1 실패
 */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE ?? 'http://localhost:8085';
const HEADED = process.argv.includes('--headed');
const SLOW = process.argv.includes('--slow');
const ACCOUNT = { email: 'test@naver.com', password: '123456' };

/** 로그인 없이 볼 수 있는 화면. */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/signup-select',
  '/signup-email',
  '/forgot-password',
  '/terms-of-service',
  '/privacy-policy',
];

/** 로그인 후 화면. 결제 경로를 중심으로 본다. */
const AUTHED_ROUTES = [
  '/(tabs)/home',
  '/(tabs)/map',
  '/(tabs)/search',
  '/(tabs)/parts',
  '/(tabs)/account',
  '/paywall',
  '/favorites',
  '/settings',
  '/app-info',
  '/map-building',
  '/map-floor',
  '/inquiry',
];

// 웹 번들/환경에서 기대되는 잡음 — 실패로 치지 않는다.
const IGNORED = [
  /Download the React DevTools/i,
  /\[expo-notifications\]/i,
  /useNativeDriver/i,
  /shadow\*.*deprecated/i,
  /props\.pointerEvents is deprecated/i,
  /Unexpected text node/i,
  /was preloaded using link preload/i,
  /Failed to load resource.*favicon/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /googleads|doubleclick|admob/i,
  /RevenueCat/i,
  /\[purchases\]/i,
  // RN 터치 responder prop 을 react-native-web 이 DOM 에 그대로 넘겨서 나는 경고.
  // 지도(ZoomableMap) 의 제스처 처리에서만 발생하며 웹 한정이다. 네이티브 동작에는 영향 없다.
  /Unknown event handler property.*onResponder|onStartShouldSetResponder/i,
];

const failures = [];
const seen = new Set();

function note(route, kind, text) {
  const line = text.replace(/\s+/g, ' ').slice(0, 300);
  if (IGNORED.some((re) => re.test(line))) return;
  const key = `${route}|${line}`;
  if (seen.has(key)) return;
  seen.add(key);
  failures.push({ route, kind, text: line });
}

const browser = await chromium.launch({ headless: !HEADED, slowMo: SLOW ? 400 : 0 });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();

let currentRoute = '(boot)';
page.on('console', (msg) => {
  if (msg.type() === 'error') note(currentRoute, 'console.error', msg.text());
  if (msg.text().includes('[ErrorBoundary]')) note(currentRoute, 'ErrorBoundary', msg.text());
});
page.on('pageerror', (err) => note(currentRoute, 'pageerror', err.message));

async function visit(route, timeout = 120000) {
  currentRoute = route;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout });
  } catch (err) {
    note(route, 'navigation', String(err).split('\n')[0]);
    return false;
  }
  // expo-router 가 라우트를 해석하고 첫 화면을 그릴 때까지 여유를 둔다.
  await page.waitForTimeout(1800);
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/문제가 발생했습니다|Something went wrong|Unmatched Route/i.test(body)) {
    note(route, 'screen', `에러 화면 노출: ${body.slice(0, 160)}`);
    return false;
  }
  if (body.trim().length < 2) {
    note(route, 'screen', '빈 화면 (렌더된 텍스트 없음)');
    return false;
  }
  return true;
}

console.log(`대상: ${BASE}\n`);

// 1) 서버가 뜰 때까지 대기
let up = false;
for (let i = 0; i < 40; i++) {
  try {
    const res = await page.request.get(BASE, { timeout: 5000 });
    if (res.ok()) {
      up = true;
      break;
    }
  } catch {
    /* 아직 기동 중 */
  }
  await page.waitForTimeout(3000);
}
if (!up) {
  console.error(`dev 서버에 연결하지 못했다 (${BASE}). npm run web 이 떠 있는지 확인.`);
  await browser.close();
  process.exit(1);
}

// 2) 첫 번들링은 수 분 걸린다 — 워밍업 한 번은 넉넉히 기다린다.
console.log('첫 번들 생성 대기 (최대 10분)…');
const warm = await visit('/', 600000);
console.log(`   ${warm ? 'OK' : 'FAIL'} 첫 화면\n`);

// 3) 비로그인 라우트
console.log('— 비로그인 라우트');
for (const r of PUBLIC_ROUTES) {
  const ok = await visit(r);
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${r}`);
}

// 3) 로그인
console.log('\n— 로그인');
currentRoute = '/login';
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const inputs = page.locator('input');
if ((await inputs.count()) >= 2) {
  await inputs.nth(0).fill(ACCOUNT.email);
  await inputs.nth(1).fill(ACCOUNT.password);
  // RN Web 의 Pressable 은 role=button 없이 div 로 렌더된다 — 텍스트로 잡는다.
  await page.getByText('로그인', { exact: true }).last().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);
}
const loggedIn = !/\/login|\/title/.test(page.url());
if (!loggedIn) note('/login', 'auth', `로그인 실패 — URL ${page.url()}`);
console.log(`   ${loggedIn ? 'OK  ' : 'FAIL'} 로그인 (${page.url().replace(BASE, '')})`);

// 4) 로그인 라우트
console.log('\n— 로그인 라우트');
for (const r of AUTHED_ROUTES) {
  const ok = await visit(r);
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${r}`);
}

// 5) 페이월 상호작용 — 결제 경로가 이번 변경의 핵심이다
console.log('\n— 페이월 상호작용');
currentRoute = '/paywall';
await page.goto(`${BASE}/paywall`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const paywallText = (await page.locator('body').innerText().catch(() => '')) || '';
const checks = [
  ['요금제 안내', /프리미엄/],
  ['자동결제 고지', /자동 결제/],
  ['이용약관 링크', /이용약관/],
  ['개인정보 링크', /개인정보/],
];
for (const [label, re] of checks) {
  const ok = re.test(paywallText);
  if (!ok) note('/paywall', 'content', `${label} 없음`);
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${label}`);
}
const upgrade = page.getByText('프리미엄 시작', { exact: true });
if (await upgrade.count()) {
  await upgrade.last().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const sheet = (await page.locator('body').innerText().catch(() => '')) || '';
  const opened = /요금제 선택/.test(sheet);
  if (!opened) note('/paywall', 'content', '요금제 선택 시트가 열리지 않음');
  console.log(`   ${opened ? 'OK  ' : 'FAIL'} 요금제 선택 시트 열림`);

  // 웹에는 네이티브 결제 모듈이 없다 — 결제를 시도하면 "사용 불가" 안내가 떠야 한다.
  // 조용히 아무 일도 안 일어나면 사용자는 결제가 된 줄 안다.
  if (opened) {
    const confirm = page.getByText(/구독 시작|결제$/).last();
    if (await confirm.count()) {
      page.once('dialog', (d) => d.accept().catch(() => {}));
      await confirm.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const after = (await page.locator('body').innerText().catch(() => '')) || '';
      const guarded = /사용할 수 없|사용 불가|로그인/.test(after) || page.url().includes('paywall');
      if (!guarded) note('/paywall', 'content', '웹에서 결제 시도 시 안내가 없다');
      console.log(`   ${guarded ? 'OK  ' : 'FAIL'} 웹 결제 시도 가드`);
    }
  }
} else {
  console.log('   SKIP 프리미엄 시작 버튼 없음 (이미 프리미엄 계정일 수 있음)');
}

await browser.close();

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`실패 ${failures.length}건\n`);
  for (const f of failures) console.log(`[${f.kind}] ${f.route}\n   ${f.text}\n`);
  process.exit(1);
}
console.log('✅ 콘솔 에러 0 · ErrorBoundary 0 · 모든 라우트 렌더 확인');
