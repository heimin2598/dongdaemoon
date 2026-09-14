/**
 * 외부 이미지 URL 프록시 — ddm-mall.com 같이 핫링크 차단된 외부 호스트의 이미지를
 * weserv.nl(무료 Cloudflare CDN 프록시) 를 통해 가져오기 위한 헬퍼.
 *
 * Firebase Storage / data URI / 이미 프록시된 URL 은 통과시킴.
 */

const WESERV = 'https://images.weserv.nl/';

interface ProxyOpts {
  /** 너비(px) — 지정 시 weserv 가 서버 측에서 리사이즈해 줌. */
  w?: number;
  /** 높이(px). */
  h?: number;
  /** JPEG 품질 1~100. */
  q?: number;
  /** fit 모드. cover/contain/inside 등. */
  fit?: 'cover' | 'contain' | 'inside' | 'fill';
}

export function proxyImage(url: string | undefined | null, opts?: ProxyOpts): string {
  if (!url) return '';
  // 이미 프록시된 URL, Firebase Storage, data URI, 로컬 파일은 그대로.
  if (
    url.startsWith('data:') ||
    url.startsWith('file:') ||
    url.includes('images.weserv.nl') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('firebasestorage.app')
  ) {
    return url;
  }
  const cleanUrl = url.replace(/^https?:\/\//, '');
  const params: string[] = [`url=${encodeURIComponent(cleanUrl)}`];
  if (opts?.w) params.push(`w=${opts.w}`);
  if (opts?.h) params.push(`h=${opts.h}`);
  if (opts?.q) params.push(`q=${opts.q}`);
  if (opts?.fit) params.push(`fit=${opts.fit}`);
  return `${WESERV}?${params.join('&')}`;
}
