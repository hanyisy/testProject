/* 깃허브 페이지용 정적 미리보기 만들기 — 개발 서버(더미 데이터)에서 화면을 HTML로 저장
 *   node tools/snapshot.mjs            (먼저 cd web && npm run dev, 기본 http://localhost:3000)
 * 결과: 저장소 루트 preview/ → https://hanyisy.github.io/testProject/preview/
 * 화면 · 링크 이동은 되지만 버튼 · 저장 · 폼은 동작하지 않음(서버가 없어서) — 스크립트는 빼고 HTML · CSS · 사진만 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ORIGIN = process.env.SNAP_ORIGIN || 'http://localhost:3000';
const BASE = process.env.SNAP_BASE || '/testProject/preview';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'preview');

/* ---------- 로그인 (데모 계정 폼을 그대로 보냄 · 자바스크립트 없이도 되는 폼) ---------- */
function jar() {
  const c = new Map();
  return {
    take(res) { for (const line of res.headers.getSetCookie?.() ?? []) { const [kv] = line.split(';'); const i = kv.indexOf('='); c.set(kv.slice(0, i).trim(), kv.slice(i + 1)); } },
    header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; '); },
    set(k, v) { c.set(k, v); }
  };
}
async function get(url, j, opts = {}) {
  const res = await fetch(ORIGIN + url, { redirect: 'manual', headers: j ? { cookie: j.header() } : {}, ...opts });
  if (j) j.take(res);
  return res;
}
function hiddenAction(html, near) {
  /* near(버튼 값) 이 들어 있는 form의 $ACTION_ID 칸 */
  const forms = html.split('<form').slice(1).map((f) => '<form' + f.split('</form>')[0]);
  const f = forms.find((x) => x.includes(near));
  if (!f) return null;
  const fields = [...f.matchAll(/<input[^>]*type="hidden"[^>]*>/g)].map((m) => ({ name: /name="([^"]+)"/.exec(m[0])?.[1], value: /value="([^"]*)"/.exec(m[0])?.[1] ?? '' })).filter((x) => x.name);
  return fields;
}
async function post(url, j, fields) {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  const res = await fetch(ORIGIN + url, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: j.header() } });
  j.take(res);
  return res;
}
async function login(id) {
  const j = jar();
  const html = await (await get('/login', j)).text();
  const hidden = hiddenAction(html, `value="${id}"`);
  if (!hidden) throw new Error('데모 로그인 폼을 못 찾았어요: ' + id);
  const r = await post('/login', j, [...hidden.map((h) => [h.name, h.value]), ['id', id]]);
  const loc = r.headers.get('location') ?? '';
  /* 첫 로그인 계정: "우선 로그인하기"와 같은 쿠키(이번 로그인만 비밀번호 변경 건너뜀) */
  if (loc.includes('/login/password')) j.set('hl_pw_later', '1');
  return j;
}

/* ---------- 저장 · 주소 바꾸기 ---------- */
const pages = new Map(); // 원래 주소(경로+쿼리) → 저장 경로(BASE 아래)
const assets = new Map(); // 원래 주소 → BASE 아래 경로
const qid = (q) => 'q-' + crypto.createHash('sha1').update(q).digest('hex').slice(0, 10);
function pagePath(u) {
  const [p, q] = u.split('?');
  const dec = decodeURI(p).replace(/\/$/, '') || '/';
  return (dec === '/' ? '' : dec) + (q ? '/' + qid(q) : '');
}
const enc = (p) => p.split('/').map((s) => encodeURIComponent(s)).join('/');
function linkTo(href, scope = '') {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith(BASE + '/')) return href;
  const [pathq, hash] = href.split('#');
  const key = normalize(pathq);
  const tail = hash ? '#' + hash : '';
  if (scope && pages.has(scope + key)) return BASE + enc(pages.get(scope + key)) + '/' + tail;
  if (scope && pages.has(scope + key.split('?')[0])) return BASE + enc(pages.get(scope + key.split('?')[0])) + '/' + tail;
  if (pages.has(key)) return BASE + enc(pages.get(key)) + '/' + tail;
  const base = key.split('?')[0];
  if (pages.has(base)) return BASE + enc(pages.get(base)) + '/' + tail;
  if (base.startsWith('/landing')) return BASE + base + tail;
  return BASE + '/missing.html';
}
function normalize(u) {
  try { const x = new URL(u, ORIGIN); const q = [...x.searchParams].filter(([k]) => k !== 'page' || x.searchParams.get('page') !== '1'); return decodeURI(x.pathname).replace(/(.)\/$/, '$1') + (q.length ? '?' + new URLSearchParams(q).toString() : ''); } catch { return u; }
}
async function asset(u, j) {
  if (assets.has(u)) return assets.get(u);
  const res = await get(u, j);
  if (!res.ok) { assets.set(u, u); return u; }
  const type = res.headers.get('content-type') ?? '';
  const ext = (/\.(\w{2,5})(?:\?|$)/.exec(u)?.[1] ?? (type.includes('css') ? 'css' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('woff2') ? 'woff2' : 'jpg')).toLowerCase();
  const name = crypto.createHash('sha1').update(u).digest('hex').slice(0, 16) + '.' + ext;
  const rel = '/assets/' + name;
  assets.set(u, BASE + rel);
  let buf = Buffer.from(await res.arrayBuffer());
  if (ext === 'css') {
    let css = buf.toString('utf8');
    for (const m of [...css.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/g)]) css = css.split(m[2]).join(await asset(m[2], j));
    buf = Buffer.from(css);
  }
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'assets', name), buf);
  return BASE + rel;
}
const BANNER = `<div style="position:sticky;top:0;z-index:9999;background:#111827;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>정적 미리보기</b><span style="opacity:.8">더미 데이터 화면이에요 · 링크 이동은 되지만 버튼 · 저장 · 폼은 동작하지 않아요</span><a href="${BASE}/" style="color:#93c5fd;margin-left:auto">미리보기 목차</a></div>`;
async function rewrite(html, j, scope = '') {
  html = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<link[^>]+rel="(?:preload|modulepreload)"[^>]*as="script"[^>]*>/g, '').replace(/<link[^>]+as="script"[^>]*>/g, '');
  html = html.replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, '');
  for (const m of [...html.matchAll(/(?:href|src)="(\/(?:_next\/static|files|media|landing)\/[^"]+)"/g)]) {
    if (/\.(css|jpe?g|png|webp|gif|svg|woff2?|ico)(\?|$)/i.test(m[1]) || m[1].startsWith('/files/') || m[1].startsWith('/media/')) html = html.split(`"${m[1]}"`).join(`"${await asset(m[1].replace(/&amp;/g, '&'), j)}"`);
  }
  for (const m of [...html.matchAll(/url\((?:&quot;|")?(\/(?:files|media)\/[^)&"]+)(?:&quot;|")?\)/g)]) html = html.split(m[1]).join(await asset(m[1], j));
  html = html.replace(/href="(\/[^"]*)"/g, (_, h) => `href="${linkTo(h.replace(/&amp;/g, '&'), scope)}"`);
  html = html.replace(/<form\b([^>]*)>/g, (_, a) => `<form${a.replace(/\saction="[^"]*"/, '').replace(/\smethod="[^"]*"/, '')} action="${BASE}/missing.html" method="get">`);
  html = html.replace(/<body([^>]*)>/, `<body$1>${BANNER}`);
  return html;
}

/* ---------- 모을 주소 ---------- */
/* 새봄법무사사무소(개인회생): 파트너 화면은 /새봄/partner/… 로 따로 저장 · 시안 미리보기는 생성 기록 배분(사진 많은 동부터 A → B → C) */
const S2 = '/새봄';
const SAEBOM_DRAFTS = ['/p/saebom/관악/신림동-직장인개인회생', '/p/saebom/동작/사당동-직장인개인회생', '/p/saebom/영등포/당산동-직장인개인회생'];
const SAEBOM_ROWS = [['지역 허브', '/p/saebom/관악'], ['시 단위 지역 페이지', '/p/saebom/관악/직장인개인회생'], ['시안 A 미리보기 (검수 중)', SAEBOM_DRAFTS[0]], ['시안 B 미리보기 (검수 중)', SAEBOM_DRAFTS[1]], ['시안 C 미리보기 (검수 중)', SAEBOM_DRAFTS[2]],
  ['역 주변', '/p/saebom/역/신림역'], ['가이드 (변제금 계산)', '/p/saebom/가이드/개인회생-변제금-계산하는-법'], ['가이드 (신청 서류)', '/p/saebom/가이드/개인회생-신청-서류'], ['질문', '/p/saebom/질문/개인회생-기간'], ['문의', '/p/saebom/문의']];
const uuids = (html, prefix) => [...new Set([...html.matchAll(new RegExp(`${prefix}/([0-9a-f-]{36})`, 'g'))].map((m) => m[1]))];
async function html(u, j) { const r = await get(u, j); return r.ok ? r.text() : ''; }

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const admin = await login('seojun.park');
  const partner = await login('hangyeol');
  const partner2 = await login('saebom');
  const list = []; // [저장 키, 쿠키, 묶음]
  const add = (u, j, scope = '') => { const k = scope + normalize(u); if (!list.some(([x]) => x === k)) list.push([k, j, scope]); };

  /* 본사 어드민 */
  for (const u of ['/admin', '/admin/agency', '/admin/billing', '/admin/generate', '/admin/indexing', '/admin/jobs', '/admin/leads', '/admin/me', '/admin/partners', '/admin/partners/new', '/admin/plans', '/admin/review', '/admin/review?page=2', '/admin/review?page=3', '/admin/settings', '/admin/settings/landing', '/admin/staff', '/admin/staff/new', '/admin/templates']) add(u, admin);
  for (const id of uuids(await html('/admin/leads', admin), '/admin/leads')) add(`/admin/leads/${id}`, admin);
  for (const id of uuids(await html('/admin/partners', admin), '/admin/partners')) for (const t of ['', '/billing', '/domain', '/features', '/scope']) add(`/admin/partners/${id}${t}`, admin);
  const rv = (await html('/admin/review', admin)) + (await html('/admin/review?page=2', admin)) + (await html('/admin/review?page=3', admin));
  for (const id of uuids(rv, '/admin/review')) { add(`/admin/review/${id}`, admin); add(`/admin/review/${id}/edit`, admin); }
  for (const id of uuids(await html('/admin/staff', admin), '/admin/staff')) add(`/admin/staff/${id}`, admin);
  const gen = await html('/admin/generate', admin);
  for (const pid of [...new Set([...gen.matchAll(/"id":"([0-9a-f-]{36})","name"/g)].map((m) => m[1]))]) for (const s of ['1', '2']) add(`/admin/generate?p=${pid}&step=${s}`, admin);
  const runs = new Set();
  for (const pid of [...new Set([...gen.matchAll(/"id":"([0-9a-f-]{36})","name"/g)].map((m) => m[1]))]) for (const m of (await html(`/admin/generate?p=${pid}`, admin)).matchAll(/run=([0-9a-f-]{36})/g)) runs.add(m[1]);
  for (const r of runs) { add(`/admin/generate?run=${r}`, admin); for (const s of ['3', '4', '5', '6']) add(`/admin/generate?run=${r}&step=${s}`, admin); }

  /* 파트너 관리자 (한결철거) */
  for (const u of ['/partner', '/partner/sites', '/partner/photos', '/partner/search', '/partner/search?type=현장', '/partner/making', '/partner/inquiries', '/partner/inquiries?period=all', '/partner/inquiries?tab=신규', '/partner/inquiries?tab=결과 입력 필요&period=all', '/partner/blog', '/partner/billing', '/partner/settings']) add(u, partner);
  for (const id of uuids(await html('/partner/inquiries?period=all', partner), '/partner/inquiries')) add(`/partner/inquiries/${id}`, partner);
  for (const m of (await html('/partner/blog', partner)).matchAll(/\/partner\/blog\?d=([0-9a-f-]{36})/g)) add(`/partner/blog?d=${m[1]}`, partner);

  /* 파트너 관리자 (새봄법무사사무소 · 개인회생) — /새봄/partner/… 로 따로 저장 */
  for (const u of ['/partner', '/partner/sites', '/partner/photos', '/partner/search', '/partner/search?type=현장', '/partner/making', '/partner/inquiries', '/partner/inquiries?period=all', '/partner/inquiries?tab=신규', '/partner/inquiries?tab=결과 입력 필요&period=all', '/partner/blog', '/partner/billing', '/partner/settings']) add(u, partner2, S2);
  for (const id of uuids(await html('/partner/inquiries?period=all', partner2), '/partner/inquiries')) add(`/partner/inquiries/${id}`, partner2, S2);
  for (const m of (await html('/partner/blog', partner2)).matchAll(/\/partner\/blog\?d=([0-9a-f-]{36})/g)) add(`/partner/blog?d=${m[1]}`, partner2, S2);

  /* 업체 공개 사이트 (본사 계정으로 — 검수 중 페이지도 미리보기) */
  const seeds = ['/p/hangyeol', '/p/malgeunjip', '/p/danjeong', '/p/saebom', '/p/onmaru', '/p/saebom/역/신림역', '/p/saebom/가이드/개인회생-신청-서류', '/p/saebom/질문/개인회생-기간', ...SAEBOM_DRAFTS,
    '/p/danjeong/성남/수내동-아파트인테리어', '/p/danjeong/성남/서현동-아파트인테리어', '/p/hangyeol/원주/단계동-학원철거', '/p/hangyeol/춘천/석사동-학원철거',
    '/p/malgeunjip/강남/역삼동-오피스텔입주청소', '/p/malgeunjip/서초/서초동-오피스텔입주청소', '/p/malgeunjip/강남/개포동-오피스텔입주청소', '/p/hangyeol/contact/done'];
  const seen = new Set();
  const queue = seeds.map((u) => [u, 0]);
  while (queue.length && seen.size < 220) {
    const [u, d] = queue.shift();
    const k = normalize(u);
    if (seen.has(k)) continue;
    seen.add(k);
    add(k, admin);
    if (d >= 2) continue;
    const h = await html(encodeURI(k), admin);
    for (const m of h.matchAll(/href="(\/p\/[^"#?]+)"/g)) { try { const v = decodeURI(m[1]); if (!seen.has(normalize(v))) queue.push([v, d + 1]); } catch { /* 깨진 주소 건너뜀 */ } }
  }

  /* 로그인 화면 (로그아웃 상태) */
  add('/login', null);

  /* 저장 경로 먼저 정해 두고(링크 바꾸기에 씀) 저장 */
  for (const [u] of list) pages.set(u, pagePath(u));
  let n = 0;
  for (const [u, j, scope] of list) {
    const res = await get(encodeURI(u.slice(scope.length)), j);
    if (!res.ok) { console.log('건너뜀', res.status, u); pages.delete(u); continue; }
    const out = await rewrite(await res.text(), j, scope);
    const dir = path.join(OUT, ...pages.get(u).split('/').filter(Boolean));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), out);
    if (++n % 20 === 0) console.log(n, '/', list.length);
  }

  /* 랜딩: 정적 파일 그대로 + 랜딩이 읽는 데이터(JSON) */
  fs.cpSync(path.join(ROOT, 'web', 'public', 'landing'), path.join(OUT, 'landing'), { recursive: true });
  /* 랜딩이 같이 쓰는 공용 CSS (../assets/css) */
  fs.cpSync(path.join(ROOT, 'web', 'public', 'assets'), path.join(OUT, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  for (const f of ['captures', 'landing-values', 'partner-sites', 'occupancy']) {
    let txt = await (await get(`/data/${f}.json`, null)).text();
    for (const m of [...txt.matchAll(/"(\/media\/[^"]+)"/g)]) txt = txt.split(m[1]).join(await asset(m[1], null));
    fs.writeFileSync(path.join(OUT, 'data', `${f}.json`), txt);
  }
  /* 깃허브 페이지는 POST를 못 받음 → 미리보기에서는 가입 문의를 보내면 접수 완료 화면으로만 */
  const cfg = path.join(OUT, 'landing', 'js', 'config.js');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace("leadEndpoint: '/api/lead'", "leadEndpoint: 'done.html'"));
  for (const f of fs.readdirSync(path.join(OUT, 'landing')).filter((x) => x.endsWith('.html'))) {
    const p = path.join(OUT, 'landing', f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<body([^>]*)>/, `<body$1>${BANNER}`).replace(/method="post"/g, 'method="get"'));
  }

  fs.writeFileSync(path.join(OUT, 'missing.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>서버가 필요한 화면</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px">${BANNER}<h1 style="font-size:22px">이 동작은 서버가 있어야 돼요</h1><p>정적 미리보기라서 저장 · 로그인 · 폼 보내기, 저장해 두지 않은 화면은 열리지 않아요. 실제로 눌러 보려면 개발 서버(<code>cd web && npm run dev</code>)에서 확인해 주세요.</p><p><a href="javascript:history.back()">← 돌아가기</a> · <a href="${BASE}/">미리보기 목차</a></p></body>`);
  /* 미리보기 목차 — 저장한 화면만 링크 */
  const L = (label, u) => { const k = normalize(u); return pages.has(k) ? `<li><a href="${BASE}${enc(pages.get(k))}/">${label}</a> <small>${k}</small></li>` : ''; };
  const firstOf = (prefix) => [...pages.keys()].find((k) => k.startsWith(prefix + '/') && /^[0-9a-f-]{36}$/.test(k.slice(prefix.length + 1)));
  const sec = (h, items) => `<h2>${h}</h2><ul>${items.join('')}</ul>`;
  const toc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>현장로그 미리보기</title>
<style>body{font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;max-width:860px;margin:0 auto;padding:0 16px 60px;color:#111827;background:#fff}h1{font-size:26px;margin:28px 0 4px}h2{font-size:18px;margin:28px 0 8px;padding-top:12px;border-top:1px solid #e5e7eb}ul{padding-left:18px;margin:0}li{margin:4px 0}small{color:#6b7280;font-size:12px;word-break:break-all}a{color:#2563eb}p{color:#4b5563}@media(prefers-color-scheme:dark){body{background:#0b0f17;color:#e5e7eb}h2{border-color:#1f2937}a{color:#93c5fd}p,small{color:#9ca3af}}</style></head><body>${BANNER}
<h1>현장로그 · 컨펌용 미리보기</h1><p>모두 더미 데이터예요. 화면 사이 링크는 이동되지만 버튼 · 저장 · 폼은 동작하지 않아요(서버가 필요). 사진은 확인용 스톡 사진이라 운영 전에 실제 현장 사진으로 바꿔야 해요.</p>
${sec('1. 랜딩 (가입 문의)', [`<li><a href="${BASE}/landing/">랜딩</a></li>`, `<li><a href="${BASE}/landing/done.html">접수 완료</a> · <a href="${BASE}/landing/privacy.html">개인정보처리방침</a> · <a href="${BASE}/landing/terms.html">이용약관</a></li>`, L('로그인 화면', '/login')])}
${sec('2. 본사 어드민 (최고 관리자 박서준)', [L('대시보드', '/admin'), L('가입 문의', '/admin/leads'), firstOf('/admin/leads') ? L('가입 문의 상세', firstOf('/admin/leads')) : '', L('파트너', '/admin/partners'), firstOf('/admin/partners') ? L('파트너 상세', firstOf('/admin/partners')) : '', L('파트너 추가', '/admin/partners/new'), L('페이지 생성', '/admin/generate'), L('업종 템플릿', '/admin/templates'), L('요금제', '/admin/plans'), L('발행 · 색인', '/admin/indexing'), L('검수', '/admin/review'), firstOf('/admin/review') ? L('검수 묶음 상세', firstOf('/admin/review')) : '', L('작업 로그', '/admin/jobs'), L('문의 · 정산', '/admin/billing'), L('대행 작업', '/admin/agency'), L('설정', '/admin/settings'), L('랜딩 관리', '/admin/settings/landing'), L('직원 계정', '/admin/staff'), L('내 계정', '/admin/me')])}
${sec('3. 파트너 관리자 (한결철거)', [L('홈', '/partner'), L('현장 발행', '/partner/sites'), L('사진 추가', '/partner/photos'), L('검색 노출', '/partner/search'), L('만들고 있는 페이지', '/partner/making'), L('문의', '/partner/inquiries'), firstOf('/partner/inquiries') ? L('문의 자세히', firstOf('/partner/inquiries')) : '', L('블로그', '/partner/blog'), L('결제 내역', '/partner/billing'), L('설정', '/partner/settings')])}
${sec('3-2. 파트너 관리자 (새봄법무사사무소 · 개인회생)', [L('홈', S2 + '/partner'), L('현장 발행', S2 + '/partner/sites'), L('검색 노출', S2 + '/partner/search'), L('만들고 있는 페이지 (시안 A·B·C)', S2 + '/partner/making'), L('문의', S2 + '/partner/inquiries'), firstOf(S2 + '/partner/inquiries') ? L('문의 자세히', firstOf(S2 + '/partner/inquiries')) : '', L('블로그', S2 + '/partner/blog'), L('결제 내역', S2 + '/partner/billing'), L('설정', S2 + '/partner/settings')])}
${sec('4. 업체 공개 사이트', [L('한결철거 홈 (철거)', '/p/hangyeol'), L('맑은집클린 홈 (입주청소)', '/p/malgeunjip'), L('단정인테리어 홈 (인테리어)', '/p/danjeong'), L('새봄법무사사무소 홈 (개인회생)', '/p/saebom'), L('온마루 홈 (준비 중 · 미리보기)', '/p/onmaru')])}
${sec('4-2. 개인회생 업체 (새봄법무사사무소) 페이지 종류', SAEBOM_ROWS.map(([l, u]) => L(l, u)))}
${sec('5. 지역 × 작업 페이지 — 시안 A~F', [L('A 사진 중심형', '/p/danjeong/성남/수내동-아파트인테리어'), L('B 현장 기록형', '/p/danjeong/성남/서현동-아파트인테리어'), L('C 질문 답변형', '/p/hangyeol/원주/단계동-학원철거'), L('D 비용 안내형', '/p/hangyeol/춘천/석사동-학원철거'), L('E 지도 중심형', '/p/malgeunjip/강남/역삼동-오피스텔입주청소'), L('F 후기 인용형', '/p/malgeunjip/서초/서초동-오피스텔입주청소'), L('발행된 지역 페이지', '/p/hangyeol/춘천/퇴계동-상가철거')])}
${sec('6. 그 밖의 페이지 종류', [L('지역 허브', '/p/hangyeol/춘천'), L('역 주변', '/p/hangyeol/역/남춘천역'), L('업종 가이드', '/p/hangyeol/가이드/철거-비용-계산하는-법'), L('질문', '/p/hangyeol/질문/학원-철거-기간'), L('문의', '/p/hangyeol/문의'), L('문의 접수 완료', '/p/hangyeol/contact/done'), L('개인정보처리방침', '/p/hangyeol/개인정보처리방침')])}
<p style="margin-top:28px">만든 때: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 화면 ${pages.size}개</p></body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), toc);

  /* 저장소 첫 주소(https://hanyisy.github.io/testProject/)는 바로 랜딩으로 */
  fs.writeFileSync(path.join(ROOT, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>현장로그</title><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0; url=${BASE}/landing/"><link rel="canonical" href="${BASE}/landing/"></head><body><a href="${BASE}/landing/">현장로그 랜딩으로 이동</a> · <a href="${BASE}/">미리보기 목차</a></body></html>\n`);

  /* 컨펌용 링크 문서(docs/confirm-links.md) — 깃허브 페이지 주소로만, 저장한 화면 기준 */
  const SITE = 'https://hanyisy.github.io' + BASE;
  const U = (u) => { const k = normalize(u); return pages.has(k) ? `${SITE}${enc(pages.get(k))}/` : null; };
  const row = (label, u, note = '') => { const url = U(u); return url ? `| ${label} | [${decodeURI(url.replace(SITE, ''))}](${url})${note ? ` · ${note}` : ''} |` : null; };
  const table = (rows) => ['| 화면 | 주소 |', '|---|---|', ...rows.filter(Boolean)].join('\n');
  const md = `# 컨펌용 페이지 링크

모두 더미 데이터예요. 깃허브 페이지에서 바로 열려요(서버 없이).
화면 · 화면 사이 링크는 되지만 **버튼 · 저장 · 폼 보내기는 동작하지 않아요**(누르면 "서버가 필요해요" 안내).
계정 정보는 [demo-accounts.md](demo-accounts.md) · 사진은 확인용 스톡 사진이라 운영 전에 실제 현장 사진으로 바꿔야 해요.

- **첫 화면 = 랜딩:** https://hanyisy.github.io/testProject/
- **미리보기 목차:** ${SITE}/

## 1. 랜딩 (가입 문의)
${table([`| 랜딩 | [/landing/](${SITE}/landing/) |`, `| 접수 완료 | [/landing/done.html](${SITE}/landing/done.html) |`, `| 개인정보처리방침 | [/landing/privacy.html](${SITE}/landing/privacy.html) |`, `| 이용약관 | [/landing/terms.html](${SITE}/landing/terms.html) |`, row('로그인 화면', '/login')])}

## 2. 본사 어드민 (최고 관리자 박서준으로 본 화면)
${table([row('대시보드', '/admin'), row('가입 문의', '/admin/leads'), firstOf('/admin/leads') && row('가입 문의 상세', firstOf('/admin/leads')),
    row('파트너 목록', '/admin/partners'), firstOf('/admin/partners') && row('파트너 상세', firstOf('/admin/partners'), '결제 · 도메인 · 기능 · 양산 범위 탭'), row('파트너 추가', '/admin/partners/new'),
    row('페이지 생성', '/admin/generate', '위 "생성 기록"에서 지난 생성 열기'), row('업종 템플릿', '/admin/templates'), row('요금제', '/admin/plans'), row('발행 · 색인', '/admin/indexing'),
    row('검수', '/admin/review'), firstOf('/admin/review') && row('검수 묶음 상세', firstOf('/admin/review')), row('작업 로그', '/admin/jobs'), row('문의 · 정산', '/admin/billing'), row('대행 작업', '/admin/agency'),
    row('설정', '/admin/settings'), row('랜딩 관리', '/admin/settings/landing'), row('직원 계정', '/admin/staff'), row('직원 추가', '/admin/staff/new'), row('내 계정', '/admin/me')])}

## 3. 파트너 관리자 (한결철거로 본 화면)
${table([row('홈', '/partner'), row('현장 발행', '/partner/sites'), row('사진 추가', '/partner/photos'), row('검색 노출', '/partner/search'), row('만들고 있는 페이지', '/partner/making'),
    row('문의', '/partner/inquiries'), row('문의 · 결과 입력 필요', '/partner/inquiries?tab=결과 입력 필요&period=all'), firstOf('/partner/inquiries') && row('문의 자세히', firstOf('/partner/inquiries')),
    row('블로그', '/partner/blog'), row('결제 내역', '/partner/billing'), row('설정 (최근 알림)', '/partner/settings')])}

## 3-2. 파트너 관리자 (새봄법무사사무소 · 개인회생으로 본 화면)
${table([row('홈', S2 + '/partner'), row('현장 발행', S2 + '/partner/sites'), row('사진 추가', S2 + '/partner/photos'), row('검색 노출', S2 + '/partner/search'), row('만들고 있는 페이지 (시안 A·B·C)', S2 + '/partner/making'),
    row('문의', S2 + '/partner/inquiries'), row('문의 · 결과 입력 필요', S2 + '/partner/inquiries?tab=결과 입력 필요&period=all'), firstOf(S2 + '/partner/inquiries') && row('문의 자세히', firstOf(S2 + '/partner/inquiries')),
    row('블로그', S2 + '/partner/blog'), row('결제 내역', S2 + '/partner/billing'), row('설정', S2 + '/partner/settings')])}

## 4. 업체 공개 사이트 (검수 중 페이지는 위에 "미리보기 · 시안 X" 띠)
${table([row('한결철거 홈 (철거)', '/p/hangyeol'), row('맑은집클린 홈 (입주청소)', '/p/malgeunjip'), row('단정인테리어 홈 (인테리어)', '/p/danjeong'), row('새봄법무사사무소 홈 (개인회생)', '/p/saebom'), row('온마루 홈 (준비 중 · 미리보기)', '/p/onmaru')])}

### 개인회생 업체 (새봄법무사사무소) — 현장 대신 "사례", 견적 대신 "무료 상담"
${table(SAEBOM_ROWS.map(([l, u]) => row(l, u)))}

### 지역 × 작업 페이지 — 시안 A~F
${table([row('A 사진 중심형', '/p/danjeong/성남/수내동-아파트인테리어'), row('B 현장 기록형', '/p/danjeong/성남/서현동-아파트인테리어'), row('C 질문 답변형', '/p/hangyeol/원주/단계동-학원철거'),
    row('D 비용 안내형', '/p/hangyeol/춘천/석사동-학원철거'), row('E 지도 중심형', '/p/malgeunjip/강남/역삼동-오피스텔입주청소'), row('F 후기 인용형', '/p/malgeunjip/서초/서초동-오피스텔입주청소'),
    row('발행된 지역 페이지', '/p/hangyeol/춘천/퇴계동-상가철거')])}

### 그 밖의 페이지 종류
${table([row('지역 허브', '/p/hangyeol/춘천'), row('역 주변', '/p/hangyeol/역/남춘천역'), row('업종 가이드', '/p/hangyeol/가이드/철거-비용-계산하는-법'), row('질문', '/p/hangyeol/질문/학원-철거-기간'),
    row('문의', '/p/hangyeol/문의'), row('문의 접수 완료', '/p/hangyeol/contact/done'), row('개인정보처리방침', '/p/hangyeol/개인정보처리방침')])}

## 다시 만들기 (화면을 고친 뒤)
1. 개발 서버 켜기: \`cd web && npm run dev\`
2. 저장소 루트에서 \`node tools/snapshot.mjs\` → \`preview/\` · 첫 화면 \`index.html\` · 이 문서가 새로 생김
3. 커밋 · 푸시 → 1~2분 뒤 깃허브 페이지에 반영
`;
  fs.writeFileSync(path.join(ROOT, 'docs', 'confirm-links.md'), md);

  fs.writeFileSync(path.join(OUT, '.saved.json'), JSON.stringify({ at: new Date().toISOString(), pages: [...pages.keys()] }, null, 1));
  console.log('저장', pages.size, '화면 ·', assets.size, '파일 →', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
