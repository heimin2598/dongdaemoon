/**
 * Play Console 출시 노트 등록 — 업로드된 versionCode 에 한국어 릴리스 노트를 붙인다.
 *
 *   node scripts/play-release-notes.mjs --code 36 --file release-notes-1.0.11.txt
 *   node scripts/play-release-notes.mjs --code 36 --file notes.txt --track production --apply
 *
 * eas submit 은 바이너리만 올린다. 노트를 넣지 않으면 "변경사항 없음" 으로 나가서
 * 사용자가 무엇이 바뀌었는지 알 수 없다.
 *
 * --apply 없이는 현재 트랙 상태만 보여주고 아무것도 바꾸지 않는다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PKG = 'com.ddmsherpa.app';
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const CODE = Number(arg('code'));
const FILE = arg('file');
const TRACK = arg('track', 'production');
const APPLY = process.argv.includes('--apply');

if (!CODE || !FILE) {
  console.error('사용법: node scripts/play-release-notes.mjs --code <versionCode> --file <notes.txt> [--track production] [--apply]');
  process.exit(1);
}
const NOTES = fs.readFileSync(FILE, 'utf8').trim();
if (NOTES.length > 500) {
  console.error(`출시 노트가 ${NOTES.length}자다. Play 상한은 500자.`);
  process.exit(1);
}

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
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
const tj = await (
  await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${h}.${c}.${sig}`,
    }),
  })
).json();
const TK = tj.access_token;
if (!TK) throw new Error(`토큰 실패: ${JSON.stringify(tj).slice(0, 200)}`);

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
async function api(method, suffix, body) {
  const res = await fetch(`${BASE}${suffix}`, {
    method,
    headers: { authorization: `Bearer ${TK}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${suffix} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const edit = await api('POST', '/edits');
try {
  const track = await api('GET', `/edits/${edit.id}/tracks/${TRACK}`);
  const releases = track.releases ?? [];
  const target = releases.find((r) => (r.versionCodes ?? []).map(Number).includes(CODE));

  console.log(`트랙 ${TRACK} 현재 릴리스:`);
  for (const r of releases) {
    console.log(`  versionCodes=${(r.versionCodes ?? []).join(',')} status=${r.status} notes=${(r.releaseNotes ?? []).length}개 언어`);
  }

  if (!target) {
    console.error(`\nversionCode ${CODE} 가 이 트랙에 없다. 업로드가 끝났는지 확인해라.`);
    process.exit(1);
  }

  if (!APPLY) {
    console.log(`\n미리보기 — versionCode ${CODE} 에 붙일 노트 (${NOTES.length}자):\n`);
    console.log(NOTES);
    console.log('\n실제 반영: --apply');
    process.exit(0);
  }

  target.releaseNotes = [{ language: 'ko-KR', text: NOTES }];
  await api('PUT', `/edits/${edit.id}/tracks/${TRACK}`, { track: TRACK, releases });
  await api('POST', `/edits/${edit.id}:commit`);
  console.log(`\n✅ versionCode ${CODE} 에 한국어 출시 노트 등록 완료`);
} catch (err) {
  await api('DELETE', `/edits/${edit.id}`).catch(() => {});
  throw err;
}
