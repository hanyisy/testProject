/* 데모 세계 넣기 (컨펌용) — 업체 공개 사이트(/p/…)를 실제 데이터로 그려 보기 위한 현장 · 사진 · 페이지
 * 재료: demo-world.json (현장 · 역 · 가이드 · 질문 · 지역 정보) · demo-photos.json (무료 스톡 사진 — 운영 전 교체)
 * 사진 파일은 tools/fetch-demo-photos.mjs 로 web/.data/uploads/demo-stock/ 에 받아 둠 (없으면 사진 자리만 보임) */
import { and, eq, inArray, like } from 'drizzle-orm';
import type { DB } from './client';
import * as t from './schema';
import base from './demo-world.json';
import rehab from './demo-rehab.json';
import stock from './demo-photos.json';
import { hashPassword } from '../lib/password';
import { md } from '../lib/format';
import { buildReview, createRun, pickAndAssign } from '../lib/generate-core';

/* 업종을 늘릴 때는 업종 · 업체를 파일 하나로 따로 두고 여기서 합침 (demo-rehab.json: 개인회생 · 새봄법무사사무소) */
const world = {
  ...base,
  cityNames: { ...base.cityNames, ...rehab.cityNames },
  industries: { ...base.industries, ...rehab.industries },
  newPartners: [...base.newPartners, ...rehab.newPartners],
  partners: { ...base.partners, ...rehab.partners } as unknown as Record<string, Content>
};

const KST = '+09:00';
const at = (ymd: string, hm = '10:00') => new Date(`${ymd}T${hm}:00${KST}`);
type Site = { title: string; region: string; work: string; building: string; area?: number; days: number; date: string; floor?: string; details?: Record<string, string>; summary: string; issues: { title: string; body: string }[] };
/** 시안 데이터 없이 데모 세계에서만 만드는 업체의 운영 기록 (문의 · 검색어 · 블로그 · 청구 · 작업 · 새 사진 · 검색 자료 · 생성 기록) */
type Extra = {
  regionPages: [string, number][]; visits: Record<string, number>; queries: [string, number][]; memo: string; body: string;
  inquiries: { at: string; title: string; ptype: string; page: string; status: string; ver: string; amount?: number; needs?: boolean }[];
  blog: { site: string; date: string; title: string; status: string; url: string; body: string[] }[];
  charges: { date: string; item: string; state: string; tax: string | null }[];
  jobs: [string, string, string][]; newPhotos: [string, string, number, number][]; search: unknown;
  run: { work: string; drafts: number; picks: string[] };
};
type Content = { hours: string; home: { title: string; lead: string }; placeholder: string; cityInfo: Record<string, string>; regionStats?: Record<string, { photos: number; sites: number; info: string }>; sites: Site[]; stations: { name: string; city: string; radius: string; sites: string[] }[]; extra?: Extra };
const short = (id: string) => id.slice(0, 8);
const nospace = (s: string) => s.replace(/\s+/g, '');

export async function seedDemoWorld(db: DB) {
  const partners = await db.select({ p: t.partners, code: t.industries.code, industry: t.industries.name }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId));
  const industries = await db.select().from(t.industries);
  const plans = await db.select().from(t.plans);

  /* 0) 시안에 없던 업종 (개인회생) — 업종 템플릿 · 항목 */
  for (const ind of rehab.newIndustries) {
    if (industries.some((i) => i.code === ind.code)) continue;
    const [row] = await db.insert(t.industries).values({ code: ind.code, name: ind.name, status: ind.status as '사용 가능', sort: ind.sort }).returning();
    await db.insert(t.industryItems).values(ind.groups.flatMap(([group, labels]) => (labels as string[]).map((label, i) => ({ industryId: row.id, group: group as '작업 종류', label, sort: i }))));
    industries.push(row);
  }

  /* 1) 새 데모 업체 (단정인테리어 · 새봄법무사사무소) — 업체 · 지역 · 기능 · 로그인 */
  for (const n of world.newPartners) {
    const ind = industries.find((i) => i.name === n.industry)!;
    const plan = plans.find((p) => p.name === n.plan)!;
    const [row] = await db.insert(t.partners).values({
      slug: n.slug, name: n.name, industryId: ind.id, planId: plan.id, status: n.status as '운영 중', ceo: n.ceo, bizRegNo: n.bizRegNo, tel: n.tel, manager: n.manager,
      mobile: n.mobile, email: n.email, bizName: n.name, taxRegNo: n.bizRegNo, taxEmail: n.email, brandColor: n.brandColor, mark: n.mark, payMode: n.payMode as '계좌 입금',
      startedAt: n.startedAt, address: n.address, driveConnected: true, driveFolderUrl: `https://drive.google.com/drive/folders/demo_${n.slug}_photos`, driveSyncedAt: at('2026-10-07', '09:30')
    }).returning();
    await db.insert(t.partnerRegions).values(n.regions.map((region, i) => ({ partnerId: row.id, region, sort: i })));
    await db.insert(t.partnerFeatures).values({ partnerId: row.id, ...plan.defaultFeatures });
    await db.insert(t.users).values({ loginId: n.login.id, passwordHash: await hashPassword(n.login.pw), kind: 'partner', partnerId: row.id, name: n.manager, phone: n.mobile, email: n.email, status: '사용 중', mustChangePassword: false });
    partners.push({ p: row, code: ind.code, industry: ind.name });
  }

  /* 2) 업체별 현장 · 사진 · 페이지 */
  const photosOf = stock.photos as Record<string, (string[])[]>;
  const regionStats: Record<string, unknown> = {};
  const hgPages = await db.select().from(t.pages);
  for (const { p, code } of partners) {
    const c = world.partners[p.slug];
    if (!c) continue;
    await db.update(t.partners).set({ hours: c.hours }).where(eq(t.partners.id, p.id));
    Object.assign(regionStats, c.regionStats ?? {});
    const pool = photosOf[code] ?? [];
    let k = 0;
    const siteIds: Record<string, string> = {};
    for (const s of c.sites) {
      /* 현장마다 사진 3장 (업종 사진을 돌려 씀 · 한 장 최대 2번) — 첫 장 작업 전, 마지막 장 작업 후 */
      const take = pool.length ? Array.from({ length: 3 }, () => pool[k++ % pool.length]) : [];
      const [site] = await db.insert(t.sites).values({
        partnerId: p.id, title: s.title, region: s.region, workType: s.work, buildingType: s.building, areaPyeong: s.area ?? null, days: s.days, workedAt: s.date,
        floorNote: s.floor ?? null, details: s.details ?? {}, summary: s.summary, issues: s.issues, photoCount: take.length, status: '발행됨', publishedAt: at(s.date, '18:00')
      }).returning();
      siteIds[s.title] = site.id;
      if (take.length) {
        await db.insert(t.photos).values(take.map(([id, , caption], i) => ({
          partnerId: p.id, siteId: site.id, fileKey: `demo-stock/${id}.jpg`, label: id, caption, shot: (i === 0 ? '전' : i === take.length - 1 ? '후' : null) as '전',
          sort: i, place: s.region, takenAt: at(s.date, `${10 + i}:00`), source: '드라이브' as const, hasPerson: false, partnerPublic: true
        })));
      }
    }
    /* 공개 페이지 행: 현장 기록 · 역 주변 · 가이드 · 질문 — 시안 페이지 목록이 있으면 그 상태를 따름 */
    const ic = (world.industries as Record<string, { guides: { slug: string; title: string }[]; questions: { slug: string; q: string }[] }>)[code];
    const existing = hgPages.filter((x) => x.partnerId === p.id);
    const upsert = async (type: t.PageType, title: string, path: string, extra: Partial<typeof t.pages.$inferInsert> = {}) => {
      const hit = existing.find((x) => x.type === type && x.title.replace(/[?\s]/g, '') === title.replace(/[?\s]/g, ''));
      if (hit) await db.update(t.pages).set({ path, ...extra }).where(eq(t.pages.id, hit.id));
      else await db.insert(t.pages).values({ partnerId: p.id, type, title, path, status: '색인 확인', publishedAt: at('2026-09-01'), ...extra });
    };
    for (const s of c.sites) await upsert('현장', s.title, `현장/${short(siteIds[s.title])}`, { siteId: siteIds[s.title], regionKey: s.region });
    for (const st of c.stations) await upsert('역 주변', `${st.name} 인근 ${industries.find((i) => i.code === code)?.name}`, `역/${st.name}`, { regionKey: st.city });
    for (const g of ic?.guides ?? []) await upsert('가이드', g.title, `가이드/${g.slug}`);
    for (const q of ic?.questions ?? []) await upsert('질문', q.q, `질문/${q.slug}`);
    /* 시안 목록의 "지역" 페이지(예: 춘천 상가 철거) → 시 단위 작업 페이지 */
    for (const x of existing.filter((e) => e.type === '지역' && !e.path)) {
      const [city, ...rest] = x.title.split(' ');
      await db.update(t.pages).set({ path: `${city}/${nospace(rest.join(' '))}`, regionKey: city, work: nospace(rest.join(' ')), draftLabel: 'A' }).where(eq(t.pages.id, x.id));
    }
  }

  /* 3) 사진 검토 대기 새 사진(한결철거)도 스톡 사진으로 — 사람이 찍힌 사진은 자리표시 그대로 */
  const hg = partners.find((x) => x.p.slug === 'hangyeol')!.p;
  const waiting = await db.select().from(t.photos).where(and(eq(t.photos.partnerId, hg.id), like(t.photos.fileKey, 'demo/%')));
  const demol = photosOf.demolition;
  for (const [i, ph] of waiting.entries()) {
    if (ph.hasPerson) continue;
    const [id, , caption] = demol[(i + 7) % demol.length];
    await db.update(t.photos).set({ fileKey: `demo-stock/${id}.jpg`, caption }).where(eq(t.photos.id, ph.id));
  }

  /* 4) 페이지 생성으로 만든 검수 묶음(시안 A · B · D)의 지역 페이지 */
  const [run] = await db.select().from(t.generationRuns).where(eq(t.generationRuns.partnerId, hg.id)).limit(1);
  const bundles = await db.select().from(t.reviewBundles).where(and(eq(t.reviewBundles.partnerId, hg.id), like(t.reviewBundles.kind, '%· 시안 %')));
  for (const b of bundles) {
    const work = b.kind.split(' · ')[0].split('×')[1] ?? '';
    const label = b.kind.slice(-1);
    const items = await db.select().from(t.reviewItems).where(eq(t.reviewItems.bundleId, b.id));
    for (const it of items) {
      const [city, dong] = it.name.split(' ');
      const status: t.PageStatus = it.state === '검수 완료' || it.state === '발행 중 · 수정 대기' ? '색인 확인' : it.state === '반려' ? '비공개' : '검수 중';
      const [pg] = await db.insert(t.pages).values({
        partnerId: hg.id, type: '지역', title: `${it.name} ${work.replace(/철거$/, ' 철거')}`, path: `${city}/${dong}-${work}`, runId: run?.id ?? null,
        regionKey: it.name, work, draftLabel: label, status, publishedAt: status === '색인 확인' ? at('2026-10-06', '16:00') : null
      }).returning();
      await db.update(t.reviewItems).set({ pageId: pg.id }).where(eq(t.reviewItems.id, it.id));
    }
  }

  /* 4-1) 한결철거 문의: 데모 고객(010-0000-…은 가짜 번호) · 유입 페이지 연결 · 진행 기록 */
  const NAMES = ['김지훈', '이서연', '박준호', '최유진', '정하늘', '강민지', '조성우', '윤다은', '장태현', '임수빈', '한도윤', '오세린', '서지호', '신예린'];
  const inqs = await db.select().from(t.inquiries).where(eq(t.inquiries.partnerId, hg.id));
  const allPages = await db.select().from(t.pages).where(eq(t.pages.partnerId, hg.id));
  for (const [i, q] of [...inqs].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()).entries()) {
    const call = i % 4 === 3;
    const pg = allPages.find((p) => p.title.replace(/[?\s]/g, '') === (q.pageTitle ?? '').replace(/[?\s]/g, '') && p.path);
    await db.update(t.inquiries).set({
      customerName: NAMES[i % NAMES.length], customerPhone: `010-0000-${String(101 + i).padStart(4, '0')}`, channel: call ? '전화' : '폼', pageId: pg?.id ?? null,
      body: call ? null : `${q.title} 문의드려요. 현장 사진은 따로 보내 드릴 수 있어요. 가능한 날짜와 대략적인 비용 알려 주세요.`
    }).where(eq(t.inquiries.id, q.id));
    const log = (kind: '메모' | '상태' | '전화' | '문자', text: string, h: number) => db.insert(t.inquiryLogs).values({ inquiryId: q.id, kind, text, createdAt: new Date(q.receivedAt.getTime() + h * 3600e3) });
    /* 지금 상태까지 걸어온 단계 (무산은 견적 다음) */
    const ORDER = ['신규', '상담', '견적', '계약', '완료'];
    const chain = q.status === '무산' ? ['신규', '상담', '견적', '무산'] : ORDER.slice(0, ORDER.indexOf(q.status) + 1);
    if (chain.length > 1) await log('전화', '고객에게 전화했어요', 1);
    if (chain.includes('견적')) await log('메모', '현장 사진 받음 · 천장과 칸막이 철거, 엘리베이터 없음', 3);
    for (let k = 1; k < chain.length; k++) {
      const amt = chain[k] === '계약' && q.amount ? ` · ${q.amount.toLocaleString('ko-KR')}원` : '';
      await log('상태', `${chain[k - 1]} → ${chain[k]}${amt}`, k * 20);
    }
  }

  /* 4-2) 데모 세계에서만 만드는 업체(새봄법무사사무소)의 운영 기록 — 한결철거 시안 데이터와 같은 양으로 */
  const extraSearch: Record<string, unknown> = {};
  for (const { p, code } of partners) {
    const x = world.partners[p.slug]?.extra;
    if (!x) continue;
    const plan = plans.find((pl) => pl.id === p.planId)!;
    const own = await db.select().from(t.sites).where(eq(t.sites.partnerId, p.id));
    /* 시 단위 작업 페이지 (예: 관악 직장인 개인회생 → 관악/직장인개인회생) */
    for (const [i, [title, visits]] of x.regionPages.entries()) {
      const [city, ...rest] = title.split(' ');
      await db.insert(t.pages).values({ partnerId: p.id, type: '지역', title, path: `${city}/${nospace(rest.join(' '))}`, regionKey: city, work: nospace(rest.join(' ')), draftLabel: 'A', status: '색인 확인', visits30d: visits, sort: i, publishedAt: at('2026-08-20'), indexedAt: at('2026-08-27') });
    }
    const pgs = await db.select().from(t.pages).where(eq(t.pages.partnerId, p.id));
    const pageOf = (title: string) => pgs.find((g) => g.title.replace(/[?\s]/g, '') === title.replace(/[?\s]/g, ''));
    for (const [title, visits] of Object.entries(x.visits)) { const g = pageOf(title); if (g) await db.update(t.pages).set({ visits30d: visits }).where(eq(t.pages.id, g.id)); }
    for (const [query, clicks] of x.queries) await db.insert(t.pageQueries).values({ partnerId: p.id, query, clicks, period: '2026-10' });

    /* 문의 · 진행 기록 (010-0000-…은 가짜 번호) */
    const NAMES = ['문가은', '배준서', '송하린', '유시우', '홍채원', '권도현', '남지아', '백승민', '양서윤', '안재원', '허다인', '노은호', '구나연', '표태윤'];
    const ORDER = ['신규', '상담', '견적', '계약', '완료'];
    for (const [i, q] of x.inquiries.entries()) {
      const call = i % 4 === 3;
      const [ymd, hm] = q.at.split(' ');
      const g = pageOf(q.page);
      const [row] = await db.insert(t.inquiries).values({
        partnerId: p.id, receivedAt: at(ymd, hm), title: q.title, pageId: g?.id ?? null, pageTitle: q.page, pageType: q.ptype as '현장', channel: call ? '전화' : '폼',
        customerName: NAMES[i % NAMES.length], customerPhone: `010-0000-${String(201 + i).padStart(4, '0')}`, body: call ? null : x.body.replace('{title}', q.title),
        status: q.status as '신규', verify: q.ver as '확인 중', amount: q.amount ?? null, needsResult: !!q.needs
      }).returning();
      const log = (kind: '메모' | '상태' | '전화', text: string, h: number) => db.insert(t.inquiryLogs).values({ inquiryId: row.id, kind, text, createdAt: new Date(row.receivedAt.getTime() + h * 3600e3) });
      const chain = q.status === '무산' ? ['신규', '상담', '견적', '무산'] : ORDER.slice(0, ORDER.indexOf(q.status) + 1);
      if (chain.length > 1) await log('전화', '고객에게 전화했어요', 1);
      if (chain.includes('견적')) await log('메모', x.memo, 3);
      for (let k = 1; k < chain.length; k++) await log('상태', `${chain[k - 1]} → ${chain[k]}${chain[k] === '계약' && q.amount ? ` · ${q.amount.toLocaleString('ko-KR')}원` : ''}`, k * 20);
    }

    /* 블로그 (직접 올리기) */
    for (const [i, b] of x.blog.entries()) {
      await db.insert(t.blogPosts).values({ partnerId: p.id, siteId: own.find((s) => s.title === b.site)?.id ?? null, siteTitle: b.site, siteDate: b.date, title: b.title, body: b.body, mode: '직접 올리기', status: b.status as '초안', url: b.url || null, sort: i, publishedAt: b.status === '올림' ? at(b.date, '20:00') : null });
    }

    /* 청구 · 세금계산서 — 금액은 요금제 그대로 */
    for (const r of x.charges) {
      const paid = r.state !== '입금 대기';
      const [c] = await db.insert(t.charges).values({ partnerId: p.id, billedOn: r.date, item: r.item, method: '계좌 입금', amount: r.item.startsWith('설치비') ? plan.setupFee : plan.monthlyFee, state: r.state as '입금 대기', payer: p.name, confirmedAt: paid ? at(r.date, '15:00') : null }).returning();
      if (r.tax) await db.insert(t.taxRequests).values({ chargeId: c.id, requestedOn: r.date, state: r.tax as '요청됨' });
    }
    for (const [kind, status, hm] of x.jobs) await db.insert(t.jobs).values({ partnerId: p.id, kind: kind as '빌드', status: status as '성공', createdAt: at('2026-10-07', hm) });

    /* 사진 검토 대기 새 사진 — 사람이 찍힌 사진은 자리표시 · 기본 비공개 */
    const pool = photosOf[code] ?? [];
    let img = 3101;
    for (const [gi, [day, place, n, persons]] of x.newPhotos.entries()) {
      await db.insert(t.photos).values(Array.from({ length: n }, (_, i) => {
        const person = i < persons;
        const [sid, , caption] = pool[(gi * 7 + i + 3) % pool.length];
        return {
          partnerId: p.id, fileKey: person ? `demo/${p.slug}/IMG_${img + i}.jpg` : `demo-stock/${sid}.jpg`, label: `IMG_${img + i}`, caption: person ? null : caption, place,
          takenAt: at(day, `${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 9) % 60).padStart(2, '0')}`), source: '드라이브' as const, hasPerson: person, partnerPublic: !person
        };
      }));
      img += n;
    }
    extraSearch[p.slug] = x.search;
  }

  /* 5) 설정: 업종 · 업체별 공개 사이트 재료, 지역 사진 현황 합치기 */
  const sets = await db.select().from(t.settings).where(inArray(t.settings.key, ['region_stats', 'region_order']));
  const rs = { ...(sets.find((s) => s.key === 'region_stats')?.value as object), ...regionStats };
  const ro = [...((sets.find((s) => s.key === 'region_order')?.value as string[]) ?? []), ...Object.keys(regionStats)];
  await db.update(t.settings).set({ value: rs }).where(eq(t.settings.key, 'region_stats'));
  await db.update(t.settings).set({ value: ro }).where(eq(t.settings.key, 'region_order'));
  const siteContent = Object.fromEntries(Object.entries(world.partners).map(([slug, v]) => [slug, { home: v.home, placeholder: v.placeholder, cityInfo: v.cityInfo, stations: v.stations }]));
  await db.insert(t.settings).values([
    { key: 'industry_content', value: world.industries },
    { key: 'site_content', value: siteContent },
    { key: 'city_names', value: world.cityNames }
  ]);
  /* 검색엔진 데모 자료(클릭 · 검색어 차트)를 상호 대신 업체 주소(slug)로 — 상호를 바꿔도 남게 */
  const [ds] = await db.select().from(t.settings).where(eq(t.settings.key, 'demo_stats'));
  const dv = ds?.value as { search?: Record<string, unknown> } | undefined;
  if (dv?.search) {
    dv.search = { ...Object.fromEntries(Object.entries(dv.search).map(([name, v]) => [partners.find((x) => x.p.name === name)?.p.slug ?? name, v])), ...extraSearch };
    await db.update(t.settings).set({ value: dv }).where(eq(t.settings.key, 'demo_stats'));
  }

  /* 시안 A~F 공통 본문: 업종에 상관없이 쓰는 판(시안 원본은 철거 문장이 박혀 있어 다른 업종에 그대로 나갔음) */
  await db.update(t.settings).set({ value: world.draftStyles }).where(eq(t.settings.key, 'draft_styles'));

  /* 6) 시안 A~F 확인용 생성 기록 — 어드민 페이지 생성과 같은 흐름(createRun → 시안 고르기 · 배분 → buildReview)으로
   *    db:reset 해도 남음 · 배분은 사진 많은 지역부터 돌아가며라 매번 같은 주소
   *    한결철거 학원철거(시안 C · D) / 맑은집클린 오피스텔입주청소(시안 D · E · F) / 단정인테리어 아파트인테리어(시안 A · B) / 새봄법무사사무소 직장인개인회생(시안 A · B · C) */
  const [demoToday] = await db.select().from(t.settings).where(eq(t.settings.key, 'demo_today'));
  const createdOn = md(String(demoToday?.value ?? '2026-10-07'));
  const allStats = (rs ?? {}) as Record<string, { photos: number }>;
  const runList: [string, string, number, readonly string[]][] = [['hangyeol', '학원철거', 4, ['C', 'D']], ['malgeunjip', '오피스텔입주청소', 6, ['D', 'E', 'F']], ['danjeong', '아파트인테리어', 4, ['A', 'B']],
    ...Object.entries(world.partners).flatMap(([slug, c]) => (c.extra ? [[slug, c.extra.run.work, c.extra.run.drafts, c.extra.run.picks] as [string, string, number, string[]]] : []))];
  for (const [slug, work, count, picks] of runList) {
    const p = partners.find((x) => x.p.slug === slug)!.p;
    const cities = (await db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, p.id))).map((r) => r.region.split(' ').slice(-1)[0]);
    const regions = Object.keys(allStats).filter((k) => cities.some((c) => k.startsWith(c + ' ')) && allStats[k].photos > 0);
    const run = await createRun(db, { partnerId: p.id, type: '지역×작업', work, regions, draftCount: count, status: '완료' });
    await pickAndAssign(db, run.id, [...picks]);
    await buildReview(db, run.id, { createdOn });
    /* 시안 데이터가 없는 업체는 이 생성이 유일 — 미리보기 확인 요청까지 보낸 상태로 (파트너 "만들고 있는 페이지"에 보임) */
    if (world.partners[slug]?.extra) await db.update(t.generationRuns).set({ previewRequestedAt: at('2026-10-07', '11:00') }).where(eq(t.generationRuns.id, run.id));
  }
}
