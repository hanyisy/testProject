/* 현장로그 로컬 개발 서버 (의존성 없음) — node tools/dev-server.js [포트]
 *
 * web/public 정적 파일(랜딩)만 띄우고, 실제 서버가 생기기 전까지 필요한 동작만 흉내 냅니다.
 * 실제 서버를 만들 때 같은 동작을 옮기면 됩니다. (README "서버가 할 일" 참고)
 *
 * - 모든 응답에 X-Robots-Tag: noindex   임시 주소(도메인 연결 전)는 색인 제외
 * - 없는 주소                          404.html을 404로
 * - POST /api/lead                     가입 문의를 .devdata/leads.json에 저장 → 303 /landing/done.html
 * - /p/{slug}/...                      계약이 끝난 파트너면 p/closed.html을 410으로
 * - /p/{slug}/contact/done             파트너 사이트 문의 접수 완료 (p/contact-done.html)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'web', 'public');
const DEV = path.resolve(__dirname, '..', '.devdata');   // 로컬에서 받은 문의 (git 제외)
const DESIGN = path.resolve(__dirname, '..', 'design');  // 확정 시안 (개발 서버에서만 /design/ 으로 보기)
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

/* 계약이 끝나 비공개로 전환된 파트너 사이트 주소(slug). 실제로는 서버가 파트너 상태로 판단 */
const CLOSED_PARTNERS = (process.env.CLOSED_PARTNERS || 'closed-sample').split(',');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function send(res, status, body, type, extra) {
  res.writeHead(status, Object.assign({
    'Content-Type': type || 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store'
  }, extra || {}));
  res.end(body);
}
const sendFile = (res, file, status) => send(res, status || 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');

function readForm(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')))));
    req.on('error', reject);
  });
}

async function lead(req, res) {
  if (req.method !== 'POST') return send(res, 405, 'POST only', null, { Allow: 'POST' });
  const b = await readForm(req, 64 * 1024);
  const file = path.join(DEV, 'leads.json');
  let leads = [];
  try { leads = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 처음 */ }
  leads.push(Object.assign({ receivedAt: new Date().toISOString() }, b));
  fs.mkdirSync(DEV, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(leads, null, 2) + '\n');
  console.log('[가입 문의]', b.request_type === 'waitlist' ? '대기 신청' : '신규', '·', b.company, '·', b.industry, '·', b.region);
  send(res, 303, '', null, { Location: '/landing/done.html' });
}

function partnerSite(res, pathname) {
  const m = /^\/p\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
  if (!m) return false;
  if (CLOSED_PARTNERS.indexOf(m[1]) > -1) { sendFile(res, path.join(ROOT, 'p', 'closed.html'), 410); return true; }
  if (/^\/contact\/done\/?$/.test(m[2] || '')) { sendFile(res, path.join(ROOT, 'p', 'contact-done.html')); return true; }
  return false;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/lead') return await lead(req, res);
    if (partnerSite(res, url.pathname)) return;

    /* 시안 보기 (개발용): /design/ → 저장소의 design/ 폴더 */
    let base = ROOT;
    let rel = decodeURIComponent(url.pathname);
    if (rel.startsWith('/design/')) { base = DESIGN; rel = rel.slice('/design'.length); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(base, rel);
    if (!file.startsWith(base)) return send(res, 403, 'forbidden');
    fs.stat(file, (err, st) => {
      try {
        if (!err && st.isDirectory()) return send(res, 301, '', null, { Location: url.pathname + '/' });
        if (err) return fs.existsSync(path.join(ROOT, '404.html')) ? sendFile(res, path.join(ROOT, '404.html'), 404) : send(res, 404, 'not found');
        sendFile(res, file);
      } catch (e) { console.error(e); send(res, 500, 'error'); }
    });
  } catch (e) {
    console.error(e);
    try { sendFile(res, path.join(ROOT, 'error.html'), 500); } catch (e2) { send(res, 500, 'error'); }
  }
}).listen(PORT, () => console.log('현장로그 개발 서버: http://localhost:' + PORT + '/landing/'));
