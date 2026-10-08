/* 본사 어드민 · 파트너 조회 */
import 'server-only';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting, occupancy, type DemoStats } from './admin';
import { today } from './config';
import { rel } from './format';

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);

/** 서울 서초 · 서울 강남 → "서울 서초·강남" (시안 표기) */
export function regionText(regions: string[]) {
  const groups: [string, string[]][] = [];
  for (const r of regions) {
    const [a, ...rest] = r.split(' ');
    const g = groups.find(([k]) => k === a);
    if (g && rest.length) g[1].push(rest.join(' ')); else groups.push([a, rest.length ? [rest.join(' ')] : []]);
  }
  return groups.map(([k, v]) => (v.length ? `${k} ${v.join('·')}` : k)).join(' · ');
}

/** 파트너 숫자 — 파트너 화면과 같은 기준으로 DB에서 셈 (어드민 · 파트너가 같은 숫자를 보게)
 *  발행 페이지 = 손님에게 보이는 페이지 · 이번 달 문의 = 기준일의 달에 들어온 문의(본인 아님 제외) · 새 사진 = 현장에 아직 안 묶인 사진 */
export async function partnerCounts() {
  const db = await getDb();
  const month = (await today()).slice(0, 7);
  const LIVE_SQL = sql`${t.pages.status} in ('발행됨', '색인 요청', '색인 확인')`;
  const [pages, inqs, photos, sites] = await Promise.all([
    db.select({ id: t.pages.partnerId, n: sql<number>`count(*)::int`, indexed: sql<number>`count(*) filter (where ${t.pages.status} = '색인 확인')::int` }).from(t.pages).where(LIVE_SQL).groupBy(t.pages.partnerId),
    db.select({ id: t.inquiries.partnerId, n: sql<number>`count(*)::int` }).from(t.inquiries)
      .where(and(ne(t.inquiries.verify, '본인 아님'), sql`to_char(${t.inquiries.receivedAt} at time zone 'Asia/Seoul', 'YYYY-MM') = ${month}`)).groupBy(t.inquiries.partnerId),
    db.select({ id: t.photos.partnerId, n: sql<number>`count(*) filter (where ${t.photos.siteId} is null)::int` }).from(t.photos).groupBy(t.photos.partnerId),
    db.select({ id: t.sites.partnerId, n: sql<number>`count(*)::int`, photos: sql<number>`coalesce(sum(${t.sites.photoCount}),0)::int` }).from(t.sites).where(eq(t.sites.status, '발행됨')).groupBy(t.sites.partnerId)
  ]);
  return (id: string) => {
    const pg = pages.find((x) => x.id === id);
    const st = sites.find((x) => x.id === id);
    return { pages: pg?.n ?? 0, indexed: pg?.indexed ?? 0, monthInquiries: inqs.find((x) => x.id === id)?.n ?? 0, newPhotos: photos.find((x) => x.id === id)?.n ?? 0, sites: st?.n ?? 0, photos: st?.photos ?? 0 };
  };
}

export async function partnerList() {
  const db = await getDb();
  const [rows, regions, count] = await Promise.all([
    db.select({ p: t.partners, industry: t.industries.name, plan: t.plans.name })
      .from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).innerJoin(t.plans, eq(t.plans.id, t.partners.planId))
      .orderBy(asc(t.partners.createdAt)),
    db.select().from(t.partnerRegions).orderBy(asc(t.partnerRegions.sort)),
    partnerCounts()
  ]);
  return rows.map(({ p, industry, plan }) => {
    const c = count(p.id);
    return {
      ...p, industry, plan, regions: regions.filter((r) => r.partnerId === p.id).map((r) => r.region),
      pages: c.pages, indexPct: c.pages ? Math.round((c.indexed / c.pages) * 100) : null, inquiries: p.status === '운영 중' ? c.monthInquiries : null
    };
  });
}

export async function partnerDetail(id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [row] = await db.select({ p: t.partners, industry: t.industries, plan: t.plans })
    .from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).innerJoin(t.plans, eq(t.plans.id, t.partners.planId))
    .where(eq(t.partners.id, id)).limit(1);
  if (!row) return null;
  const [regions, [features], [account], count, day] = await Promise.all([
    db.select().from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, id)).orderBy(asc(t.partnerRegions.sort)),
    db.select().from(t.partnerFeatures).where(eq(t.partnerFeatures.partnerId, id)).limit(1),
    db.select().from(t.users).where(and(eq(t.users.partnerId, id), eq(t.users.kind, 'partner'))).limit(1),
    partnerCounts(),
    today()
  ]);
  const c = count(id);
  return {
    partner: row.p, industry: row.industry, plan: row.plan, features: features!, account,
    regions: regions.map((r) => r.region),
    pages: c.pages, indexPct: c.pages ? Math.round((c.indexed / c.pages) * 100) : null,
    photos: c.photos, sites: c.sites,
    newPhotos: c.newPhotos, syncedAgo: row.p.driveSyncedAt ? rel(row.p.driveSyncedAt, day) : null, lastLoginText: null as string | null
  };
}

/** 이 업종·지역을 다른 파트너가 쓰고 있으면 그 이름 */
export async function regionTakenBy(industryName: string, region: string, exceptPartnerId?: string) {
  const occ = await occupancy();
  const who = occ[industryName]?.[region];
  if (!who) return null;
  if (exceptPartnerId) {
    const db = await getDb();
    const [mine] = await db.select({ name: t.partners.name }).from(t.partners).where(eq(t.partners.id, exceptPartnerId)).limit(1);
    if (mine && who.startsWith(mine.name)) return null;
  }
  return who;
}

export async function scopeLogs(partnerId: string) {
  const db = await getDb();
  return db.select().from(t.scopeLogs).where(eq(t.scopeLogs.partnerId, partnerId)).orderBy(desc(t.scopeLogs.createdAt));
}

export async function domainOf(partnerId: string) {
  const db = await getDb();
  const [d] = await db.select().from(t.domains).where(eq(t.domains.partnerId, partnerId)).limit(1);
  return d ?? null;
}

/** 청구 내역 + 세금계산서 상태 (요청 기록이 없으면 결제 방식으로 표시) */
export async function ledger(partnerId: string) {
  const db = await getDb();
  const rows = await db.select({ c: t.charges, tax: t.taxRequests.state }).from(t.charges)
    .leftJoin(t.taxRequests, eq(t.taxRequests.chargeId, t.charges.id))
    .where(eq(t.charges.partnerId, partnerId)).orderBy(desc(t.charges.billedOn));
  return rows.map(({ c, tax }) => ({
    ...c,
    tax: tax ?? (c.state === '면제' || c.amount === 0 ? '해당 없음' : c.method === '온라인 결제' ? (c.state === '결제 완료' ? '카드 영수증' : '해당 없음') : '요청 전')
  }));
}

export async function industriesAvailable() {
  const db = await getDb();
  return db.select().from(t.industries).where(ne(t.industries.status, '보관')).orderBy(asc(t.industries.sort));
}

export async function plansAll() {
  const db = await getDb();
  return db.select().from(t.plans).orderBy(asc(t.plans.sort));
}

export async function loginIdTaken(loginId: string) {
  const db = await getDb();
  const [u] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.loginId, loginId)).limit(1);
  return !!u;
}

