/* 공개 랜딩 · 업체 공개 사이트가 읽는 값 — 응답 모양은 public/data/README.md 그대로 (예전 JSON 파일과 같음) */
import 'server-only';
import { asc, eq, ne } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting, occupancy } from './admin';

export type LandingValues = {
  industries: number | null; pages: number | null; monthlyPages: number | null; fixDays: number | null; indexDays: number | null;
  business: { ceo: string; bizNo: string; address: string; email: string; phone: string };
};
export const EMPTY_VALUES: LandingValues = { industries: null, pages: null, monthlyPages: null, fixDays: null, indexDays: null, business: { ceo: '', bizNo: '', address: '', email: '', phone: '' } };
export const CAPTURE_INDUSTRIES = ['철거', '입주청소', '인테리어', '바닥 시공', '기타'] as const;

export const landingValues = () => getSetting<LandingValues>('landing_values', EMPTY_VALUES);

/** 실제 검색 화면 캡처 — 랜딩에는 보이게 한 것만, 관리 화면은 전부 */
export async function captures(all = false) {
  const db = await getDb();
  const rows = await db.select({ c: t.landingCaptures, partner: t.partners.name }).from(t.landingCaptures)
    .leftJoin(t.partners, eq(t.partners.id, t.landingCaptures.partnerId)).orderBy(asc(t.landingCaptures.sort), asc(t.landingCaptures.createdAt));
  return rows.filter(({ c }) => all || c.visible).map(({ c, partner }) => ({
    id: c.id, image: `/media/${c.imageKey}`, query: c.query, industry: c.industry, partner: partner ?? '', partnerId: c.partnerId,
    capturedAt: c.capturedOn, visible: c.visible, order: c.sort, blur: c.blur
  }));
}

/** 업체 공개 사이트 머리 · 바닥 정보 (종료된 업체는 빠짐) */
export async function partnerSites() {
  const db = await getDb();
  const [rows, regions] = await Promise.all([
    db.select().from(t.partners).where(ne(t.partners.status, '종료')).orderBy(asc(t.partners.createdAt)),
    db.select().from(t.partnerRegions).orderBy(asc(t.partnerRegions.sort))
  ]);
  return rows.map((p) => {
    const rs = regions.filter((r) => r.partnerId === p.id).map((r) => r.region);
    const prov = rs[0]?.split(' ')[0];
    const area = rs.every((r) => r.split(' ')[0] === prov) && rs.length > 1 && ['서울', '인천', '부산', '대구', '광주', '대전', '울산'].includes(prov)
      ? `${prov} ${rs.map((r) => r.split(' ').slice(1).join(' ')).join(' · ')}` : rs.map((r) => r.split(' ').slice(-1)[0]).join(' · ');
    return { slug: p.slug, name: p.name, mark: p.mark ?? p.name.slice(0, 1), brand: p.brandColor ?? '#2F6B57', area, phone: p.tel ?? '', business: { ceo: p.ceo ?? '', bizNo: p.bizRegNo ?? '', address: p.address ?? '' } };
  });
}

/** 랜딩 업종·지역 확인: 이미 운영 · 준비 중인 업종×지역 */
export async function takenMap() {
  const occ = await occupancy();
  return Object.fromEntries(Object.entries(occ).map(([ind, regs]) => [ind, Object.keys(regs)]));
}

export async function partnerBySlug(slug: string) {
  const db = await getDb();
  const [p] = await db.select({ status: t.partners.status }).from(t.partners).where(eq(t.partners.slug, slug)).limit(1);
  return p ?? null;
}
