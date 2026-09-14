/**
 * Claude Design 번들 HTML 의 <image-slot> placeholder 를 실제 스크린샷으로 교체.
 * </body> 앞에 script 를 주입해 렌더 후 실행됨. idempotent.
 *
 * 모든 스타일은 인라인으로 세팅 — 외부 CSS 특이도 문제 회피.
 */
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, 'index.html');
const MARKER_START = '<!-- heimin-injection:start -->';
const MARKER_END = '<!-- heimin-injection:end -->';

const INJECT = `${MARKER_START}
<script id="__heimin_shots_script__">
(function() {
  var IMAGES = {
    'shot-stockradar': { src: '/images/stockradar.png', alt: 'StockRadar 앱 스크린샷' },
    'shot-bifix': { src: '/images/bifix.jpg', alt: 'BIFIX 앱 스크린샷' },
    'shot-sherpa': { src: '/images/sherpa.png', alt: '동대문 셰르파 앱 스크린샷' }
  };
  var WRAP_STYLE = [
    'width:calc(100% - 52px)',
    'height:360px',
    'margin:0 26px 22px',
    'background:linear-gradient(180deg, #FAFAFA 0%, #EDEDED 100%)',
    'border:1px solid #E6E6E6',
    'border-radius:12px',
    'overflow:hidden',
    'position:relative',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:20px 0',
    'box-sizing:border-box'
  ].join(';');
  var IMG_STYLE = [
    'max-height:100%',
    'max-width:170px',
    'width:auto',
    'height:auto',
    'object-fit:contain',
    'border-radius:14px',
    'display:block',
    'box-shadow:0 14px 36px -12px rgba(0,0,0,0.32)'
  ].join(';');

  function replace(id, cfg) {
    var el = document.getElementById(id);
    if (!el) return false;
    if (el.getAttribute('data-heimin-replaced') === '1') return true;
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.setAttribute('data-heimin-replaced', '1');
    wrap.setAttribute('style', WRAP_STYLE);
    var img = document.createElement('img');
    img.src = cfg.src;
    img.alt = cfg.alt;
    img.loading = 'lazy';
    img.setAttribute('style', IMG_STYLE);
    wrap.appendChild(img);
    el.parentNode.replaceChild(wrap, el);
    return true;
  }
  function tryAll() {
    var done = true;
    for (var id in IMAGES) {
      if (!replace(id, IMAGES[id])) done = false;
    }
    return done;
  }
  function start() {
    if (tryAll()) return;
    var obs = new MutationObserver(function() {
      if (tryAll()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function() { obs.disconnect(); }, 20000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
</script>
${MARKER_END}`;

const raw = fs.readFileSync(INDEX, 'utf8');
const startIdx = raw.indexOf(MARKER_START);
const endIdx = raw.indexOf(MARKER_END);
let clean = raw;
if (startIdx !== -1 && endIdx !== -1) {
  clean = raw.slice(0, startIdx) + raw.slice(endIdx + MARKER_END.length);
  console.log('Removed previous injection');
}

const bodyClose = clean.lastIndexOf('</body>');
if (bodyClose === -1) {
  console.error('No </body> tag found');
  process.exit(1);
}

const out = clean.slice(0, bodyClose) + INJECT + '\n' + clean.slice(bodyClose);
fs.writeFileSync(INDEX, out);
console.log('Injected at position', bodyClose, '— size', out.length);
