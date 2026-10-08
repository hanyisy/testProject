'use server';
/* 검수 (3o · 3p · 3q): 묶음 일괄 검수 완료 · 개별 검수 · 공통 본문 수정 — 일괄 작업은 한 건으로 기록돼 되돌릴 수 있음 */
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm, type SessionUser } from '@/lib/auth';
import { isUuid } from '@/lib/partners';

type Snap =
  | { type: 'approve'; states: Record<string, string> }
  | { type: 'body'; body: string[]; states: Record<string, string> };

const who = (u: SessionUser) => `${u.role} ${u.name}`;
const refresh = () => revalidatePath('/admin', 'layout');

async function bundleOf(id: string) {
  const db = await getDb();
  const [b] = await db.select({ b: t.reviewBundles, partner: t.partners.name }).from(t.reviewBundles).innerJoin(t.partners, eq(t.partners.id, t.reviewBundles.partnerId)).where(eq(t.reviewBundles.id, id)).limit(1);
  return { db, b };
}

/** 선택한 페이지 일괄 검수 완료 → 기록 id (토스트에서 되돌리기) */
export async function approveItems(bundleId: string, ids: string[]) {
  const u = await requirePerm('검수');
  if (!isUuid(bundleId) || !ids.every(isUuid)) return { ok: false as const };
  const { db, b } = await bundleOf(bundleId);
  if (!b) return { ok: false as const };
  const items = (await db.select().from(t.reviewItems).where(and(eq(t.reviewItems.bundleId, bundleId), inArray(t.reviewItems.id, ids))))
    .filter((i) => !i.reasons.length && (i.state === '대기' || i.state === '발행 중 · 수정 대기'));
  if (!items.length) return { ok: false as const };
  const snap: Snap = { type: 'approve', states: Object.fromEntries(items.map((i) => [i.id, i.state])) };
  await db.update(t.reviewItems).set({ state: '검수 완료', reviewedAt: new Date() }).where(inArray(t.reviewItems.id, items.map((i) => i.id)));
  /* 연결된 페이지가 있으면 발행 */
  const pageIds = items.map((i) => i.pageId).filter((x): x is string => !!x);
  if (pageIds.length) await db.update(t.pages).set({ status: '발행됨', publishedAt: new Date() }).where(inArray(t.pages.id, pageIds));
  const [h] = await db.insert(t.reviewHistory).values({
    bundleId, bundleLabel: `${b.partner} · ${b.b.kind}`, userId: u.id, who: who(u), what: `일괄 검수 완료 · ${items.length}장`, snapshot: snap, whenText: ''
  }).returning();
  refresh();
  return { ok: true as const, historyId: h.id };
}

/** 개별 검수: 검수 완료 · 발행 안 함 (현장이 없는 페이지는 검수 완료 불가) */
export async function decideItem(itemId: string, decision: 'done' | 'skip') {
  await requirePerm('검수');
  if (!isUuid(itemId)) return;
  const db = await getDb();
  const [i] = await db.select().from(t.reviewItems).where(eq(t.reviewItems.id, itemId)).limit(1);
  if (!i || i.state !== '개별 검수') return;
  if (decision === 'done' && !i.sites) return;
  await db.update(t.reviewItems).set({ state: decision === 'done' ? '검수 완료' : '반려', reviewedAt: new Date() }).where(eq(t.reviewItems.id, itemId));
  if (i.pageId) await db.update(t.pages).set({ status: decision === 'done' ? '발행됨' : '비공개', ...(decision === 'done' ? { publishedAt: new Date() } : {}) }).where(eq(t.pages.id, i.pageId));
  refresh();
}

/** 공통 본문 수정 → 묶음 전체에 반영. 이미 발행된 페이지는 다시 검수할 때까지 기존 내용 유지(발행 중 · 수정 대기) */
export async function saveCommonBody(bundleId: string, text: string) {
  const u = await requirePerm('검수');
  if (!isUuid(bundleId)) return { ok: false as const, error: '묶음을 찾을 수 없어요' };
  const body = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  if (!body.length) return { ok: false as const, error: '본문이 비어 있어요' };
  const { db, b } = await bundleOf(bundleId);
  if (!b) return { ok: false as const, error: '묶음을 찾을 수 없어요' };
  if (body.join('\n\n') === b.b.commonBody.join('\n\n')) return { ok: false as const, error: '바뀐 내용이 없어요' };
  const rows = (await db.select().from(t.reviewItems).where(eq(t.reviewItems.bundleId, bundleId))).filter((i) => !i.reasons.length);
  const snap: Snap = { type: 'body', body: b.b.commonBody, states: Object.fromEntries(rows.map((i) => [i.id, i.state])) };
  await db.update(t.reviewBundles).set({ commonBody: body }).where(eq(t.reviewBundles.id, bundleId));
  for (const i of rows) {
    const live = i.state === '검수 완료' || i.state === '발행 중 · 수정 대기';
    await db.update(t.reviewItems).set({ state: live ? '발행 중 · 수정 대기' : '대기', selected: true }).where(eq(t.reviewItems.id, i.id));
  }
  const [h] = await db.insert(t.reviewHistory).values({
    bundleId, bundleLabel: `${b.partner} · ${b.b.kind}`, userId: u.id, who: who(u), what: `공통 본문 수정 · ${rows.length}장 다시 배포`, snapshot: snap, whenText: ''
  }).returning();
  refresh();
  return { ok: true as const, historyId: h.id };
}

/** 일괄 작업 되돌리기: 기록해 둔 직전 상태로 */
export async function undoHistory(historyId: string) {
  await requirePerm('검수');
  if (!isUuid(historyId)) return;
  const db = await getDb();
  const [h] = await db.select().from(t.reviewHistory).where(eq(t.reviewHistory.id, historyId)).limit(1);
  if (!h || h.reverted) return;
  const snap = h.snapshot as Snap | null;
  if (snap) {
    /* 일괄 검수 완료를 되돌리면 발행했던 페이지도 다시 검수 중 */
    if (snap.type === 'approve') {
      const its = await db.select({ pageId: t.reviewItems.pageId }).from(t.reviewItems).where(inArray(t.reviewItems.id, Object.keys(snap.states)));
      const pids = its.map((x) => x.pageId).filter((x): x is string => !!x);
      if (pids.length) await db.update(t.pages).set({ status: '검수 중', publishedAt: null }).where(inArray(t.pages.id, pids));
    }
    for (const [id, state] of Object.entries(snap.states)) {
      await db.update(t.reviewItems).set({ state: state as '대기', ...(snap.type === 'approve' ? { reviewedAt: null } : {}) }).where(eq(t.reviewItems.id, id));
    }
    if (snap.type === 'body' && h.bundleId) await db.update(t.reviewBundles).set({ commonBody: snap.body }).where(eq(t.reviewBundles.id, h.bundleId));
  }
  await db.update(t.reviewHistory).set({ reverted: true }).where(eq(t.reviewHistory.id, historyId));
  refresh();
}
