/* 페이지 생성 (3r–3x) — 지역 사진 현황 · 시안 · 지역별 배분 · 검수 묶음 만들기 계산
 * 화면 문구 재료는 모두 settings(draft_styles · generation_presets · region_stats · photo_status)에서 읽음 */
import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';

export type DraftStyle = { label: string; style: string; desc: string; body: string[] };
export type Preset = { faq: string[]; table: { head: string[]; rows: string[][]; note: string } };
export type RegionStat = { photos: number; sites: number; info: string | null };
export type PhotoStatus = { total: number; usable: number; unconfirmed: number; person: number; byCity: Record<string, number> };

export const PAGE_TYPES = [['지역×작업', '동 단위 지역 × 작업 종류'], ['역 주변', '역 반경 현장 모음'], ['질문', '자주 묻는 질문 답변']] as const;
export const kindOf = (type: string, work: string) => (type === '지역×작업' ? `지역×${work}` : `${type}×${work}`);
/** 지역×상가철거 → 상가 철거 (본문 {작업} 칸) */
export const workPhrase = (work: string, industry: string) => (work.endsWith(industry) && work !== industry ? `${work.slice(0, -industry.length)} ${industry}` : work);

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
  const works = items.filter((i) => i.group === '대상 유형').map((i) => `${i.label}${row.industry.name}`);
  return { partner: row.p, industry: row.industry, regions: regions.map((r) => r.region), groups, status, works: works.length ? works : [row.industry.name], items };
}

export async function runState(runId: string) {
  const db = await getDb();
  const [run] = await db.select().from(t.generationRuns).where(eq(t.generationRuns.id, runId)).limit(1);
  if (!run) return null;
  const [drafts, assigns, styles, stats] = await Promise.all([
    db.select().from(t.generationDrafts).where(eq(t.generationDrafts.runId, runId)).orderBy(asc(t.generationDrafts.label)),
    db.select().from(t.generationAssignments).where(eq(t.generationAssignments.runId, runId)),
    getSetting<DraftStyle[]>('draft_styles', []),
    getSetting<Record<string, RegionStat>>('region_stats', {})
  ]);
  const regions = run.regions.map((name) => {
    const key = name.split(' ').slice(-2).join(' ');
    const s = stats[key] ?? stats[name] ?? { photos: 0, sites: 0, info: null };
    return { name: key, ...s };
  });
  return { run, drafts, assigns, styles, regions };
}

export async function latestRuns(partnerId: string) {
  const db = await getDb();
  return db.select().from(t.generationRuns).where(eq(t.generationRuns.partnerId, partnerId)).orderBy(desc(t.generationRuns.createdAt)).limit(5);
}

/** 기본 배분: 사진 많은 지역부터 고른 시안을 돌아가며 — 시안마다 사진 많은/적은 지역이 고르게 섞임 */
export function autoAssign(regions: { name: string; photos: number }[], picked: string[]) {
  const order = [...regions].sort((a, b) => b.photos - a.photos);
  return Object.fromEntries(order.map((r, i) => [r.name, picked[i % picked.length]]));
}

/** 공통 본문을 이 지역 값으로 채운 글 */
export function fill(body: string[], v: { name: string; info: string | null; sites: number; photos: number }) {
  const map: Record<string, string> = { '지역명': v.name, '지역 정보': v.info ?? '', '현장 수': String(v.sites), '사진 수': String(v.photos) };
  return body.map((p) => p.replace(/\{([^}]+)\}/g, (_, k) => map[k] ?? `{${k}}`)).filter((p) => p.trim());
}

/** 고유 내용 비율: 페이지 글자 중 이 페이지에만 있는 부분의 비율
 * = 본문 칸(지역명 · 지역 정보 · 숫자) + 현장마다 붙는 현장 기록 한 줄 + 사진마다 붙는 설명 */
const SITE_TEXT = 40, PHOTO_TEXT = 4;
export function uniquePct(body: string[], v: { name: string; info: string | null; sites: number; photos: number }) {
  const strip = (s: string) => s.replace(/\s/g, '').length;
  const map: Record<string, string> = { '지역명': v.name, '지역 정보': v.info ?? '', '현장 수': String(v.sites), '사진 수': String(v.photos) };
  let uniq = 0, total = 0;
  for (const p of body) {
    for (const part of p.split(/(\{[^}]+\})/)) {
      const m = part.match(/^\{(.+)\}$/);
      const n = strip(m ? map[m[1]] ?? '' : part);
      total += n;
      if (m) uniq += n;
    }
  }
  const extra = v.sites * SITE_TEXT + v.photos * PHOTO_TEXT;
  return total + extra ? Math.round(((uniq + extra) / (total + extra)) * 100) : 0;
}
