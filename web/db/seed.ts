/* 시안 더미 데이터 넣기 — 데이터 원본은 seed-data.json (tools/design-to-seed.mjs 로 시안에서 생성)
 * DB가 비어 있을 때만 실행됩니다. 처음 상태로 되돌리려면: npm run db:reset */
import { randomBytes } from 'node:crypto';
import { and, count, eq, like } from 'drizzle-orm';
import type { DB } from './client';
import * as t from './schema';
import data from './seed-data.json';
import { hashPassword } from '../lib/password';

type Seed = typeof data;
const KST = '+09:00';
const at = (ymd: string, hm = '10:00') => new Date(`${ymd}T${hm}:00${KST}`);
/** "10월 7일" → 2026-10-07 */
const md = (s: string) => { const m = /(\d+)월 (\d+)일/.exec(s); return m ? `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : data.today; };
/** "오늘 09:12" · "어제 17:25" · "10월 5일" → 시각 */
function relTime(s: string) {
  const time = /(\d{2}):(\d{2})/.exec(s)?.[0] ?? '10:00';
  if (s.startsWith('오늘')) return at(data.today, time);
  if (s.startsWith('어제')) return at('2026-10-06', time);
  return at(md(s), time);
}

export async function seedIfEmpty(db: DB) {
  const [{ n }] = await db.select({ n: count() }).from(t.users);
  if (n > 0) return;
  await seed(db, data);
}

async function seed(db: DB, d: Seed) {
  /* 업종 템플릿 */
  const industryId: Record<string, string> = {};
  for (const ind of d.industries) {
    const [row] = await db.insert(t.industries).values({ code: ind.code, name: ind.name, status: ind.status as '사용 가능', sort: ind.sort }).returning();
    industryId[ind.name] = row.id;
    const items = ind.groups.flatMap(([group, labels]) => (labels as string[]).map((label, i) => ({ industryId: row.id, group: group as '작업 종류', label, sort: i })));
    if (items.length) await db.insert(t.industryItems).values(items);
  }

  /* 요금제 */
  const planId: Record<string, string> = {};
  for (const p of d.plans) {
    const [row] = await db.insert(t.plans).values({ name: p.name, setupFee: p.setupFee, monthlyFee: p.monthlyFee, extraNote: p.extraNote, settleRatePct: Number(p.extraNote.match(/(\d+)% 정산/)?.[1] ?? 0), defaultFeatures: p.features as t.Features, sort: p.sort }).returning();
    planId[p.name] = row.id;
  }

  /* 파트너 */
  const partnerId: Record<string, string> = {};
  for (const p of d.partners) {
    const [row] = await db.insert(t.partners).values({
      slug: p.slug, name: p.name, industryId: industryId[p.industry], planId: planId[p.plan], status: p.status as '운영 중',
      ceo: p.ceo ?? null, bizRegNo: p.bizRegNo ?? null, tel: p.tel ?? null, manager: p.manager ?? null, mobile: p.mobile ?? null, email: p.email ?? null,
      /* 사업자 정보: 등록번호가 있는 업체는 저장된 상태로 (세금계산서 바로 요청), 없으면 요청 때 입력 창 */
      bizName: p.bizRegNo ? p.name : null, taxEmail: p.bizRegNo ? p.email ?? null : null,
      brandColor: p.brandColor ?? null, mark: p.mark ?? null, payMode: p.payMode as '계좌 입금', startedAt: p.startedAt ?? null,
      driveConnected: p.status === '운영 중', driveSyncedAt: p.status === '운영 중' ? at(d.today, '09:50') : null,
      endedAt: p.status === '종료' ? '2026-09-30' : null
    }).returning();
    partnerId[p.name] = row.id;
    await db.insert(t.partnerRegions).values(p.regions.map((region, i) => ({ partnerId: row.id, region, sort: i })));
    const base = d.plans.find((x) => x.name === p.plan)!.features as t.Features;
    const own = (d.features as Record<string, t.Features>)[p.name];
    /* 한결철거: 파트너 시안의 블로그 "사용" 화면이 기본이라 직접 올리기로 둠 */
    const f = own ?? (p.name === '한결철거' ? { ...base, blog: '직접 올리기' as const } : base);
    await db.insert(t.partnerFeatures).values({ partnerId: row.id, ...f, mlConfig: (d.mlConfig as Record<string, t.MlConfig>)[p.name] ?? null });
  }

  /* 양산 범위 기록 · 도메인 */
  for (const [name, logs] of Object.entries(d.scopeLogs)) {
    for (const l of logs) await db.insert(t.scopeLogs).values({ partnerId: partnerId[name], who: l.who, what: l.what, warningAck: l.ack as '확인함', createdAt: new Date(l.when.replace(' ', 'T') + `:00${KST}`) });
  }
  for (const [name, dm] of Object.entries(d.domains)) {
    await db.insert(t.domains).values({ partnerId: partnerId[name], domain: dm.domain, registrar: dm.registrar, connection: dm.connection as '미연결', certificate: dm.certificate as '대기', verifyToken: dm.verifyToken });
  }

  /* 계정: 본사 직원 + 파트너. 시안 데모 계정만 알려진 비밀번호, 나머지는 아무도 모르는 임의 값 */
  const known = Object.fromEntries(d.logins.map((l) => [l.id, l]));
  const unknownHash = await hashPassword(randomBytes(18).toString('base64'));
  const userId: Record<string, string> = {};
  for (const s of d.staff) {
    const k = known[s.id];
    const [row] = await db.insert(t.users).values({
      loginId: s.id, passwordHash: k ? await hashPassword(k.pw) : unknownHash, kind: 'staff', role: s.role as '관리팀', name: s.name,
      phone: s.phone, email: s.email, status: s.st as '사용 중', mustChangePassword: k ? k.first : s.st === '첫 로그인 전',
      activityCount: Number(String(s.logs).replace(/[^0-9]/g, '')) || 0
    }).returning();
    userId[s.name] = row.id;
  }
  for (const p of d.partners) {
    const k = known[p.slug];
    await db.insert(t.users).values({
      loginId: p.slug, passwordHash: k ? await hashPassword(k.pw) : unknownHash, kind: 'partner', partnerId: partnerId[p.name],
      name: p.manager ?? p.name, phone: p.mobile ?? null, email: p.email ?? null,
      status: p.status === '종료' ? '사용 중지' : k && !k.first ? '사용 중' : '첫 로그인 전', mustChangePassword: k ? k.first : true
    });
  }

  /* 가입 문의 */
  for (const l of d.leads) {
    const [row] = await db.insert(t.leads).values({
      receivedAt: at(l.receivedOn!), company: l.name, manager: l.mgr, phone: l.phone, email: l.email, homepage: l.home, message: l.content,
      industry: l.biz, regions: l.regions, status: l.status as '신규', ownerUserId: l.owner ? userId[l.owner] : null,
      partnerId: l.status === '계약' ? partnerId[l.name] ?? null : null, sourceForm: 'full'
    }).returning();
    for (const m of [...l.memos].reverse()) await db.insert(t.leadMemos).values({ leadId: row.id, userId: userId[m.who], body: m.t, createdAt: at(m.on!) });
  }

  /* 작업 로그 */
  for (const j of d.jobs) {
    await db.insert(t.jobs).values({ partnerId: partnerId[j.partner], kind: j.job as '빌드', status: j.ok ? '성공' : '실패', reason: j.reason ?? null, willFailAgain: !!j.willFail, tries: j.tries ?? 1, createdAt: at(d.today, j.time) });
  }

  /* 청구 · 입금 · 세금계산서 */
  const bank = (m: string) => (m === 'bank' || m === '계좌 입금' ? '계좌 입금' : '온라인 결제') as '계좌 입금';
  const st = (s: string, method: string) => ({ wait: '입금 대기', unpaid: '미결제', paid: method === '계좌 입금' ? '입금 확인' : '결제 완료' } as Record<string, string>)[s] ?? s;
  const taxReq = Object.fromEntries(d.taxes.map((x) => [x.partner + x.item.split(' · ')[0] + x.item.split(' · ')[1]?.slice(0, 2), x.req]));
  for (const [name, rows] of Object.entries(d.ledgers)) {
    for (const r of rows as Array<Record<string, unknown>>) {
      const method = bank(String(r.pay ?? r.method));
      const [c] = await db.insert(t.charges).values({ partnerId: partnerId[name], billedOn: md(String(r.date)), item: String(r.item), method, amount: Number(r.amount), state: st(String(r.state), method) as '입금 대기',
        /* 계좌 입금은 입금자명, 온라인 결제 완료는 결제 수단 (시안 표기) */
        payer: method === '계좌 입금' ? name : st(String(r.state), method) === '결제 완료' ? '법인카드 ···4821' : null }).returning();
      const tax = String(r.tax ?? '');
      if (tax === 'requested' || tax === '요청됨' || tax === 'issued' || tax === '발행 완료') {
        const key = name + String(r.item).split(' · ')[0] + String(r.item).split(' · ')[1]?.slice(0, 2);
        await db.insert(t.taxRequests).values({ chargeId: c.id, requestedOn: md(taxReq[key] ?? String(r.date)), state: tax === 'issued' || tax === '발행 완료' ? '발행 완료' : '요청됨' });
      }
    }
  }
  const onmaruDeposit = d.deposits.find((x) => x.partner === '온마루');
  if (onmaruDeposit) await db.insert(t.charges).values({ partnerId: partnerId['온마루'], billedOn: '2026-10-01', item: onmaruDeposit.item, method: '계좌 입금', amount: onmaruDeposit.amount, state: '입금 대기', payer: onmaruDeposit.payer });

  /* 지원형 정산: 마감된 달은 정산 수수료 청구 건과 연결 */
  for (const x of d.settles) {
    const [c] = x.chargeItem ? await db.select({ id: t.charges.id }).from(t.charges).where(and(eq(t.charges.partnerId, partnerId[x.partner]), like(t.charges.item, x.chargeItem + '%'))).limit(1) : [];
    await db.insert(t.settlements).values({ partnerId: partnerId[x.partner], month: x.month, contractCount: x.count, contractAmount: x.amount, ratePct: x.rate, fee: Math.round((x.amount * x.rate) / 100), chargeId: c?.id ?? null });
  }

  /* 블로그: 맑은집클린 본사 대행(승인됨) · 한결철거 직접 올리기 */
  for (const [i, b] of d.agencyBlog.entries()) {
    await db.insert(t.blogPosts).values({ partnerId: partnerId[b.partner], siteTitle: b.title, siteDate: b.approved, title: b.title, body: [], mode: '본사 대행', status: '승인', approvedOn: b.approved, sort: i });
  }
  for (const [i, b] of d.partnerBlog.entries()) {
    await db.insert(t.blogPosts).values({ partnerId: partnerId['한결철거'], siteTitle: b.site, siteDate: b.date, title: b.title, body: b.body, mode: '직접 올리기', status: b.status as '초안', url: b.url || null, billedThisMonth: b.month, sort: i });
  }

  /* 번역 검수 (대행 작업 목록) */
  for (const tr of d.translations) await db.insert(t.translations).values({ partnerId: partnerId['맑은집클린'], pageTitle: tr.page, lang: tr.lang });

  /* 검수 묶음 */
  for (const [bi, b] of (d.review.bundles as Array<Record<string, any>>).entries()) {
    const [row] = await db.insert(t.reviewBundles).values({ partnerId: partnerId[b.partner], kind: b.kind, type: b.type, draftStyle: b.draft ?? null, col1: b.c1, col2: b.c2, commonBody: b.body, createdOn: b.date }).returning();
    const state = d.review.state[bi].rows;
    const rows = (b.rows as any[]).map(([name, info, photos, sites, uniq]: any[], i: number) => ({
      bundleId: row.id, name, info, photos, sites, uniquePct: uniq, sort: i,
      state: (state[i].done ? '검수 완료' : state[i].live ? '발행 중 · 수정 대기' : '대기') as '대기'
    }));
    const ex = (b.ex as any[]).map(([name, photos, sites, uniq, reasons, note]: any[], i: number) => ({
      bundleId: row.id, name, info: '', photos, sites, uniquePct: uniq, reasons, note, sort: rows.length + i, state: '개별 검수' as const
    }));
    await db.insert(t.reviewItems).values([...rows, ...ex]);
  }
  for (const h of d.review.history) {
    await db.insert(t.reviewHistory).values({ bundleLabel: h.bundle, who: h.who, what: h.what, reverted: !!(h as { reverted?: boolean }).reverted, whenText: h.when, userId: userId[h.who] ?? null });
  }

  /* 페이지 생성 (어드민 3r–3x · 파트너 2j): 한결철거 지역×상가철거, 지역 12곳 · 시안 A·B·D */
  const hg = partnerId['한결철거'];
  const gen = d.generation as unknown as {
    regions: [string, [string, number, number][]][]; drafts: [string, string, string][]; assign: Record<string, string>;
    info: Record<string, string>; selected: string[]; picked: Record<string, boolean>; partnerLikes: Record<string, boolean>; partnerNotes: Record<string, string>;
  };
  const cityOf: Record<string, string> = {};
  const regionStats: Record<string, { photos: number; sites: number; info: string | null }> = {};
  for (const [city, dongs] of gen.regions) for (const [dong, photos, sites] of dongs) {
    cityOf[dong] = city;
    regionStats[`${city} ${dong}`] = { photos, sites, info: gen.info[dong] ?? null };
  }
  const [run] = await db.insert(t.generationRuns).values({
    partnerId: hg, pageType: '지역×상가철거', regions: gen.selected.map((g) => `${cityOf[g]} ${g}`), draftCount: 4, status: '검수로 넘김', createdAt: at('2026-10-06', '14:00')
  }).returning();
  await db.insert(t.generationDrafts).values(gen.drafts.slice(0, 4).map(([label, style, description]) => ({
    runId: run.id, label, style, description, picked: !!gen.picked[label],
    partnerLike: !!gen.partnerLikes[label], partnerNote: gen.partnerNotes[label] ?? ''
  })));
  await db.insert(t.generationAssignments).values(gen.selected.map((g) => ({ runId: run.id, region: `${cityOf[g]} ${g}`, draftLabel: gen.assign[g] ?? 'A' })));

  /* 한결철거 현장 · 페이지 · 검색어 · 고객 문의 (파트너 시안) */
  for (const s of d.hangyeol.sites) await db.insert(t.sites).values({ partnerId: hg, title: s.title, workedAt: md(s.date), photoCount: s.n, status: '발행됨', publishedAt: at(md(s.date)) });
  for (const [i, [type, title, status, visits]] of (d.hangyeol.pages as [string, string, string, number][]).entries()) {
    await db.insert(t.pages).values({ partnerId: hg, type: type as '현장', title, status: status as '발행됨', visits30d: visits, sort: i, publishedAt: at('2026-09-01') });
  }
  for (const [query, clicks] of d.hangyeol.queries as [string, number][]) await db.insert(t.pageQueries).values({ partnerId: hg, query, clicks, period: '2026-10' });
  for (const q of d.hangyeol.inquiries as Array<Record<string, any>>) {
    await db.insert(t.inquiries).values({ partnerId: hg, receivedAt: relTime(q.time), title: q.title, pageTitle: q.page, pageType: q.ptype, status: q.status, verify: q.ver, amount: q.amount ?? null, needsResult: !!q.needs });
  }

  /* 한결철거 새 사진 (사진 검토 대기) — 시안 2b: 9월 22일 춘천 퇴계동 18장 · 9월 25일 원주 단계동 6장, 사람 사진은 기본 비공개 */
  const groups: [string, string, number, number[]][] = [['2026-09-22', '춘천 퇴계동', 18, [2, 6, 11]], ['2026-09-25', '원주 단계동', 6, []]];
  let img = 2201;
  for (const [day, place, n, persons] of groups) {
    await db.insert(t.photos).values(Array.from({ length: n }, (_, i) => ({
      partnerId: hg, fileKey: `demo/hangyeol/IMG_${img + i}.jpg`, label: `IMG_${img + i}`, place,
      takenAt: at(day, `${String(9 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`),
      source: '드라이브' as const, hasPerson: persons.includes(i), partnerPublic: !persons.includes(i)
    })));
    img += n;
  }

  /* 설정값 */
  const { _note, ...regionCenters } = (await import('./region-centers.json')).default as Record<string, unknown>;
  void _note;
  const settings = { ...d.settings, review_min_unique: 35, review_min_photos: 3, region_centers: regionCenters, billing: d.billing, demo_today: d.today, demo_stats: d.demoStats, region_stats: regionStats, landing_values: { industries: null, pages: null, monthlyPages: null, fixDays: null, indexDays: null, business: { ceo: '', bizNo: '', address: '', email: '', phone: '' } } };
  await db.insert(t.settings).values(Object.entries(settings).map(([key, value]) => ({ key, value: value as object })));
}
