/**
 * 스토어 상품 설정 점검 — Google Play + App Store Connect 를 직접 조회해 앱이 광고하는 내용과 대조한다.
 *
 *   node scripts/check-store-products.mjs
 *   node scripts/check-store-products.mjs --json
 *
 * 왜 필요한가:
 *   앱 코드가 아무리 맞아도 스토어 콘솔의 칸 하나가 틀리면 돈이 잘못 빠진다.
 *   (연간 상품의 청구 주기가 P1M 으로 등록돼 매달 청구된 실제 사고 사례가 있다)
 *   코드 검사로는 절대 잡히지 않는 종류라, 빌드 전에 이 스크립트를 돌린다.
 *
 * 검사 항목:
 *   1. 월간 상품의 청구 주기가 정말 1개월인가 (Play P1M / ASC ONE_MONTH)
 *   2. 평생 상품이 자동 갱신이 아닌 1회 결제 상품인가 (ASC NON_CONSUMABLE / Play one-time)
 *   3. 두 스토어에 상품이 모두 존재하는가 (한쪽에만 있으면 그 OS 에선 구매 불가)
 *   4. 한국 가격이 앱이 표시하는 기본값과 같은가
 *   5. 판매 지역이 한국 하나뿐은 아닌가 (다국어 앱인데 해외에서 구매 불가해진다)
 *
 * 자격 증명 (둘 다 ~/.secrets):
 *   ddm-sherpa-play-service-account.json   — Play Android Publisher
 *   AuthKey_8NLQSUV7S8.p8                  — App Store Connect API
 *
 * 종료 코드: 0 통과 / 1 실패(FAIL 1건 이상) / 2 조회 불가
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PKG = 'com.ddmsherpa.app';
const ASC_APP_ID = '6773212200';
const ASC_KEY_ID = '8NLQSUV7S8';
const ASC_ISSUER_ID = '30c36f70-5d09-4b93-8fb0-4bb0e9e8c13c';

const SECRETS = path.join(os.homedir(), '.secrets');
const PLAY_KEY = path.join(SECRETS, 'ddm-sherpa-play-service-account.json');
const ASC_KEY = path.join(SECRETS, `AuthKey_${ASC_KEY_ID}.p8`);

// 앱이 기대하는 값 — app.json extra.revenueCat / paywall 의 fallback 과 일치해야 한다.
const EXPECT = {
  monthly: { productId: 'premium_monthly', playPeriod: 'P1M', ascPeriod: 'ONE_MONTH', krw: 3900 },
  lifetime: { productId: 'premium_lifetime', krw: 39000 },
};

const JSON_OUT = process.argv.includes('--json');
const results = [];
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function record(level, area, message) {
  results.push({ level, area, message });
}
const pass = (area, m) => record('PASS', area, m);
const fail = (area, m) => record('FAIL', area, m);
const warn = (area, m) => record('WARN', area, m);
const skip = (area, m) => record('SKIP', area, m);

// ─────────────────────────────── Google Play ───────────────────────────────

async function playToken(sa) {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64u({ alg: 'RS256', typ: 'JWT' });
  const claim = b64u({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  });
  const sig = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claim}`)
    .sign(sa.private_key)
    .toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${sig}`,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Play token failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function playGet(token, suffix) {
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}${suffix}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* HTML 오류 페이지 등 */
  }
  return { status: res.status, body };
}

async function checkPlay() {
  if (!fs.existsSync(PLAY_KEY)) {
    skip('Play', `서비스 계정 키 없음: ${PLAY_KEY}`);
    return;
  }
  const sa = JSON.parse(fs.readFileSync(PLAY_KEY, 'utf8'));
  const token = await playToken(sa);

  const subs = await playGet(token, '/subscriptions?pageSize=50');
  if (subs.status !== 200) {
    fail('Play', `구독 상품 조회 실패 (HTTP ${subs.status})`);
    return;
  }
  const list = subs.body?.subscriptions ?? [];
  const monthly = list.find((s) => s.productId === EXPECT.monthly.productId);

  if (!monthly) {
    fail('Play', `${EXPECT.monthly.productId} 구독 상품이 없다 — 안드로이드에서 구독 불가`);
  } else {
    const active = (monthly.basePlans ?? []).filter((bp) => bp.state === 'ACTIVE');
    if (!active.length) {
      fail('Play', `${EXPECT.monthly.productId}: 활성 기본 플랜이 없다`);
    }
    for (const bp of active) {
      const period = bp.autoRenewingBasePlanType?.billingPeriodDuration;
      if (!bp.autoRenewingBasePlanType) {
        warn('Play', `${monthly.productId}/${bp.basePlanId}: 자동갱신 플랜이 아니다(선불제)`);
      } else if (period !== EXPECT.monthly.playPeriod) {
        // 바로 이 칸이 틀려서 "연간" 상품이 매달 청구된 사고가 있었다.
        fail(
          'Play',
          `${monthly.productId}/${bp.basePlanId}: 청구 주기가 ${period} — ${EXPECT.monthly.playPeriod} 이어야 한다`,
        );
      } else {
        pass('Play', `${monthly.productId}/${bp.basePlanId}: 청구 주기 ${period}`);
      }

      const regions = bp.regionalConfigs ?? [];
      const kr = regions.find((r) => r.regionCode === 'KR');
      if (!kr) {
        fail('Play', `${monthly.productId}/${bp.basePlanId}: 한국 가격 미설정`);
      } else {
        const units = Number(kr.price?.units ?? 0);
        if (units !== EXPECT.monthly.krw) {
          fail(
            'Play',
            `${monthly.productId}/${bp.basePlanId}: 한국 가격 ${units}${kr.price?.currencyCode ?? ''} — 앱 표시 ${EXPECT.monthly.krw} 와 다르다`,
          );
        } else {
          pass('Play', `${monthly.productId}/${bp.basePlanId}: 한국 가격 ${units} KRW`);
        }
      }
      if (regions.length <= 1) {
        warn(
          'Play',
          `${monthly.productId}/${bp.basePlanId}: 판매 지역이 ${regions.length}개뿐 — 해외 사용자는 구독할 수 없다`,
        );
      }

      // 활성 오퍼(무료 체험/할인) 는 앱이 고지하지 않으면 사용자가 모르는 조건이 된다.
      const offers = await playGet(
        token,
        `/subscriptions/${monthly.productId}/basePlans/${bp.basePlanId}/offers?pageSize=50`,
      );
      for (const of_ of offers.body?.subscriptionOffers ?? []) {
        if (of_.state === 'ACTIVE') {
          warn(
            'Play',
            `${monthly.productId}/${bp.basePlanId}: 활성 오퍼 "${of_.offerId}" — 앱 페이월이 이 조건을 고지하는지 확인`,
          );
        }
      }
    }
  }

  // 평생 상품 — 1회 결제(one-time) 로 등록돼 있어야 한다.
  if (list.some((s) => s.productId === EXPECT.lifetime.productId)) {
    fail(
      'Play',
      `${EXPECT.lifetime.productId} 가 **구독**으로 등록돼 있다 — 평생 상품이 자동 갱신된다`,
    );
  }
  const oneTime = await playGet(token, '/oneTimeProducts?pageSize=50');
  if (oneTime.status === 200) {
    const items = oneTime.body?.oneTimeProducts ?? [];
    const life = items.find((p) => p.productId === EXPECT.lifetime.productId);
    if (!life) {
      fail(
        'Play',
        `${EXPECT.lifetime.productId} 1회 결제 상품이 없다 — 안드로이드에서 평생 요금제 구매 불가`,
      );
    } else {
      const active = (life.purchaseOptions ?? []).filter((o) => o.state === 'ACTIVE');
      if (!active.length) {
        fail('Play', `${EXPECT.lifetime.productId}: 활성 구매 옵션이 없다`);
      }
      for (const opt of active) {
        const regions = opt.regionalPricingAndAvailabilityConfigs ?? [];
        const kr = regions.find((r) => r.regionCode === 'KR');
        if (!kr || kr.availability !== 'AVAILABLE') {
          fail('Play', `${EXPECT.lifetime.productId}/${opt.purchaseOptionId}: 한국에서 판매 불가 상태`);
        } else if (Number(kr.price?.units ?? 0) !== EXPECT.lifetime.krw) {
          fail(
            'Play',
            `${EXPECT.lifetime.productId}/${opt.purchaseOptionId}: 한국 가격 ${kr.price?.units} — 앱 표시 ${EXPECT.lifetime.krw} 와 다르다`,
          );
        } else {
          pass(
            'Play',
            `${EXPECT.lifetime.productId}/${opt.purchaseOptionId}: 1회 결제 · 한국 ${kr.price.units} KRW`,
          );
        }
        if (regions.length <= 1) {
          warn(
            'Play',
            `${EXPECT.lifetime.productId}/${opt.purchaseOptionId}: 판매 지역이 ${regions.length}개뿐 — 해외 사용자는 구매할 수 없다`,
          );
        }
      }
    }
  } else {
    warn('Play', `1회 결제 상품 조회 불가 (HTTP ${oneTime.status}) — 콘솔에서 수동 확인 필요`);
  }
}

// ──────────────────────────── App Store Connect ────────────────────────────

function ascToken() {
  const key = fs.readFileSync(ASC_KEY, 'utf8');
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

async function ascGet(token, suffix) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${suffix}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 비 JSON 응답 */
  }
  return { status: res.status, body };
}

async function checkAsc() {
  if (!fs.existsSync(ASC_KEY)) {
    skip('ASC', `API 키 없음: ${ASC_KEY}`);
    return;
  }
  const token = ascToken();

  const groups = await ascGet(
    token,
    `/v1/apps/${ASC_APP_ID}/subscriptionGroups?include=subscriptions&limit=20`,
  );
  if (groups.status !== 200) {
    fail('ASC', `구독 그룹 조회 실패 (HTTP ${groups.status})`);
    return;
  }
  const subs = (groups.body?.included ?? []).filter((x) => x.type === 'subscriptions');
  const monthly = subs.find((s) => s.attributes?.productId === EXPECT.monthly.productId);

  if (!monthly) {
    fail('ASC', `${EXPECT.monthly.productId} 구독 상품이 없다 — iOS 에서 구독 불가`);
  } else {
    const period = monthly.attributes?.subscriptionPeriod;
    if (period !== EXPECT.monthly.ascPeriod) {
      fail(
        'ASC',
        `${EXPECT.monthly.productId}: 청구 주기가 ${period} — ${EXPECT.monthly.ascPeriod} 이어야 한다`,
      );
    } else {
      pass('ASC', `${EXPECT.monthly.productId}: 청구 주기 ${period}`);
    }
    if (monthly.attributes?.state !== 'APPROVED') {
      warn('ASC', `${EXPECT.monthly.productId}: 상태가 ${monthly.attributes?.state}`);
    }

    const prices = await ascGet(
      token,
      `/v1/subscriptions/${monthly.id}/prices?include=subscriptionPricePoint,territory&filter[territory]=KOR&limit=10`,
    );
    const pts = Object.fromEntries(
      (prices.body?.included ?? [])
        .filter((x) => x.type === 'subscriptionPricePoints')
        .map((x) => [x.id, x.attributes?.customerPrice]),
    );
    const krRow = (prices.body?.data ?? [])[0];
    const krPrice = krRow ? Number(pts[krRow.relationships?.subscriptionPricePoint?.data?.id]) : NaN;
    if (!Number.isFinite(krPrice)) {
      warn('ASC', `${EXPECT.monthly.productId}: 한국 가격을 읽지 못했다`);
    } else if (krPrice !== EXPECT.monthly.krw) {
      fail(
        'ASC',
        `${EXPECT.monthly.productId}: 한국 가격 ${krPrice} — 앱 표시 ${EXPECT.monthly.krw} 와 다르다`,
      );
    } else {
      pass('ASC', `${EXPECT.monthly.productId}: 한국 가격 ${krPrice} KRW`);
    }

    const intro = await ascGet(token, `/v1/subscriptions/${monthly.id}/introductoryOffers?limit=20`);
    for (const o of intro.body?.data ?? []) {
      warn(
        'ASC',
        `${EXPECT.monthly.productId}: 체험/할인 오퍼 등록됨 (${o.attributes?.offerMode} ${o.attributes?.duration}) — 페이월 고지 확인`,
      );
    }
  }

  const iaps = await ascGet(token, `/v1/apps/${ASC_APP_ID}/inAppPurchasesV2?limit=50`);
  const life = (iaps.body?.data ?? []).find(
    (x) => x.attributes?.productId === EXPECT.lifetime.productId,
  );
  if (!life) {
    fail('ASC', `${EXPECT.lifetime.productId} 1회 결제 상품이 없다 — iOS 에서 평생 요금제 구매 불가`);
  } else {
    const type = life.attributes?.inAppPurchaseType;
    if (type !== 'NON_CONSUMABLE') {
      fail('ASC', `${EXPECT.lifetime.productId}: 유형이 ${type} — NON_CONSUMABLE 이어야 한다`);
    } else {
      pass('ASC', `${EXPECT.lifetime.productId}: NON_CONSUMABLE (1회 결제)`);
    }

    const mp = await ascGet(
      token,
      `/v1/inAppPurchasePriceSchedules/${life.id}/manualPrices?include=inAppPurchasePricePoint,territory&limit=200`,
    );
    const pts = Object.fromEntries(
      (mp.body?.included ?? [])
        .filter((x) => x.type === 'inAppPurchasePricePoints')
        .map((x) => [x.id, x.attributes?.customerPrice]),
    );
    const kr = (mp.body?.data ?? []).find(
      (r) => r.relationships?.territory?.data?.id === 'KOR',
    );
    const krPrice = kr ? Number(pts[kr.relationships?.inAppPurchasePricePoint?.data?.id]) : NaN;
    if (!Number.isFinite(krPrice)) {
      warn('ASC', `${EXPECT.lifetime.productId}: 한국 가격을 읽지 못했다`);
    } else if (krPrice !== EXPECT.lifetime.krw) {
      fail(
        'ASC',
        `${EXPECT.lifetime.productId}: 한국 가격 ${krPrice} — 앱 표시 ${EXPECT.lifetime.krw} 와 다르다`,
      );
    } else {
      pass('ASC', `${EXPECT.lifetime.productId}: 한국 가격 ${krPrice} KRW`);
    }
  }
}

// ─────────────────────────────────── 실행 ───────────────────────────────────

let hardError = null;
for (const [name, fn] of [
  ['Play', checkPlay],
  ['ASC', checkAsc],
]) {
  try {
    await fn();
  } catch (err) {
    hardError = err;
    fail(name, `점검 중 오류: ${err.message}`);
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ results }, null, 2));
} else {
  const icon = { PASS: '  OK  ', FAIL: ' FAIL ', WARN: ' WARN ', SKIP: ' SKIP ' };
  console.log('\n스토어 상품 설정 점검\n' + '─'.repeat(68));
  for (const r of results) {
    console.log(`[${icon[r.level]}] ${r.area.padEnd(5)} ${r.message}`);
  }
  console.log('─'.repeat(68));
}

const fails = results.filter((r) => r.level === 'FAIL').length;
const warns = results.filter((r) => r.level === 'WARN').length;
if (!JSON_OUT) {
  console.log(`실패 ${fails} · 경고 ${warns} · 통과 ${results.filter((r) => r.level === 'PASS').length}\n`);
}
if (fails) process.exit(1);
if (hardError && !results.some((r) => r.level === 'PASS')) process.exit(2);
