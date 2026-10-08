/* 검수 (3o · 3p · 3q) — 같은 뼈대 페이지 묶음: 공통 본문 한 번 + 페이지마다 다른 칸 */
import 'server-only';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from './admin';
import { today } from './config';
import { isUuid } from './partners';

export type Item = typeof t.reviewItems.$inferSelect;
export const PENDING: Item['state'][] = ['대기', '발행 중 · 수정 대기'];
export const isPending = (i: Item) => PENDING.includes(i.state);
export const TOKENS = ['지역명', '지역 정보', '현장 수', '사진 수'] as const;
export const REASON_CHIP: Record<string, string> = { '고유 내용 부족': 'red', '사진 부족': 'warn', '점검 경고': 'red' };

/** 본문 문단을 {칸}과 글로 나눔 — row 가 있으면 칸을 그 페이지 값으로 채움 */
export function segs(p: string, row?: Pick<Item, 'name' | 'info' | 'sites' | 'photos'>) {
  return p.split(/(\{[^}]+\})/).filter(Boolean).map((s) => {
    const m = s.match(/^\{(.+)\}$/);
    if (!m) return { t: s, tok: false };
    const v = row ? ({ '지역명': row.name, '지역 정보': row.info, '현장 수': String(row.sites), '사진 수': String(row.photos) } as Record<string, string>)[m[1]] : undefined;
    return { t: v ?? m[1], tok: true };
  });
}

const kstDay = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);
/** "10월 6일" → 2026-10-06 (기준 연도는 시안 기준일) */
const mdToDate = (s: string, year: string) => {
  const m = s.match(/(\d+)월\s*(\d+)일/);
  return m ? `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
};

export async function reviewList() {
  const db = await getDb();
  const [bundles, items, history, minUnique, minPhotos, day] = await Promise.all([
    db.select({ b: t.reviewBundles, partner: t.partners.name }).from(t.reviewBundles).innerJoin(t.partners, eq(t.partners.id, t.reviewBundles.partnerId)).orderBy(asc(t.reviewBundles.createdAt)),
    db.select().from(t.reviewItems).orderBy(asc(t.reviewItems.sort)),
    db.select({ h: t.reviewHistory, name: t.users.name, role: t.users.role }).from(t.reviewHistory).leftJoin(t.users, eq(t.users.id, t.reviewHistory.userId)).orderBy(desc(t.reviewHistory.createdAt)),
    getSetting<number>('review_min_unique', 35),
    getSetting<number>('review_min_photos', 3),
    today()
  ]);
  const realToday = kstDay(new Date());
  const rows = bundles.map(({ b, partner }) => {
    const its = items.filter((i) => i.bundleId === b.id);
    const inBundle = its.filter((i) => !i.reasons.length);
    const ex = its.filter((i) => i.reasons.length);
    const pend = inBundle.filter(isPending).length;
    return {
      ...b, partner, total: inBundle.length, pend, done: inBundle.length - pend, ind: ex.filter((i) => i.state === '개별 검수').length,
      createdDate: mdToDate(b.createdOn, day.slice(0, 4))
    };
  });
  const doneToday = items.filter((i) => i.reviewedAt && kstDay(i.reviewedAt) === realToday && i.state === '검수 완료').length;
  const batchToday = history.filter(({ h }) => !h.reverted && kstDay(h.createdAt) === realToday && (h.snapshot as { type?: string } | null)?.type === 'approve').length;
  return {
    bundles: rows, minUnique, minPhotos, day,
    stats: {
      bundleWait: rows.filter((r) => r.pend > 0).length,
      partnerWait: new Set(rows.filter((r) => r.pend > 0).map((r) => r.partner)).size,
      pageWait: rows.reduce((a, r) => a + r.pend, 0),
      transWait: rows.filter((r) => r.type === '번역').reduce((a, r) => a + r.pend, 0),
      indWait: rows.reduce((a, r) => a + r.ind, 0),
      doneToday, batchToday
    },
    history: history.map(({ h, name, role }) => ({
      ...h, whoLabel: name ? `${role} ${name}` : h.who, day: h.whenText && h.whenText !== '방금' ? '' : kstDay(h.createdAt)
    }))
  };
}

export async function reviewBundle(id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [row] = await db.select({ b: t.reviewBundles, partner: t.partners.name }).from(t.reviewBundles).innerJoin(t.partners, eq(t.partners.id, t.reviewBundles.partnerId)).where(eq(t.reviewBundles.id, id)).limit(1);
  if (!row) return null;
  const [items, minUnique] = await Promise.all([
    db.select().from(t.reviewItems).where(eq(t.reviewItems.bundleId, id)).orderBy(asc(t.reviewItems.sort)),
    getSetting<number>('review_min_unique', 35)
  ]);
  const rows = items.filter((i) => !i.reasons.length);
  const ex = items.filter((i) => i.reasons.length);
  return { ...row.b, partner: row.partner, rows, ex, minUnique, pend: rows.filter(isPending).length };
}

export async function itemsById(ids: string[]) {
  const db = await getDb();
  return ids.length ? db.select().from(t.reviewItems).where(inArray(t.reviewItems.id, ids)) : [];
}
