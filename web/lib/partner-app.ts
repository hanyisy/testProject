/* 파트너 관리자 조회 — 모든 조회는 로그인한 파트너의 partner_id 로만 거름 */
import 'server-only';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';
import { regionText } from './partners';
import { today } from './config';
import { LIVE } from './site';
import { notifyPartner } from './adapters/alimtalk';

export const INQ_ORDER = ['신규', '상담', '견적', '계약', '완료'] as const;

/** 결과 입력 필요: 견적 단계에 7일 넘게 머문 문의 (견적으로 바꾼 날 = 진행 기록, 없으면 접수일)
 * 새로 해당되면 표시하고 "결과 입력 알림"을 보냄 · 상태를 바꾸면(setInquiryStatus) 풀림 */
export const RESULT_DAYS = 7;
export async function syncNeedsResult(partnerId: string) {
  const db = await getDb();
  const quoted = await db.select({ id: t.inquiries.id, title: t.inquiries.title, at: t.inquiries.receivedAt }).from(t.inquiries)
    .where(and(eq(t.inquiries.partnerId, partnerId), eq(t.inquiries.status, '견적'), eq(t.inquiries.needsResult, false)));
  if (!quoted.length) return;
  const day = await today();
  const logs = await db.select({ inq: t.inquiryLogs.inquiryId, at: t.inquiryLogs.createdAt }).from(t.inquiryLogs)
    .where(and(inArray(t.inquiryLogs.inquiryId, quoted.map((q) => q.id)), eq(t.inquiryLogs.kind, '상태'), sql`${t.inquiryLogs.text} like '%→ 견적%'`));
  const kst = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);
  const dayN = (s: string) => Date.parse(s + 'T00:00:00Z') / 86400000;
  for (const q of quoted) {
    const since = logs.filter((l) => l.inq === q.id).map((l) => l.at).sort((a, b) => +b - +a)[0] ?? q.at;
    if (dayN(day) - dayN(kst(since)) < RESULT_DAYS) continue;
    await db.update(t.inquiries).set({ needsResult: true }).where(eq(t.inquiries.id, q.id));
    await notifyPartner(partnerId, 'result', `견적 후 ${RESULT_DAYS}일이 지났어요 · ${q.title} 결과를 입력해 주세요`);
  }
}

/** 틀(사이드바 · 모바일 머리)에 필요한 것: 업체명 · 지역 · 결과 입력 필요 수 · 블로그 잠금 */
export async function partnerFrame(partnerId: string) {
  await syncNeedsResult(partnerId);
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
  const [pages, inqs, sites, groups, indexDays, day, [me]] = await Promise.all([
    db.select({ status: t.pages.status, n: sql<number>`count(*)::int` }).from(t.pages).where(and(eq(t.pages.partnerId, partnerId), inArray(t.pages.status, LIVE))).groupBy(t.pages.status),
    db.select().from(t.inquiries).where(eq(t.inquiries.partnerId, partnerId)),
    db.select().from(t.sites).where(and(eq(t.sites.partnerId, partnerId), eq(t.sites.status, '발행됨'))).orderBy(desc(t.sites.workedAt)).limit(4),
    photoGroups(partnerId),
    getSetting<number>('index_days', 23),
    today(),
    db.select({ slug: t.partners.slug }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1)
  ]);
  /* 발행 페이지 = 손님에게 보이는 페이지만 (작성 중 · 검수 중 · 비공개 제외) */
  const total = pages.reduce((a, r) => a + r.n, 0);
  const indexed = pages.find((r) => r.status === '색인 확인')?.n ?? 0;
  /* 새는 구간 (본인 아님 제외): 문의 → 상담 → 견적 → 계약 — 지금 진행 중인 문의 전체 */
  const valid = inqs.filter((q) => q.verify !== '본인 아님');
  /* 무산은 무산되기 전에 다다른 단계까지 센 것으로 (진행 기록 "견적 → 무산"의 앞 단계) */
  const lostIds = valid.filter((q) => q.status === '무산').map((q) => q.id);
  const lostLogs = lostIds.length ? await db.select({ inq: t.inquiryLogs.inquiryId, text: t.inquiryLogs.text }).from(t.inquiryLogs)
    .where(and(inArray(t.inquiryLogs.inquiryId, lostIds), eq(t.inquiryLogs.kind, '상태'), sql`${t.inquiryLogs.text} like '%→ 무산%'`)) : [];
  const reached = (q: (typeof valid)[number]) => {
    if (q.status !== '무산') return INQ_ORDER.indexOf(q.status as never);
    const prev = lostLogs.find((l) => l.inq === q.id)?.text.split('→')[0].trim() ?? '신규';
    return Math.max(0, INQ_ORDER.indexOf(prev as never));
  };
  const lv = (s: string) => INQ_ORDER.indexOf(s as never);
  const c = [valid.length, valid.filter((q) => reached(q) >= 1).length, valid.filter((q) => reached(q) >= 2).length, valid.filter((q) => reached(q) >= 3).length];
  const stalls = [c[0] - c[1], c[1] - c[2], c[2] - c[3]];
  const mx = stalls.indexOf(Math.max(...stalls));
  const labels = ['문의', '상담', '견적', '계약'];
  /* 이번 달 성과: 이번 달(기준일의 달)에 들어온 문의만 */
  const ym = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d).slice(0, 7);
  const monthQ = valid.filter((q) => ym(q.receivedAt) === day.slice(0, 7));
  /* 최근 발행 현장 대표 사진: 공개로 고른 사진 중 작업 후 → 첫 장 (사람 사진 · 자리표시 제외) */
  const covers = sites.length ? await db.select().from(t.photos).where(and(inArray(t.photos.siteId, sites.map((x) => x.id)), eq(t.photos.partnerPublic, true), eq(t.photos.hasPerson, false))).orderBy(asc(t.photos.sort)) : [];
  const coverOf = (id: string) => { const ps = covers.filter((p) => p.siteId === id && !p.fileKey.startsWith('demo/')); return (ps.find((p) => p.shot === '후') ?? ps[0]) ?? null; };
  return {
    slug: me.slug,
    pages: { total, indexed, waiting: total - indexed }, indexDays,
    month: { inquiries: monthQ.length, contracts: monthQ.filter((q) => lv(q.status) >= 3).length, amount: monthQ.filter((q) => lv(q.status) >= 3).reduce((a, q) => a + (q.amount ?? 0), 0) },
    funnel: labels.map((label, i) => ({ label, n: c[i], pct: Math.max(2, (c[i] / (c[0] || 1)) * 100), stall: i === mx })),
    stall: { step: labels[mx], n: stalls[mx] },
    needs: inqs.filter((q) => q.needsResult).length,
    newPhotos: groups.reduce((a, g) => a + g.photos.length, 0),
    sites: sites.map((x) => { const cv = coverOf(x.id); return { ...x, cover: cv ? { src: `/files/${cv.fileKey}`, alt: cv.caption ?? cv.label ?? x.title } : null }; })
  };
}

type DemoSearch = { monthClicks: number; vsPrev: number; chart: [string, ...number[]][]; usage: [string, string, number, [string, string, string][]][] };
/* 검색 클릭 · 검색어 차트는 검색엔진 자료(데모) — 업체 주소(slug)로 찾음 (상호를 바꿔도 그대로) */
async function demoSearch(slug: string): Promise<DemoSearch | null> {
  const s = await getSetting<{ search?: Record<string, DemoSearch> } | null>('demo_stats', null);
  return s?.search?.[slug] ?? null;
}

/** 검색 노출 (2c): 페이지 · 색인 · 클릭 · 유입 검색어 · 유형별 문의 차트 */
export async function partnerSearch(partnerId: string) {
  const db = await getDb();
  const [[p], pages, queries, indexDays] = await Promise.all([
    db.select({ name: t.partners.name, slug: t.partners.slug }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1),
    db.select().from(t.pages).where(and(eq(t.pages.partnerId, partnerId), inArray(t.pages.status, LIVE))).orderBy(asc(t.pages.sort)),
    db.select().from(t.pageQueries).where(eq(t.pageQueries.partnerId, partnerId)).orderBy(desc(t.pageQueries.clicks)),
    getSetting<number>('index_days', 23)
  ]);
  const demo = await demoSearch(p.slug);
  const indexed = pages.filter((x) => x.status === '색인 확인').length;
  return {
    slug: p.slug, pages, indexed, waiting: pages.length - indexed, indexDays, queries,
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
  const [drafts, assigns, runPages, [p], regionStats, newPhotos] = await Promise.all([
    db.select().from(t.generationDrafts).where(and(eq(t.generationDrafts.runId, run.id), eq(t.generationDrafts.picked, true))).orderBy(asc(t.generationDrafts.label)),
    db.select().from(t.generationAssignments).where(eq(t.generationAssignments.runId, run.id)),
    db.select({ status: t.pages.status, path: t.pages.path, label: t.pages.draftLabel }).from(t.pages).where(eq(t.pages.runId, run.id)),
    db.select({ name: t.partners.name, slug: t.partners.slug }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1),
    getSetting<Record<string, { photos: number; sites: number; info: string | null }>>('region_stats', {}),
    photoGroups(partnerId)
  ]);
  /* 배포 = 이 생성으로 만든 페이지 중 손님에게 보이는 것 · 단계는 생성 상태에서 */
  const deployed = runPages.filter((x) => LIVE.includes(x.status)).length;
  const steps = { drafted: run.status !== '생성 중', requested: !!run.previewRequestedAt, inReview: run.status === '검수로 넘김' };
  /* 시안마다 실제 미리보기 한 장 (내 사이트 · 업체 계정은 공개 전 페이지도 볼 수 있음) */
  const previewOf = (label: string) => { const pg = runPages.find((x) => x.label === label && x.path); return pg ? `/p/${p.slug}/${pg.path!.split('/').map(encodeURIComponent).join('/')}` : null; };
  const byCity: Record<string, number> = {};
  for (const r of run.regions) { const c = r.split(' ')[0]; byCity[c] = (byCity[c] ?? 0) + 1; }
  const demo = await demoSearch(p.slug);
  const preview = run.regions.find((r) => regionStats[r]?.info) ?? run.regions[0];
  return {
    run, deployed, steps, total: runPages.length || run.regions.length, cities: Object.entries(byCity).map(([c, n]) => `${c} ${n}`).join(' · '),
    drafts: drafts.map((d) => ({ ...d, n: assigns.filter((a) => a.draftLabel === d.label).length, href: previewOf(d.label) })),
    preview: { region: preview, name: preview.split(' ').slice(1).join(' ') || preview, ...(regionStats[preview] ?? { photos: 0, sites: 0, info: '' }) },
    partnerName: p.name, newPhotos: newPhotos.reduce((a, g) => a + g.photos.length, 0),
    usage: (demo?.usage ?? []).map(([site, date, n, pages]) => ({ site, date, n, pages: pages.map(([name, k, st]) => ({ name, k, st })) }))
  };
}
