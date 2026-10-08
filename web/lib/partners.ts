/* 본사 어드민 · 파트너 조회 */
import 'server-only';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting, occupancy, type DemoStats } from './admin';

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

export async function partnerList() {
  const db = await getDb();
  const [rows, regions, stats] = await Promise.all([
    db.select({ p: t.partners, industry: t.industries.name, plan: t.plans.name })
      .from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).innerJoin(t.plans, eq(t.plans.id, t.partners.planId))
      .orderBy(asc(t.partners.createdAt)),
    db.select().from(t.partnerRegions).orderBy(asc(t.partnerRegions.sort)),
    getSetting<DemoStats | null>('demo_stats', null)
  ]);
  return rows.map(({ p, industry, plan }) => {
    const s = stats?.partners[p.name];
    const pages = s?.pages ?? 0, indexed = s?.indexed ?? 0;
    return {
      ...p, industry, plan, regions: regions.filter((r) => r.partnerId === p.id).map((r) => r.region),
      pages, indexPct: pages ? Math.round((indexed / pages) * 100) : null, inquiries: p.status === '운영 중' ? s?.inquiries ?? 0 : null
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
  const [regions, [features], [account], stats, [photoCount], [siteCount]] = await Promise.all([
    db.select().from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, id)).orderBy(asc(t.partnerRegions.sort)),
    db.select().from(t.partnerFeatures).where(eq(t.partnerFeatures.partnerId, id)).limit(1),
    db.select().from(t.users).where(and(eq(t.users.partnerId, id), eq(t.users.kind, 'partner'))).limit(1),
    getSetting<DemoStats | null>('demo_stats', null),
    db.select({ n: sql<number>`count(*)::int` }).from(t.photos).where(eq(t.photos.partnerId, id)),
    db.select({ n: sql<number>`count(*)::int`, photos: sql<number>`coalesce(sum(${t.sites.photoCount}),0)::int` }).from(t.sites).where(eq(t.sites.partnerId, id))
  ]);
  const s = stats?.partners[row.p.name] as (DemoStats['partners'][string] & { photos?: number; sites?: number; newPhotos?: number; lastLogin?: string; syncedAgo?: string }) | undefined;
  const pages = s?.pages ?? 0, indexed = s?.indexed ?? 0;
  return {
    partner: row.p, industry: row.industry, plan: row.plan, features: features!, account,
    regions: regions.map((r) => r.region),
    pages, indexPct: pages ? Math.round((indexed / pages) * 100) : null,
    photos: s?.photos ?? siteCount.photos ?? photoCount.n, sites: s?.sites ?? siteCount.n,
    newPhotos: s?.newPhotos ?? 0, syncedAgo: s?.syncedAgo ?? null, lastLoginText: s?.lastLogin ?? null
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

