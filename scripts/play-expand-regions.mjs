/**
 * Play 상품의 판매 지역 확장 — **App Store 에 설정된 지역별 가격과 같은 금액**을 Play 에 넣는다.
 *
 *   node scripts/play-expand-regions.mjs            # 미리보기 (아무것도 바꾸지 않음)
 *   node scripts/play-expand-regions.mjs --apply    # 실제 반영
 *
 * 왜 iOS 기준인가:
 *   Google 권장 환산가(₩3,900 → $2.89) 는 Apple 가격($1.99) 보다 비싸다.
 *   같은 앱이 스토어마다 다른 값을 받으면 그대로 문의·불만이 된다. 두 스토어를 같은 금액으로 맞춘다.
 *   Apple 가격을 못 찾거나 통화가 다른 지역만 Google 환산가로 떨어진다.
 *
 * 대상:
 *   premium_monthly  (구독)      basePlan monthly-autorenewing
 *   premium_lifetime (1회 결제)  purchaseOption lifetime
 *
 * 안전장치:
 *   - **이미 설정된 지역은 건드리지 않는다.** 기존 구독자 가격 변경 흐름을 유발하지 않기 위해
 *     순수하게 "없던 지역을 추가" 만 한다. 한국 가격은 그대로 유지된다.
 *   - --apply 전에 현재 리소스 전체를 scripts/out/ 에 백업한다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PKG = 'com.ddmsherpa.app';
const ASC_APP_ID = '6773212200';
const ASC_KEY_ID = '8NLQSUV7S8';
const ASC_ISSUER_ID = '30c36f70-5d09-4b93-8fb0-4bb0e9e8c13c';
const APPLY = process.argv.includes('--apply');
const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');

const TARGETS = {
  monthly: { productId: 'premium_monthly', basePlanId: 'monthly-autorenewing', krw: 3900 },
  lifetime: { productId: 'premium_lifetime', purchaseOptionId: 'lifetime', krw: 39000 },
};

/** ISO 3166-1 alpha-3 (App Store Connect) → alpha-2 (Google Play). */
const A3_TO_A2 = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',AIA:'AI',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',
  AUT:'AT',AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',
  BMU:'BM',BTN:'BT',BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',
  KHM:'KH',CMR:'CM',CAN:'CA',CPV:'CV',CYM:'KY',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COG:'CG',
  COD:'CD',CRI:'CR',CIV:'CI',HRV:'HR',CYP:'CY',CZE:'CZ',DNK:'DK',DMA:'DM',DOM:'DO',ECU:'EC',
  EGY:'EG',SLV:'SV',EST:'EE',SWZ:'SZ',ETH:'ET',FJI:'FJ',FIN:'FI',FRA:'FR',GAB:'GA',GMB:'GM',
  GEO:'GE',DEU:'DE',GHA:'GH',GRC:'GR',GRD:'GD',GTM:'GT',GIN:'GN',GNB:'GW',GUY:'GY',HND:'HN',
  HKG:'HK',HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRQ:'IQ',IRL:'IE',ISR:'IL',ITA:'IT',JAM:'JM',
  JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KOR:'KR',KWT:'KW',KGZ:'KG',LAO:'LA',LVA:'LV',LBN:'LB',
  LBR:'LR',LBY:'LY',LIE:'LI',LTU:'LT',LUX:'LU',MAC:'MO',MDG:'MG',MWI:'MW',MYS:'MY',MDV:'MV',
  MLI:'ML',MLT:'MT',MRT:'MR',MUS:'MU',MEX:'MX',FSM:'FM',MDA:'MD',MCO:'MC',MNG:'MN',MNE:'ME',
  MSR:'MS',MAR:'MA',MOZ:'MZ',MMR:'MM',NAM:'NA',NRU:'NR',NPL:'NP',NLD:'NL',NZL:'NZ',NIC:'NI',
  NER:'NE',NGA:'NG',MKD:'MK',NOR:'NO',OMN:'OM',PAK:'PK',PLW:'PW',PSE:'PS',PAN:'PA',PNG:'PG',
  PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',KNA:'KN',
  LCA:'LC',VCT:'VC',WSM:'WS',STP:'ST',SAU:'SA',SEN:'SN',SRB:'RS',SYC:'SC',SLE:'SL',SGP:'SG',
  SVK:'SK',SVN:'SI',SLB:'SB',SOM:'SO',ZAF:'ZA',ESP:'ES',LKA:'LK',SUR:'SR',SWE:'SE',CHE:'CH',
  TWN:'TW',TJK:'TJ',TZA:'TZ',THA:'TH',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',TCA:'TC',
  UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',VNM:'VN',
  VGB:'VG',YEM:'YE',ZMB:'ZM',ZWE:'ZW',BRB2:'BB',GIB:'GI',GGY:'GG',JEY:'JE',IMN:'IM',FRO:'FO',
  GRL:'GL',NCL:'NC',PYF:'PF',REU:'RE',BES:'BQ',CUW:'CW',SXM:'SX',ABW:'AW',ATG2:'AG',
};

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

// ─────────────────────────────── Google Play ───────────────────────────────

async function playToken() {
  const sa = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), '.secrets', 'ddm-sherpa-play-service-account.json'), 'utf8'),
  );
  const iat = Math.floor(Date.now() / 1000);
  const h = b64u({ alg: 'RS256', typ: 'JWT' });
  const c = b64u({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(`${h}.${c}`).sign(sa.private_key).toString('base64url');
  const j = await (
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${h}.${c}.${sig}`,
      }),
    })
  ).json();
  if (!j.access_token) throw new Error(`Play token failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function play(tk, method, suffix, body) {
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}${suffix}`,
    {
      method,
      headers: {
        authorization: `Bearer ${tk}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${suffix} → HTTP ${res.status}: ${text.slice(0, 700)}`);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 한국 가격 → 전 지역 Google 권장 환산가 (지역 목록과 통화의 출처로도 쓴다). */
async function convertRegionPrices(tk, krw) {
  const r = await play(tk, 'POST', '/pricing:convertRegionPrices', {
    price: { currencyCode: 'KRW', units: String(krw), nanos: 0 },
  });
  return r.convertedRegionPrices ?? {};
}

// ──────────────────────────── App Store Connect ────────────────────────────

function ascToken() {
  const key = fs.readFileSync(path.join(os.homedir(), '.secrets', `AuthKey_${ASC_KEY_ID}.p8`), 'utf8');
  const iat = Math.floor(Date.now() / 1000);
  const h = b64u({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' });
  const p = b64u({ iss: ASC_ISSUER_ID, iat, exp: iat + 1200, aud: 'appstoreconnect-v1' });
  const sig = crypto
    .createSign('SHA256')
    .update(`${h}.${p}`)
    .sign({ key, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${h}.${p}.${sig}`;
}

async function asc(tk, suffix) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${suffix}`, {
    headers: { authorization: `Bearer ${tk}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ASC ${suffix} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

/** ASC 응답 → { 'US': {amount, currency}, ... } (alpha-2 키) */
function indexAscPrices(body, pricePointType, pricePointRel) {
  const points = Object.fromEntries(
    (body.included ?? [])
      .filter((x) => x.type === pricePointType)
      .map((x) => [x.id, x.attributes?.customerPrice]),
  );
  const currencies = Object.fromEntries(
    (body.included ?? [])
      .filter((x) => x.type === 'territories')
      .map((x) => [x.id, x.attributes?.currency]),
  );
  const out = {};
  for (const row of body.data ?? []) {
    const a3 = row.relationships?.territory?.data?.id;
    const a2 = A3_TO_A2[a3];
    if (!a2 || out[a2]) continue;
    const amount = Number(points[row.relationships?.[pricePointRel]?.data?.id]);
    const currency = currencies[a3];
    if (!Number.isFinite(amount) || !currency) continue;
    out[a2] = { amount, currency };
  }
  return out;
}

async function ascMonthlyPrices(tk) {
  const groups = await asc(
    tk,
    `/v1/apps/${ASC_APP_ID}/subscriptionGroups?include=subscriptions&limit=20`,
  );
  const sub = (groups.included ?? []).find(
    (x) => x.type === 'subscriptions' && x.attributes?.productId === TARGETS.monthly.productId,
  );
  if (!sub) throw new Error('ASC premium_monthly 없음');
  const body = await asc(
    tk,
    `/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint,territory&limit=200`,
  );
  return indexAscPrices(body, 'subscriptionPricePoints', 'subscriptionPricePoint');
}

async function ascLifetimePrices(tk) {
  const iaps = await asc(tk, `/v1/apps/${ASC_APP_ID}/inAppPurchasesV2?limit=50`);
  const life = (iaps.data ?? []).find(
    (x) => x.attributes?.productId === TARGETS.lifetime.productId,
  );
  if (!life) throw new Error('ASC premium_lifetime 없음');
  // 수동 지정가(기준 지역) + Apple 자동 환산가(나머지 지역) 를 합친다.
  const out = {};
  for (const rel of ['automaticPrices', 'manualPrices']) {
    try {
      const body = await asc(
        tk,
        `/v1/inAppPurchasePriceSchedules/${life.id}/${rel}?include=inAppPurchasePricePoint,territory&limit=200`,
      );
      Object.assign(out, indexAscPrices(body, 'inAppPurchasePricePoints', 'inAppPurchasePricePoint'));
    } catch (err) {
      console.error(`  (ASC ${rel} 조회 실패: ${err.message.slice(0, 120)})`);
    }
  }
  return out;
}

// ─────────────────────────────── 가격 합성 ───────────────────────────────

/** 소수 금액 → Play price {units, nanos}. */
function toPlayPrice(amount, currencyCode) {
  const units = Math.floor(amount);
  const nanos = Math.round((amount - units) * 1e9);
  return { currencyCode, units: String(units), nanos };
}

/**
 * 지역별 최종 가격. Apple 가격이 있고 통화가 Play 와 같으면 그 금액, 아니면 Google 환산가.
 */
function pickPrice(region, googlePrice, applePrices, stats) {
  const apple = applePrices[region];
  if (apple && apple.currency === googlePrice.currencyCode) {
    stats.fromApple++;
    return toPlayPrice(apple.amount, googlePrice.currencyCode);
  }
  stats.fromGoogle++;
  if (apple) stats.currencyMismatch.push(`${region}(${apple.currency}≠${googlePrice.currencyCode})`);
  else stats.noApple.push(region);
  return googlePrice;
}

function fmt(price) {
  const v = Number(price.units ?? 0) + Number(price.nanos ?? 0) / 1e9;
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${price.currencyCode}`;
}

function backup(name, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, `${name}.backup.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

// ─────────────────────────────────── 실행 ───────────────────────────────────

const ptk = await playToken();
const atk = ascToken();
const summary = [];

{
  const t = TARGETS.monthly;
  const applePrices = await ascMonthlyPrices(atk);
  const googlePrices = await convertRegionPrices(ptk, t.krw);
  const sub = await play(ptk, 'GET', `/subscriptions/${t.productId}`);
  const bp = (sub.basePlans ?? []).find((b) => b.basePlanId === t.basePlanId);
  if (!bp) throw new Error(`basePlan ${t.basePlanId} 없음`);

  const existing = new Set((bp.regionalConfigs ?? []).map((r) => r.regionCode));
  const stats = { fromApple: 0, fromGoogle: 0, currencyMismatch: [], noApple: [] };
  const added = [];
  for (const [region, info] of Object.entries(googlePrices)) {
    if (existing.has(region)) continue;
    const price = pickPrice(region, info.price, applePrices, stats);
    added.push({ region, price });
    bp.regionalConfigs.push({ regionCode: region, newSubscriberAvailability: true, price });
  }
  summary.push({ what: `${t.productId}/${t.basePlanId}`, before: existing.size, added, stats });

  if (APPLY && added.length) {
    console.log(`백업: ${backup(t.productId, await play(ptk, 'GET', `/subscriptions/${t.productId}`))}`);
    await play(
      ptk,
      'PATCH',
      `/subscriptions/${t.productId}?updateMask=basePlans&regionsVersion.version=${encodeURIComponent(
        sub.regionsVersion?.version ?? '2026/01',
      )}`,
      sub,
    );
  }
}

{
  const t = TARGETS.lifetime;
  const applePrices = await ascLifetimePrices(atk);
  const googlePrices = await convertRegionPrices(ptk, t.krw);
  const prod = await play(ptk, 'GET', `/oneTimeProducts/${t.productId}`);
  const opt = (prod.purchaseOptions ?? []).find((o) => o.purchaseOptionId === t.purchaseOptionId);
  if (!opt) throw new Error(`purchaseOption ${t.purchaseOptionId} 없음`);

  const existing = new Set((opt.regionalPricingAndAvailabilityConfigs ?? []).map((r) => r.regionCode));
  const stats = { fromApple: 0, fromGoogle: 0, currencyMismatch: [], noApple: [] };
  const added = [];
  for (const [region, info] of Object.entries(googlePrices)) {
    if (existing.has(region)) continue;
    const price = pickPrice(region, info.price, applePrices, stats);
    added.push({ region, price });
    opt.regionalPricingAndAvailabilityConfigs.push({
      regionCode: region,
      price,
      availability: 'AVAILABLE',
    });
  }
  summary.push({ what: `${t.productId}/${t.purchaseOptionId}`, before: existing.size, added, stats });

  if (APPLY && added.length) {
    console.log(`백업: ${backup(t.productId, await play(ptk, 'GET', `/oneTimeProducts/${t.productId}`))}`);
    // 1회 결제 상품은 PATCH 라우트가 없다 — batchUpdate 가 유일한 쓰기 경로다.
    await play(ptk, 'POST', '/oneTimeProducts:batchUpdate', {
      requests: [
        {
          oneTimeProduct: prod,
          updateMask: 'purchaseOptions',
          regionsVersion: { version: prod.regionsVersion?.version ?? '2026/01' },
        },
      ],
    });
  }
}

console.log(`\n${APPLY ? '반영 결과' : '미리보기 (--apply 없이는 아무것도 바꾸지 않음)'}`);
console.log('─'.repeat(66));
const SAMPLES = ['US', 'JP', 'CN', 'GB', 'VN', 'TH', 'ID', 'IN', 'TW', 'HK'];
for (const s of summary) {
  console.log(`\n${s.what}: 기존 ${s.before}개 → ${s.added.length}개 추가`);
  console.log(`  가격 출처 — Apple 동일가 ${s.stats.fromApple} · Google 환산가 ${s.stats.fromGoogle}`);
  if (s.stats.noApple.length) {
    console.log(`  Apple 미설정 지역: ${s.stats.noApple.join(',')}`);
  }
  if (s.stats.currencyMismatch.length) {
    console.log(`  통화 불일치(환산가 사용): ${s.stats.currencyMismatch.join(',')}`);
  }
  for (const r of s.added.filter((x) => SAMPLES.includes(x.region))) {
    console.log(`   ${r.region}: ${fmt(r.price)}`);
  }
}
console.log('\n' + '─'.repeat(66));
if (!APPLY) console.log('실제 반영: node scripts/play-expand-regions.mjs --apply\n');
