/**
 * iOS 심사 제출 — App Store Connect API.
 *
 * `eas submit` 은 바이너리 업로드까지만 한다. 심사 제출은 ASC API 로 해야 해서
 * 이 스크립트가 버전 생성 → 빌드 연결 → 릴리스 노트 → 심사 제출까지 한 번에 한다.
 *
 *   node scripts/asc-submit.mjs --version 1.0.10 --build 23            # 확인만 (dry-run)
 *   node scripts/asc-submit.mjs --version 1.0.10 --build 23 --apply    # 실제 제출
 *   node scripts/asc-submit.mjs --version 1.0.10 --build 23 --notes-file notes.txt --apply
 *
 * 종료 코드: 0 정상 / 10 이전 버전이 심사 중이라 대기 / 20 이전 버전 반려 — 사람 확인 필요 / 1 오류
 *
 * 안전장치
 * - 직전 버전이 심사 중이면 Apple 이 새 버전 생성을 막는다(409). 시도하지 않고 10 으로 끝낸다.
 * - 직전 버전이 반려 상태면 자동 제출하지 않는다. 같은 사유가 새 버전에도 남아 있을 수 있다.
 *
 * 반려 후 재제출 시 주의 — 반려된 reviewSubmission 이 UNRESOLVED_ISSUES 로 그 버전을
 * 잡고 있어 `PATCH /reviewSubmissions/{옛id} {canceled:true}` 로 먼저 취소해야 한다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const ASC = {
  app: '6773212200',
  keyPath: 'C:/Users/1/.secrets/AuthKey_8NLQSUV7S8.p8',
  keyId: '8NLQSUV7S8',
  issuerId: '30c36f70-5d09-4b93-8fb0-4bb0e9e8c13c',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const VERSION = arg('version');
const BUILD = arg('build');
const NOTES_FILE = arg('notes-file');
const APPLY = process.argv.includes('--apply');

if (!VERSION || !BUILD) {
  console.error('사용법: node scripts/asc-submit.mjs --version 1.0.10 --build 23 [--notes-file notes.txt] [--apply]');
  process.exit(1);
}

const WHATS_NEW = NOTES_FILE ? fs.readFileSync(NOTES_FILE, 'utf8').trim() : null;

// 심사가 진행 중인 상태 — 새 버전을 만들 수 없다
const BUSY = new Set([
  'WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE',
  'PROCESSING_FOR_APP_STORE', 'PENDING_DEVELOPER_RELEASE_PREPARING',
]);
// 개발자 조치가 필요한 상태 — 자동 진행 금지
const NEEDS_HUMAN = new Set([
  'REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED',
  'INVALID_BINARY', 'DEVELOPER_REMOVED_FROM_SALE',
]);

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function bearer() {
  const key = fs.readFileSync(ASC.keyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    `${b64({ alg: 'ES256', kid: ASC.keyId, typ: 'JWT' })}.` +
    `${b64({ iss: ASC.issuerId, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' })}`;
  const sig = crypto.sign('SHA256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${sig.toString('base64url')}`;
}

async function api(path, init) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { authorization: `Bearer ${bearer()}`, 'content-type': 'application/json' },
    ...init,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (json.errors) throw new Error(json.errors.map((e) => `${e.code} ${e.detail ?? e.title}`).join(' | '));
  return json;
}

async function main() {
  // 컬렉션은 앱 하위 경로로만 조회된다 (/v1/appStoreVersions 는 GET_COLLECTION 불가)
  const vers = await api(
    `/v1/apps/${ASC.app}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState`,
  );
  const list = (vers.data ?? []).map((d) => ({
    id: d.id,
    v: d.attributes.versionString,
    s: d.attributes.appStoreState,
  }));
  console.log('현재 버전 상태:');
  list.forEach((x) => console.log(`  ${x.v.padEnd(8)} ${x.s}`));

  if (list.some((x) => x.v === VERSION)) {
    console.log(`\n${VERSION} 버전 레코드가 이미 있다. 콘솔에서 확인할 것.`);
    return 0;
  }
  const blocking = list.find((x) => BUSY.has(x.s));
  if (blocking) {
    console.log(`\n대기: ${blocking.v} 가 ${blocking.s} — 아직 새 버전을 만들 수 없다.`);
    return 10;
  }
  const rejected = list.find((x) => NEEDS_HUMAN.has(x.s));
  if (rejected) {
    console.log(`\n중단: ${rejected.v} 가 ${rejected.s} 다. 같은 사유가 ${VERSION} 에도 남아 있을 수 있어 자동 제출하지 않는다.`);
    return 20;
  }
  if (!APPLY) {
    console.log('\n제출 가능 상태. 실제 실행은 --apply 로.');
    return 0;
  }

  console.log(`\n[1/4] ${VERSION} 버전 생성`);
  const created = await api('/v1/appStoreVersions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: VERSION, releaseType: 'AFTER_APPROVAL' },
        relationships: { app: { data: { type: 'apps', id: ASC.app } } },
      },
    }),
  });
  const versionId = created.data.id;
  console.log('   versionId:', versionId);

  console.log(`[2/4] build ${BUILD} 연결`);
  const builds = await api(
    `/v1/builds?filter[app]=${ASC.app}&filter[version]=${BUILD}&limit=1&fields[builds]=version,processingState`,
  );
  const build = builds.data?.[0];
  if (!build) throw new Error(`build ${BUILD} 를 찾을 수 없다`);
  if (build.attributes.processingState !== 'VALID') {
    throw new Error(`build 처리 미완료: ${build.attributes.processingState} (보통 업로드 후 5~10분)`);
  }
  await api(`/v1/appStoreVersions/${versionId}/relationships/build`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'builds', id: build.id } }),
  });
  console.log('   연결 완료:', build.id);

  if (WHATS_NEW) {
    console.log('[3/4] 릴리스 노트 입력');
    const locs = await api(
      `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50&fields[appStoreVersionLocalizations]=locale`,
    );
    for (const loc of locs.data ?? []) {
      await api(`/v1/appStoreVersionLocalizations/${loc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: WHATS_NEW } },
        }),
      });
      console.log('   ', loc.attributes.locale, 'OK');
    }
  } else {
    console.log('[3/4] 릴리스 노트 생략 (--notes-file 미지정)');
  }

  console.log('[4/4] 심사 제출');
  const rs = await api('/v1/reviewSubmissions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: ASC.app } } },
      },
    }),
  });
  const rsId = rs.data.id;
  await api('/v1/reviewSubmissionItems', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: rsId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    }),
  });
  const done = await api(`/v1/reviewSubmissions/${rsId}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'reviewSubmissions', id: rsId, attributes: { submitted: true } } }),
  });
  console.log('   제출 상태:', done.data?.attributes?.state, '(WAITING_FOR_REVIEW 면 제출 완료)');
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('실패:', e.message); process.exitCode = 1; });
