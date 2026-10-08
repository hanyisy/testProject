/* 파트너 관리자 조회 — 모든 조회는 로그인한 파트너의 partner_id 로만 거름 */
import 'server-only';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
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
