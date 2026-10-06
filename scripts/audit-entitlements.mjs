/**
 * 운영 entitlement 전수 점검 — 판정 로직 변경이 기존 회원을 깨뜨리지 않았는지 확인한다.
 *
 *   gcloud auth login            # 최초 1회
 *   node scripts/audit-entitlements.mjs
 *
 * 왜 필요한가:
 *   isActivePremium 의 불변식을 바꿨다. 예전에는 `expiresAt == null` 을 영구 권한으로 봤고,
 *   지금은 `grandfathered` 만 영구 신호다. 그래서
 *     plan='premium' · grandfathered=false · expiresAt=null
 *   상태로 저장된 문서가 있으면 그 회원은 이번 변경으로 프리미엄을 잃는다.
 *   이론상 발생 가능한 조합이므로 실제 데이터로 확인해야 한다.
 *
 * 쓰기는 하지 않는다. 조회 전용.
 */
import { execSync } from 'node:child_process';

const PROJECT = 'dongdaemoon-vscode';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
if (!token) throw new Error('gcloud 액세스 토큰을 얻지 못했다. `gcloud auth login` 먼저.');

async function get(url) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Firestore REST 의 typed value → JS 값. */
function val(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  return undefined;
}

function fields(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc.fields ?? {})) out[k] = val(v);
  return out;
}

// 1) 전체 회원 uid 수집
const uids = [];
let pageToken = '';
do {
  const url = `${BASE}/users?pageSize=300&mask.fieldPaths=email${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const page = await get(url);
  for (const d of page.documents ?? []) uids.push(d.name.split('/').pop());
  pageToken = page.nextPageToken ?? '';
} while (pageToken);

console.log(`회원 ${uids.length}명 조회\n`);

// 2) 각 회원의 entitlement 를 묶어서 읽기 (batchGet, 100건씩)
const docs = new Map();
for (let i = 0; i < uids.length; i += 100) {
  const chunk = uids.slice(i, i + 100);
  const res = await fetch(`${BASE}:batchGet`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      documents: chunk.map(
        (u) => `projects/${PROJECT}/databases/(default)/documents/users/${u}/meta/entitlement`,
      ),
    }),
  });
  if (!res.ok) throw new Error(`batchGet HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  for (const line of await res.json()) {
    if (!line.found) continue;
    const uid = line.found.name.split('/')[line.found.name.split('/').length - 3];
    docs.set(uid, fields(line.found));
  }
}

// 3) 분류
const now = Date.now();
const buckets = {
  free: [],
  permanent: [],          // grandfathered=true — 영구 (평생/프로모/운영자)
  timedActive: [],        // 기간제 유효
  expired: [],            // 기간제 만료
  BROKEN_nullExpiry: [],  // premium 인데 영구 신호도 만료일도 없음 ← 이번 변경의 위험군
  sandbox: [],
};

for (const [uid, e] of docs) {
  if (e.environment === 'SANDBOX') buckets.sandbox.push(uid);
  if (e.plan !== 'premium') {
    buckets.free.push(uid);
    continue;
  }
  if (e.grandfathered === true) {
    buckets.permanent.push({ uid, source: e.source });
    continue;
  }
  if (typeof e.expiresAt !== 'number') {
    buckets.BROKEN_nullExpiry.push({ uid, source: e.source, productId: e.productId });
    continue;
  }
  (e.expiresAt > now ? buckets.timedActive : buckets.expired).push({
    uid,
    source: e.source,
    expiresAt: new Date(e.expiresAt).toISOString().slice(0, 10),
  });
}

const noDoc = uids.filter((u) => !docs.has(u));

console.log('entitlement 문서 없음 :', noDoc.length, '(첫 진입 시 free 로 생성됨)');
console.log('무료                  :', buckets.free.length);
console.log('영구 프리미엄         :', buckets.permanent.length,
  buckets.permanent.length ? `— ${buckets.permanent.map((x) => x.source).join(',')}` : '');
console.log('기간제 유효           :', buckets.timedActive.length);
console.log('기간제 만료           :', buckets.expired.length);
console.log('샌드박스 결제         :', buckets.sandbox.length);
console.log('');

if (buckets.BROKEN_nullExpiry.length) {
  console.log('⚠ 위험 — premium 인데 영구 신호도 만료일도 없음 (이번 변경으로 권한 상실):');
  for (const b of buckets.BROKEN_nullExpiry) {
    console.log(`   ${b.uid}  source=${b.source}  product=${b.productId ?? '-'}`);
  }
  console.log('\n   조치: 해당 계정이 앱을 켜면 syncEntitlement 가 RC 기준으로 복구한다.');
  console.log('   RC 에도 없는 수동 부여였다면 운영자 콘솔에서 다시 부여해야 한다.');
  process.exitCode = 1;
} else {
  console.log('✅ 위험군 0건 — 판정 로직 변경으로 권한을 잃는 회원은 없다.');
}
