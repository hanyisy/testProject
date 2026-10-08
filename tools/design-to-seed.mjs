/* 확정 시안(design/)에 들어 있는 데모 데이터를 web/db/seed-data.json 으로 옮깁니다.
 * node tools/design-to-seed.mjs
 * 시안 파일은 공개 저장소에 없으므로, 시안이 있는 컴퓨터에서만 다시 만들 수 있어요. 결과 JSON은 저장소에 있습니다. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'web', 'db', 'seed-data.json');

/* 시안 HTML 안의 컴포넌트 스크립트를 실행해 상수와 초기 state를 꺼냄 */
function loadDesign(file, names) {
  const html = fs.readFileSync(path.join(ROOT, 'design', file), 'utf8');
  const src = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
  const ctx = { DCLogic: class { constructor(p) { this.props = p || {}; } setState() {} }, out: null, console };
  vm.createContext(ctx);
  vm.runInContext(src + `\nout = { state: new Component({}).state, ${names.join(', ')} };`, ctx);
  return JSON.parse(JSON.stringify(ctx.out));
}

const A = loadDesign('현장로그 본사 어드민.dc.html', ['PARTNERS', 'LEADS', 'TPLS', 'LOGIN_ACCTS', 'RV0', 'G_REG', 'G_DRAFTS', 'G_ASSIGN', 'G_INFO', 'PA_REG']);
const P = loadDesign('현장로그 파트너 v2.dc.html', ['SITES', 'PAGES', 'QUERIES', 'INQ', 'DRAFTS', 'LEDGER', 'BIZ', 'CHART', 'NEWP', 'MK_USAGE', 'PCOUNT']);
const S = A.state;

const SLUG = { '한결철거': 'hangyeol', '맑은집클린': 'malgeunjip', '온마루': 'onmaru', '다온플라워': 'daon' };
const REGIONS = {
  '한결철거': ['강원 춘천', '강원 원주', '강원 홍천'],
  '맑은집클린': ['서울 서초', '서울 강남'],
  '온마루': ['경기 수원', '경기 용인'],
  '다온플라워': ['대구']
};
/* 업체 정보: 한결철거·맑은집클린은 공개 사이트 시안, 맑은집클린 연락처는 어드민 상세 시안, 온마루는 가입 문의 시안 */
const INFO = {
  '한결철거': { ceo: '김한결', bizRegNo: P.BIZ.reg, tel: '010-4821-3307', manager: '김한결', mobile: '010-4821-3307', email: P.BIZ.email, brandColor: '#2F6B57', mark: '한', payMode: '계좌 입금', startedAt: '2026-07-01' },
  '맑은집클린': { ceo: '정맑음', bizRegNo: '318-22-90417', tel: S.pPhone, manager: '정맑음', mobile: S.pPhone, email: S.pEmail, brandColor: '#2E77B8', mark: '맑', payMode: S.payMode, startedAt: '2026-08-12' },
  '온마루': { manager: '서온마', mobile: '010-8820-1574', email: 'onmaru.floor@gmail.com', mark: '온', payMode: '계좌 입금', startedAt: null },
  '다온플라워': { mark: '다', payMode: '계좌 입금', startedAt: null }
};
const monthDay = (s) => { const m = /(\d+)월 (\d+)일/.exec(s || ''); return m ? `2026-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null; };

const out = {
  _source: 'design/현장로그 본사 어드민.dc.html · design/현장로그 파트너 v2.dc.html · design/한결철거 공개 사이트.dc.html',
  today: '2026-10-07',
  industries: A.TPLS.map((t, i) => ({ code: t.code, name: t.name, status: t.st, sort: i, groups: t.groups })),
  plans: S.plans.map((p, i) => ({ name: p.name, setupFee: p.setup, monthlyFee: p.monthly, extraNote: p.extra, features: p.f, sort: i })),
  partners: A.PARTNERS.map((p) => ({
    slug: SLUG[p.name], name: p.name, industry: p.biz, plan: p.plan, status: p.st, regions: REGIONS[p.name],
    pages: p.pages, indexed: p.ok, requested: p.req, inquiries: p.inq, ...INFO[p.name]
  })),
  features: { '맑은집클린': S.feat },
  mlConfig: { '맑은집클린': { langs: Object.keys(S.langs).filter((k) => S.langs[k]), countries: S.country, regions: Object.keys(S.mlRegions).filter((k) => S.mlRegions[k]), scope: S.mlScope } },
  scopeLogs: { '맑은집클린': S.scopeLog },
  domains: { '맑은집클린': { domain: S.domain, registrar: S.registrar, connection: '미연결', certificate: '대기', verifyToken: '8f2c1a7d' } },
  staff: S.staff,
  /* 시안 데모 계정 + 컨펌용으로 더한 최고 관리자 계정 (시안에는 비밀번호가 없어서 추가) */
  logins: [...A.LOGIN_ACCTS, { id: 'seojun.park', pw: 'Sj35-hq8Lm', where: 'admin', first: false }],
  leads: A.LEADS.map((l) => ({ ...l, receivedOn: monthDay(l.date), memos: l.memos.map((m) => ({ ...m, on: monthDay(m.date) })) })),
  jobs: S.logs,
  deposits: S.deposits,
  taxes: S.taxes,
  ledgers: {
    '한결철거': P.LEDGER,
    '맑은집클린': [
      { date: '10월 1일', item: '월 관리비 · 10월', method: '온라인 결제', amount: 190000, state: '결제 완료', tax: '카드 영수증' },
      { date: '10월 1일', item: '정산 수수료 · 9월 경유 계약 4건', method: '계좌 입금', amount: 340000, state: '입금 대기', tax: '요청 전' },
      { date: '9월 1일', item: '월 관리비 · 9월', method: '계좌 입금', amount: 190000, state: '입금 확인', tax: '요청됨' },
      { date: '9월 1일', item: '정산 수수료 · 8월 경유 계약 3건', method: '계좌 입금', amount: 255000, state: '입금 확인', tax: '발행 완료' },
      { date: '8월 12일', item: '제작비 · 지원형', method: '계좌 입금', amount: 0, state: '면제', tax: '해당 없음' }
    ]
  },
  agencyBlog: S.blogJobs,
  partnerBlog: P.DRAFTS,
  translations: S.trans,
  review: { bundles: A.RV0, state: S.rv.map((b) => ({ rows: b.rows.map((r) => ({ done: r.done, live: r.live })) })), history: S.rvHist, minUnique: S.rvMinUniq, minPhotos: S.rvMinPhotos },
  generation: { regions: A.G_REG, drafts: A.G_DRAFTS, assign: A.G_ASSIGN, info: A.G_INFO, selected: S.gSel },
  hangyeol: { sites: P.SITES, pages: P.PAGES, queries: P.QUERIES, inquiries: P.INQ, chart: P.CHART, newPages: P.NEWP, usage: P.MK_USAGE, pageCount: P.PCOUNT },
  /* 시안 대시보드 · 파트너 목록에 적힌 합계 (파트너별 페이지가 시안에 다 있지 않아 합계만 보관 — 실제 운영에서는 집계로 대체) */
  demoStats: {
    partners: Object.fromEntries(A.PARTNERS.map((p) => [p.name, { pages: p.pages, indexed: p.ok, requested: p.req, inquiries: p.inq, ...(p.name === '맑은집클린' ? { photos: 286, sites: 24, newPhotos: 11, lastLogin: '오늘 08:12', syncedAgo: '10분 전' } : {}) }])),
    monthPublished: { '한결철거': 3, '맑은집클린': 6 },
    monthInquiries: 34, notMine: 2,
    indexRatio: { pct: 87, indexed: 78, total: 90 },
    attention: [
      { partner: '맑은집클린', tag: '색인 비율 하락', desc: '새 페이지 5장이 색인 요청 상태로 15일 이상', value: '2주 전 95% → 현재 90%', to: 'indexing' },
      { partner: '온마루', tag: '2주 이상 현장 없음', desc: '드라이브 폴더에 현장 사진이 아직 없어요', value: '준비 중 18일째', to: 'partner' }
    ]
  },
  settings: { region_options: A.PA_REG.map((r) => r[0]), index_days: S.idxDays, cap_per_partner: Number(S.capPartner), cap_total: Number(S.capTotal), payment_key: S.payKey, alimtalk_codes: [S.alim1, S.alim2] }
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('시드 데이터:', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(1) + 'KB');
