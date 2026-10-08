/* 파트너 관리자 조회 — 모든 조회는 로그인한 파트너의 partner_id 로만 거름 */
import 'server-only';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';
import { regionText } from './partners';

export const INQ_ORDER = ['신규', '상담', '견적', '계약', '완료'] as const;

/** 틀(사이드바 · 모바일 머리)에 필요한 것: 업체명 · 지역 · 결과 입력 필요 수 · 블로그 잠금 */
export async function partnerFrame(partnerId: string) {
  const db = await getDb();
  const [[p], regions, [needs], [f]] = await Promise.all([
    db.select().from(t.partners).where(eq(t.partners.id, partnerId)).limit(1),
    db.select().from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, partnerId)).orderBy(asc(t.partnerRegions.sort)),
    db.select({ n: sql<number>`count(*)::int` }).from(t.inquiries).where(and(eq(t.inquiries.partnerId, partnerId), eq(t.inquiries.needsResult, true))),
    db.select().from(t.partnerFeatures).where(eq(t.partnerFeatures.partnerId, partnerId)).limit(1)
  ]);
  const area = regions.map((r) => r.region.split(' ').slice(1).join(' ') || r.region).join(' · ');
  return { partner: p, area, areaFull: regionText(regions.map((r) => r.region)), needs: needs.n, blogLocked: !f || f.blog === '꺼짐', blogMode: f?.blog ?? '꺼짐' };
}

/** 새 사진(아직 현장에 묶이지 않은 사진)을 촬영일 · 지역으로 묶음 */
export async function photoGroups(partnerId: string) {
  const db = await getDb();
  const rows = await db.select().from(t.photos).where(and(eq(t.photos.partnerId, partnerId), isNull(t.photos.siteId))).orderBy(asc(t.photos.takenAt));
  const groups: { key: string; day: string; place: string; photos: typeof rows }[] = [];
  for (const r of rows) {
    const day = r.takenAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(r.takenAt) : '날짜 없음';
    const key = `${day}|${r.place ?? ''}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, day, place: r.place ?? '위치 없음', photos: [] }));
    g.photos.push(r);
  }
  return groups;
}

export async function partnerHome(partnerId: string) {
  const db = await getDb();
  const [pages, inqs, sites, groups, indexDays] = await Promise.all([
    db.select({ status: t.pages.status, n: sql<number>`count(*)::int` }).from(t.pages).where(eq(t.pages.partnerId, partnerId)).groupBy(t.pages.status),
    db.select().from(t.inquiries).where(eq(t.inquiries.partnerId, partnerId)),
    db.select().from(t.sites).where(and(eq(t.sites.partnerId, partnerId), eq(t.sites.status, '발행됨'))).orderBy(desc(t.sites.workedAt)).limit(4),
    photoGroups(partnerId),
    getSetting<number>('index_days', 23)
  ]);
  const total = pages.reduce((a, r) => a + r.n, 0);
  const indexed = pages.find((r) => r.status === '색인 확인')?.n ?? 0;
  /* 새는 구간 (본인 아님 제외): 문의 → 상담 → 견적 → 계약 */
  const lv = (s: string) => INQ_ORDER.indexOf(s as never);
  const valid = inqs.filter((q) => q.verify !== '본인 아님');
  const c = [valid.length, valid.filter((q) => lv(q.status) >= 1).length, valid.filter((q) => lv(q.status) >= 2).length, valid.filter((q) => lv(q.status) >= 3).length];
  const stalls = [c[0] - c[1], c[1] - c[2], c[2] - c[3]];
  const mx = stalls.indexOf(Math.max(...stalls));
  const labels = ['문의', '상담', '견적', '계약'];
  return {
    pages: { total, indexed, waiting: total - indexed }, indexDays,
    month: { inquiries: valid.length, contracts: c[3], amount: valid.filter((q) => lv(q.status) >= 3).reduce((a, q) => a + (q.amount ?? 0), 0) },
    funnel: labels.map((label, i) => ({ label, n: c[i], pct: Math.max(2, (c[i] / (c[0] || 1)) * 100), stall: i === mx })),
    stall: { step: labels[mx], n: stalls[mx] },
    needs: inqs.filter((q) => q.needsResult).length,
    newPhotos: groups.reduce((a, g) => a + g.photos.length, 0),
    sites
  };
}

type DemoSearch = { monthClicks: number; vsPrev: number; chart: [string, ...number[]][]; usage: [string, string, number, [string, string, string][]][] };
async function demoSearch(partnerName: string): Promise<DemoSearch | null> {
  const s = await getSetting<{ search?: Record<string, DemoSearch> } | null>('demo_stats', null);
  return s?.search?.[partnerName] ?? null;
}

/** 검색 노출 (2c): 페이지 · 색인 · 클릭 · 유입 검색어 · 유형별 문의 차트 */
export async function partnerSearch(partnerId: string) {
  const db = await getDb();
  const [[p], pages, queries, indexDays] = await Promise.all([
    db.select({ name: t.partners.name }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1),
    db.select().from(t.pages).where(eq(t.pages.partnerId, partnerId)).orderBy(asc(t.pages.sort)),
    db.select().from(t.pageQueries).where(eq(t.pageQueries.partnerId, partnerId)).orderBy(desc(t.pageQueries.clicks)),
    getSetting<number>('index_days', 23)
  ]);
  const demo = await demoSearch(p.name);
  const indexed = pages.filter((x) => x.status === '색인 확인').length;
  return {
    pages, indexed, waiting: pages.length - indexed, indexDays, queries,
    monthClicks: demo?.monthClicks ?? pages.reduce((a, x) => a + x.visits30d, 0), vsPrev: demo?.vsPrev ?? null,
    chart: (demo?.chart ?? []).map(([mon, ...v]) => ({ mon, v: v as number[] }))
  };
}

/** 만들고 있는 페이지 (2j): 가장 최근 생성 묶음 · 고른 시안 · 배포 진행 · 내 사진이 쓰이는 페이지 */
export async function partnerMaking(partnerId: string) {
  const db = await getDb();
  /* 본사가 미리보기 확인 요청을 보낸 생성만 파트너에게 보임 */
  const [run] = await db.select().from(t.generationRuns).where(and(eq(t.generationRuns.partnerId, partnerId), isNotNull(t.generationRuns.previewRequestedAt))).orderBy(desc(t.generationRuns.createdAt)).limit(1);
  if (!run) return null;
  const [drafts, assigns, items, [p], regionStats, newPhotos] = await Promise.all([
    db.select().from(t.generationDrafts).where(and(eq(t.generationDrafts.runId, run.id), eq(t.generationDrafts.picked, true))).orderBy(asc(t.generationDrafts.label)),
    db.select().from(t.generationAssignments).where(eq(t.generationAssignments.runId, run.id)),
    db.select({ name: t.reviewItems.name, state: t.reviewItems.state }).from(t.reviewItems)
      .innerJoin(t.reviewBundles, eq(t.reviewBundles.id, t.reviewItems.bundleId)).where(eq(t.reviewBundles.partnerId, partnerId)),
    db.select({ name: t.partners.name }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1),
    getSetting<Record<string, { photos: number; sites: number; info: string | null }>>('region_stats', {}),
    photoGroups(partnerId)
  ]);
  const inRun = items.filter((i) => run.regions.includes(i.name));
  const deployed = inRun.filter((i) => i.state === '검수 완료' || i.state === '발행 중 · 수정 대기').length;
  const byCity: Record<string, number> = {};
  for (const r of run.regions) { const c = r.split(' ')[0]; byCity[c] = (byCity[c] ?? 0) + 1; }
  const demo = await demoSearch(p.name);
  const preview = run.regions.find((r) => regionStats[r]?.info) ?? run.regions[0];
  return {
    run, deployed, total: run.regions.length, cities: Object.entries(byCity).map(([c, n]) => `${c} ${n}`).join(' · '),
    drafts: drafts.map((d) => ({ ...d, n: assigns.filter((a) => a.draftLabel === d.label).length })),
    preview: { region: preview, name: preview.split(' ').slice(1).join(' ') || preview, ...(regionStats[preview] ?? { photos: 0, sites: 0, info: '' }) },
    partnerName: p.name, newPhotos: newPhotos.reduce((a, g) => a + g.photos.length, 0),
    usage: (demo?.usage ?? []).map(([site, date, n, pages]) => ({ site, date, n, pages: pages.map(([name, k, st]) => ({ name, k, st })) }))
  };
}
