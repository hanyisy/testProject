/* 업체 공개 사이트(/p/{slug}/…) 데이터 — 화면 문구는 모두 데이터(업종 · 업체 콘텐츠 · 현장 · 페이지)에서 옴
 * 시안: design/한결철거 공개 사이트.dc.html (블록 12종을 페이지마다 조합) */
import 'server-only';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';
import { readSession } from './auth';

export type IndustryContent = {
  verb: string; noun: string; hubLead: string; process: [string, string][];
  /** 시안 본문 {작업 방식}에 들어가는 한 문장 */
  method?: string;
  cost: { summary: { k: string; v: string; note: string; example?: boolean }[]; table: { head: string[]; priced: boolean; rows: string[][] }; include: string[]; exclude: string[]; note: string };
  faq: { q: string; a: string }[]; permit: string; cityPermit: string;
  guides: { slug: string; title: string; lead: string; short: string; updated: string; minutes: number; sections: { h: string; p?: string; cost?: boolean; checklist?: string[]; cases?: number }[] }[];
  questions: { slug: string; q: string; tag: string; short: string; a: string; basis: string }[];
};
export type SiteContent = { home: { title: string; lead: string }; placeholder: string; cityInfo: Record<string, string>; stations: { name: string; city: string; radius: string; sites: string[] }[] };
export type Photo = { id: string; caption: string; shot: string | null; src: string | null };
export type SiteRow = typeof t.sites.$inferSelect & { photos: Photo[]; path: string; dong: string; city: string };

export { josa, fill, copula } from './text';

/** 작업 이름 띄우기: 상가철거 → 상가 철거 (업종 이름 앞) */
export const workLabel = (work: string, industry: string) => { const ind = industry.replace(/\s/g, ''); return work.endsWith(ind) && work !== ind ? `${work.slice(0, -ind.length)} ${industry}` : work; };
/** 이 페이지 주소 */
export const href = (slug: string, path = '') => `/p/${slug}${path ? '/' + path.split('/').map(encodeURIComponent).join('/') : ''}`;
const photoSrc = (p: { id: string; fileKey: string; hasPerson: boolean; partnerPublic: boolean }) => (p.fileKey.startsWith('demo/') || p.hasPerson || !p.partnerPublic ? null : `/media/photo/${p.id}`);

/** 공개 상태로 보이는 페이지 (검수 · 발행 전은 미리보기만) */
export const LIVE: t.PageStatus[] = ['발행됨', '색인 요청', '색인 확인'];

export async function siteBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select({ p: t.partners, industry: t.industries }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).where(eq(t.partners.slug, slug)).limit(1);
  if (!row) return null;
  const [regions, ind, content, cityNames, { user }] = await Promise.all([
    db.select().from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, row.p.id)).orderBy(asc(t.partnerRegions.sort)),
    getSetting<Record<string, IndustryContent>>('industry_content', {}),
    getSetting<Record<string, SiteContent>>('site_content', {}),
    getSetting<Record<string, string>>('city_names', {}),
    readSession()
  ]);
  /* 미리보기: 본사 직원 · 그 업체 계정 */
  const canPreview = !!user && (user.kind === 'staff' || user.partnerId === row.p.id);
  const cities = regions.map((r) => r.region.split(' ').slice(-1)[0]);
  const ic = ind[row.industry.code];
  return {
    partner: row.p, industry: row.industry, ic, content: content[slug], cities, cityName: (c: string) => cityNames[c] ?? c, canPreview,
    area: cities.join(' · '),
    vars: (extra: Record<string, string> = {}) => ({ 업체: row.p.name, 업종: row.industry.name, 동사: ic?.verb ?? '작업한', ...extra })
  };
}
export type Site = NonNullable<Awaited<ReturnType<typeof siteBySlug>>>;

/** 현장 기록 (사진 포함, 최근 순) */
export async function sitesOf(partnerId: string, slug: string, opts: { region?: string; city?: string; titles?: string[] } = {}): Promise<SiteRow[]> {
  const db = await getDb();
  let rows = await db.select().from(t.sites).where(and(eq(t.sites.partnerId, partnerId), eq(t.sites.status, '발행됨'))).orderBy(desc(t.sites.workedAt));
  if (opts.region) rows = rows.filter((s) => s.region === opts.region);
  if (opts.city) rows = rows.filter((s) => s.region?.split(' ')[0] === opts.city);
  if (opts.titles) rows = opts.titles.map((x) => rows.find((s) => s.title === x)).filter((x): x is (typeof rows)[number] => !!x);
  const photos = rows.length ? await db.select().from(t.photos).where(inArray(t.photos.siteId, rows.map((s) => s.id))).orderBy(asc(t.photos.sort)) : [];
  return rows.map((s) => {
    const [city, dong] = (s.region ?? '').split(' ');
    return {
      ...s, city, dong: dong ?? '', path: `현장/${s.id.slice(0, 8)}`,
      photos: photos.filter((p) => p.siteId === s.id).map((p) => ({ id: p.id, caption: p.caption ?? p.label ?? '현장 사진', shot: p.shot, src: photoSrc(p) }))
    };
  });
}

export async function pageByPath(partnerId: string, path: string) {
  const db = await getDb();
  /* 같은 주소를 다시 생성했으면 최근 것 */
  const [pg] = await db.select().from(t.pages).where(and(eq(t.pages.partnerId, partnerId), eq(t.pages.path, path))).orderBy(desc(t.pages.createdAt)).limit(1);
  return pg ?? null;
}

export async function livePages(partnerId: string) {
  const db = await getDb();
  const rows = await db.select().from(t.pages).where(and(eq(t.pages.partnerId, partnerId), inArray(t.pages.status, LIVE))).orderBy(desc(t.pages.createdAt));
  /* 같은 주소를 다시 발행했으면 최근 것 하나만 (pageByPath와 같은 기준 · 링크가 두 번 나오지 않게) */
  const seen = new Set<string>();
  return rows.filter((p) => !p.path || (!seen.has(p.path) && !!seen.add(p.path)));
}

/** 생성된 지역 페이지의 공통 본문 (검수 묶음) */
export async function generatedBody(pageId: string) {
  const db = await getDb();
  const [row] = await db.select({ i: t.reviewItems, b: t.reviewBundles }).from(t.reviewItems).innerJoin(t.reviewBundles, eq(t.reviewBundles.id, t.reviewItems.bundleId)).where(eq(t.reviewItems.pageId, pageId)).limit(1);
  return row ?? null;
}

export async function regionStat(key: string) {
  const s = await getSetting<Record<string, { photos: number; sites: number; info: string | null }>>('region_stats', {});
  return s[key] ?? null;
}

export const dotDate = (d: string | null) => (d ? d.replaceAll('-', '.') : '');
