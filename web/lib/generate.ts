/* 페이지 생성 (3r–3x) — 지역 사진 현황 · 시안 · 지역별 배분 · 검수 묶음 만들기 계산
 * 화면 문구 재료는 모두 settings(draft_styles · generation_presets · region_stats · photo_status)에서 읽음 */
import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';
import { runStateWith, type DraftStyle, type RegionStat } from './generate-core';
export { kindOf, workPhrase, autoAssign, uniquePct, type DraftStyle, type RegionStat } from './generate-core';

export type Preset = { faq: string[]; table: { head: string[]; rows: string[][]; note: string } };
export type PhotoStatus = { total: number; usable: number; unconfirmed: number; person: number; byCity: Record<string, number> };

export const PAGE_TYPES = [['지역×작업', '동 단위 지역 × 작업 종류'], ['역 주변', '역 반경 현장 모음'], ['질문', '자주 묻는 질문 답변']] as const;

export async function partnerOptions() {
  const db = await getDb();
  return db.select({ id: t.partners.id, name: t.partners.name, status: t.partners.status }).from(t.partners).orderBy(asc(t.partners.createdAt));
}

/** 파트너 한 곳의 생성 재료: 업종 · 서비스 지역 · 지역(동)별 사진 · 사진 현황 · 업종 항목 */
export async function partnerSource(partnerId: string) {
  const db = await getDb();
  const [[row], regions, stats, photoStatus, order, allPhotos] = await Promise.all([
    db.select({ p: t.partners, industry: t.industries }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).where(eq(t.partners.id, partnerId)).limit(1),
    db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, partnerId)).orderBy(asc(t.partnerRegions.sort)),
    getSetting<Record<string, RegionStat>>('region_stats', {}),
    getSetting<Record<string, PhotoStatus>>('photo_status', {}),
    getSetting<string[]>('region_order', []),
    db.select({ partnerPublic: t.photos.partnerPublic, hasPerson: t.photos.hasPerson, place: t.photos.place, fileKey: t.photos.fileKey }).from(t.photos).where(eq(t.photos.partnerId, partnerId))
  ]);
  if (!row) return null;
  const items = await db.select().from(t.industryItems).where(eq(t.industryItems.industryId, row.industry.id)).orderBy(asc(t.industryItems.sort));
  const cities = regions.map((r) => r.region.split(' ').slice(-1)[0]);
  /* 동 단위 지역: region_stats 키 "춘천 석사동" 중 이 파트너 서비스 지역(시) */
  const groups = cities.map((city) => ({
    city, opts: Object.entries(stats).filter(([k]) => k.startsWith(city + ' ')).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([k, v]) => ({ name: k, dong: k.slice(city.length + 1), ...v }))
  }));
  /* 사진 현황: 시안 합계가 있으면 그것(시안 데모 사진 포함) + 실제로 올라온 사진 · 없으면 실제 사진만 */
  const base = photoStatus[row.p.name];
  const photos = base ? allPhotos.filter((p) => !p.fileKey.startsWith('demo/')) : allPhotos;
  const real = { usable: photos.filter((p) => p.partnerPublic && !p.hasPerson).length, person: photos.filter((p) => p.hasPerson).length };
  const status = {
    total: (base?.total ?? 0) + photos.length,
    usable: (base?.usable ?? 0) + real.usable,
    unconfirmed: (base?.unconfirmed ?? 0) + (photos.length - real.usable - real.person),
    person: (base?.person ?? 0) + real.person,
    byCity: cities.map((c) => ({ city: c, n: (base?.byCity[c] ?? 0) + photos.filter((p) => p.partnerPublic && !p.hasPerson && p.place?.startsWith(c)).length }))
  };
  const works = items.filter((i) => i.group === '대상 유형').map((i) => `${i.label}${row.industry.name.replace(/\s/g, '')}`);
  /* 기본 작업: 이 업체 현장 기록에 가장 많은 작업 */
  const siteWorks = await db.select({ w: t.sites.workType }).from(t.sites).where(eq(t.sites.partnerId, partnerId));
  const freq = (w: string) => siteWorks.filter((x) => x.w === w).length;
  const defaultWork = [...works].sort((a, b) => freq(b) - freq(a))[0];
  return { partner: row.p, industry: row.industry, regions: regions.map((r) => r.region), groups, status, works: works.length ? works : [row.industry.name], defaultWork: defaultWork ?? works[0] ?? row.industry.name, items };
}

export async function runState(runId: string) {
  return runStateWith(await getDb(), runId);
}

export async function latestRuns(partnerId: string) {
  const db = await getDb();
  return db.select().from(t.generationRuns).where(eq(t.generationRuns.partnerId, partnerId)).orderBy(desc(t.generationRuns.createdAt)).limit(5);
}


/** 공통 본문을 이 지역 값으로 채운 글 */
export function fill(body: string[], v: { name: string; info: string | null; sites: number; photos: number }) {
  const map: Record<string, string> = { '지역명': v.name, '지역 정보': v.info ?? '', '현장 수': String(v.sites), '사진 수': String(v.photos) };
  return body.map((p) => p.replace(/\{([^}]+)\}/g, (_, k) => map[k] ?? `{${k}}`)).filter((p) => p.trim());
}

