/**
 * 실기기 점검 — 릴리스 APK 를 올려 실제로 화면을 돌면서 크래시/JS 에러를 잡는다.
 *
 *   cd android && JAVA_HOME=<JDK17> ./gradlew assembleRelease
 *   node scripts/qa-device.mjs                 # 연결된 첫 기기
 *   node scripts/qa-device.mjs --serial <id>   # 기기 지정
 *   node scripts/qa-device.mjs --keep          # 끝나고 앱 유지 (수동 확인용)
 *
 * 왜 Expo Go 대신인가:
 *   Expo Go 는 SDK 버전이 묶여 있고 runtimeVersion 정책 때문에 이 프로젝트에선 안 열린다.
 *   릴리스 variant APK 는 JS 번들이 포함돼 있어 metro 없이 돌고, Fabric/New Architecture 처럼
 *   프로덕션 빌드에서만 드러나는 문제까지 잡힌다. Expo Go 보다 충실한 검증이다.
 *
 * 종료 코드: 0 통과 / 1 실패
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';

const APK = 'android/app/build/outputs/apk/release/app-release.apk';
const PKG = 'com.ddmsherpa.app';
const SCHEME = 'ddmsherpa';
const KEEP = process.argv.includes('--keep');
const serialArg = process.argv.indexOf('--serial');
const ACCOUNT = { email: 'test@naver.com', password: '123456' };

/** 딥링크로 돌 화면. 결제 경로가 이번 변경의 핵심이다. */
const ROUTES = [
  'home',
  'map-building',
  'map-floor',
  'search',
  'parts',
  'account',
  'paywall',
  'favorites',
  'settings',
  'app-info',
  'terms-of-service',
  'privacy-policy',
];

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function pickSerial() {
  if (serialArg >= 0 && process.argv[serialArg + 1]) return process.argv[serialArg + 1];
  const lines = sh('adb devices').split('\n').slice(1);
  for (const l of lines) {
    const [id, state] = l.trim().split(/\s+/);
    if (id && state === 'device') return id;
  }
  throw new Error('연결된 기기가 없다. adb devices 확인.');
}

const SERIAL = pickSerial();
// uiautomator / logcat 출력은 수십 MB 가 될 수 있다 — 기본 버퍼(1MB)로는 ENOBUFS 로 죽는다.
const adb = (args, opts = {}) => {
  try {
    return execFileSync('adb', ['-s', SERIAL, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
      ...opts,
    });
  } catch (err) {
    return typeof err.stdout === 'string' ? err.stdout : '';
  }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(APK)) {
  console.error(`APK 가 없다: ${APK}\n먼저 assembleRelease 를 돌려라.`);
  process.exit(1);
}

const model = adb(['shell', 'getprop', 'ro.product.model']).trim();
console.log(`기기: ${SERIAL} (${model})\n`);

console.log('설치 중… (릴리스 APK 는 용량이 커서 수 분 걸린다)');
const installOut = adb(['install', '-r', '-d', APK]);
if (!/Success/i.test(installOut)) {
  console.error(`설치 실패: ${installOut.slice(0, 400)}`);
  process.exit(1);
}
console.log('   OK 설치 완료\n');

adb(['logcat', '-c']);
adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);
await wait(9000);

/** 현재 화면의 UI 트리에서 텍스트/리소스로 노드 중심 좌표 찾기. */
function findNode(matcher) {
  adb(['shell', 'uiautomator dump /sdcard/ui.xml >/dev/null 2>&1']);
  const xml = adb(['shell', 'cat', '/sdcard/ui.xml']);
  const nodes = xml.match(/<node[^>]*\/?>/g) ?? [];
  for (const n of nodes) {
    if (!matcher(n)) continue;
    const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) continue;
    return {
      x: Math.round((Number(b[1]) + Number(b[3])) / 2),
      y: Math.round((Number(b[2]) + Number(b[4])) / 2),
    };
  }
  return null;
}

function screenText() {
  adb(['shell', 'uiautomator dump /sdcard/ui.xml >/dev/null 2>&1']);
  const xml = adb(['shell', 'cat', '/sdcard/ui.xml']);
  return [...xml.matchAll(/text="([^"]*)"/g)].map((m) => m[1]).filter(Boolean).join(' | ');
}

const failures = [];

// ── 로그인 ──────────────────────────────────────────────
console.log('— 로그인');
let logged = /어디를 찾으시나요|관심 매장/.test(screenText());
if (!logged) {
  const emailField = findNode((n) => /class="android.widget.EditText"/.test(n));
  if (emailField) {
    adb(['shell', 'input', 'tap', String(emailField.x), String(emailField.y)]);
    await wait(900);
    adb(['shell', 'input', 'text', ACCOUNT.email.replace('@', '\\@')]);
    await wait(600);
    // 두 번째 EditText(비밀번호) 로 이동
    const fields = [];
    adb(['shell', 'uiautomator dump /sdcard/ui.xml >/dev/null 2>&1']);
    const xml = adb(['shell', 'cat', '/sdcard/ui.xml']);
    for (const n of xml.match(/<node[^>]*\/?>/g) ?? []) {
      if (!/class="android.widget.EditText"/.test(n)) continue;
      const b = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (b)
        fields.push({
          x: Math.round((Number(b[1]) + Number(b[3])) / 2),
          y: Math.round((Number(b[2]) + Number(b[4])) / 2),
        });
    }
    if (fields[1]) {
      adb(['shell', 'input', 'tap', String(fields[1].x), String(fields[1].y)]);
      await wait(700);
      adb(['shell', 'input', 'text', ACCOUNT.password]);
      await wait(600);
    }
    adb(['shell', 'input', 'keyevent', '4']); // 키보드 닫기
    await wait(800);
    const btn = findNode((n) => /text="로그인"/.test(n) && /clickable="true"/.test(n))
      ?? findNode((n) => /text="로그인"/.test(n));
    if (btn) {
      adb(['shell', 'input', 'tap', String(btn.x), String(btn.y)]);
      await wait(9000);
    }
  }
  logged = /어디를 찾으시나요|관심 매장|빠른 검색/.test(screenText());
}
console.log(`   ${logged ? 'OK  ' : 'WARN'} 로그인 ${logged ? '성공' : '실패 — 보호 화면은 참고용'}`);
if (!logged) failures.push({ route: 'login', text: '자동 로그인 실패' });

// ── 라우트 순회 ─────────────────────────────────────────
console.log('\n— 화면 순회');
for (const route of ROUTES) {
  adb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `${SCHEME}://${route}`,
    PKG,
  ]);
  await wait(3200);
  const alive = adb(['shell', 'pidof', PKG]).trim().length > 0;
  const text = alive ? screenText() : '';
  const crashed = !alive;
  const errScreen = /문제가 발생했습니다|Something went wrong|Unmatched Route/.test(text);
  if (crashed) failures.push({ route, text: '앱이 죽었다 (프로세스 없음)' });
  else if (errScreen) failures.push({ route, text: `에러 화면: ${text.slice(0, 120)}` });
  console.log(`   ${crashed || errScreen ? 'FAIL' : 'OK  '} ${route}`);
  if (crashed) {
    adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);
    await wait(8000);
  }
}

// ── 페이월 내용 확인 ────────────────────────────────────
console.log('\n— 페이월');
adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `${SCHEME}://paywall`, PKG]);
await wait(4000);
// 페이월은 스크롤 화면이다. uiautomator 는 보이는 노드만 덤프하므로
// 아래쪽 고지/링크를 확인하려면 끝까지 내려야 한다.
let pay = screenText();
for (let i = 0; i < 6; i++) {
  adb(['shell', 'input', 'swipe', '540', '1600', '540', '500', '300']);
  await wait(700);
  const more = screenText();
  if (more === pay) break;
  pay += ' | ' + more;
}
for (const [label, re] of [
  ['요금제 표시', /프리미엄/],
  ['자동결제 고지', /자동 결제/],
  ['이용약관 링크', /이용약관/],
  ['개인정보 링크', /개인정보/],
]) {
  const ok = re.test(pay);
  if (!ok) failures.push({ route: 'paywall', text: `${label} 없음` });
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${label}`);
}
// 스토어 가격이 실제로 내려오는지 — 가격 문자열이 있어야 한다.
const hasPrice = /[₩$]\s?[\d,]+/.test(pay);
if (!hasPrice) failures.push({ route: 'paywall', text: '가격 문자열이 보이지 않는다' });
console.log(`   ${hasPrice ? 'OK  ' : 'FAIL'} 가격 표시`);

// 미오픈 기능이 요금제 혜택으로 광고되면 안 된다 — 결제하고도 못 쓰는 항목이 된다.
const advertisesHidden = /부자재|메신저/.test(pay);
if (advertisesHidden) failures.push({ route: 'paywall', text: '미오픈 기능이 혜택으로 노출된다' });
console.log(`   ${advertisesHidden ? 'FAIL' : 'OK  '} 미오픈 기능 비노출`);

// ── logcat 검사 ─────────────────────────────────────────
console.log('\n— 로그 검사');
const log = adb(['logcat', '-d', '-v', 'brief', '-t', '4000']);
const patterns = [
  [/FATAL EXCEPTION/, '네이티브 크래시'],
  [/\[ErrorBoundary\] caught/, 'ErrorBoundary'],
  [/E ReactNativeJS/, 'JS 에러'],
  [/Error: Unable to resolve module/, '모듈 해석 실패'],
];
const IGNORED = [/RevenueCat/i, /\[purchases\]/i, /GoogleMobileAds|admob/i, /BillingClient/i];
for (const [re, label] of patterns) {
  const hits = log
    .split('\n')
    .filter((l) => re.test(l))
    .filter((l) => !IGNORED.some((ig) => ig.test(l)));
  if (hits.length) {
    for (const h of hits.slice(0, 6)) failures.push({ route: 'logcat', text: `${label}: ${h.trim().slice(0, 220)}` });
    console.log(`   FAIL ${label} ${hits.length}건`);
  } else {
    console.log(`   OK   ${label} 없음`);
  }
}

if (!KEEP) {
  adb(['shell', 'am', 'force-stop', PKG]);
}

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`실패 ${failures.length}건\n`);
  for (const f of failures) console.log(`[${f.route}] ${f.text}\n`);
  process.exit(1);
}
console.log('✅ 크래시 0 · JS 에러 0 · 모든 화면 진입 확인');
