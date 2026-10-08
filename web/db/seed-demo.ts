/* 데모 세계 넣기 (컨펌용) — 업체 공개 사이트(/p/…)를 실제 데이터로 그려 보기 위한 현장 · 사진 · 페이지
 * 재료: demo-world.json (현장 · 역 · 가이드 · 질문 · 지역 정보) · demo-photos.json (무료 스톡 사진 — 운영 전 교체)
 * 사진 파일은 tools/fetch-demo-photos.mjs 로 web/.data/uploads/demo-stock/ 에 받아 둠 (없으면 사진 자리만 보임) */
import { and, eq, inArray, like } from 'drizzle-orm';
import type { DB } from './client';
import * as t from './schema';
import world from './demo-world.json';
import stock from './demo-photos.json';
import { hashPassword } from '../lib/password';

const KST = '+09:00';
const at = (ymd: string, hm = '10:00') => new Date(`${ymd}T${hm}:00${KST}`);
type Site = (typeof world.partners.hangyeol.sites)[number];
type Content = { hours: string; home: { title: string; lead: string }; placeholder: string; cityInfo: Record<string, string>; regionStats?: Record<string, { photos: number; sites: number; info: string }>; sites: Site[]; stations: { name: string; city: string; radius: string; sites: string[] }[] };
const short = (id: string) => id.slice(0, 8);
const nospace = (s: string) => s.replace(/\s+/g, '');

export async function seedDemoWorld(db: DB) {
  const partners = await db.select({ p: t.partners, code: t.industries.code, industry: t.industries.name }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId));
  const industries = await db.select().from(t.industries);
  const plans = await db.select().from(t.plans);

  /* 1) 새 데모 업체 (단정인테리어) — 업체 · 지역 · 기능 · 로그인 */
  for (const n of world.newPartners) {
    const ind = industries.find((i) => i.name === n.industry)!;
    const plan = plans.find((p) => p.name === n.plan)!;
    const [row] = await db.insert(t.partners).values({
      slug: n.slug, name: n.name, industryId: ind.id, planId: plan.id, status: n.status as '운영 중', ceo: n.ceo, bizRegNo: n.bizRegNo, tel: n.tel, manager: n.manager,
      mobile: n.mobile, email: n.email, bizName: n.name, taxEmail: n.email, brandColor: n.brandColor, mark: n.mark, payMode: n.payMode as '계좌 입금',
      startedAt: n.startedAt, address: n.address, driveConnected: true, driveSyncedAt: at('2026-10-07', '09:30')
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
    const c = (world.partners as Record<string, Content>)[p.slug];
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
        partnerId: p.id, title: s.title, region: s.region, workType: s.work, buildingType: s.building, areaPyeong: s.area, days: s.days, workedAt: s.date,
        floorNote: s.floor, summary: s.summary, issues: s.issues, photoCount: take.length, status: '발행됨', publishedAt: at(s.date, '18:00')
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
}
