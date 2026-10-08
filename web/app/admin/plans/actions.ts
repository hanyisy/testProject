'use server';
/* 요금제 (3i): 이름 · 제작비 · 월 관리비 · 포함 기능 기본값 저장, 요금제 추가 — 최고 관리자만 */
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import type { Features } from '@/db/schema';
import { requirePerm } from '@/lib/auth';
import { BLOG_MODES } from '@/lib/constants';
import { isUuid } from '@/lib/partners';

export type PlanInput = { name: string; setupFee: number; monthlyFee: number; features: Features };

export async function savePlan(id: string, p: PlanInput) {
  const u = await requirePerm('요금제 편집');
  if (!isUuid(id)) return { ok: false as const, error: '요금제를 찾을 수 없어요' };
  const name = p.name.trim();
  if (!name) return { ok: false as const, error: '이름을 입력해 주세요' };
  if (!BLOG_MODES.includes(p.features.blog)) return { ok: false as const, error: '블로그 값을 확인해 주세요' };
  const db = await getDb();
  const [dup] = await db.select({ id: t.plans.id }).from(t.plans).where(and(eq(t.plans.name, name), ne(t.plans.id, id))).limit(1);
  if (dup) return { ok: false as const, error: '같은 이름의 요금제가 있어요' };
  const f = p.features;
  await db.update(t.plans).set({
    name, setupFee: Math.max(0, Math.round(p.setupFee)), monthlyFee: Math.max(0, Math.round(p.monthlyFee)),
    defaultFeatures: { alim: !!f.alim, blog: f.blog, place: !!f.place, ml: !!f.ml, sheet: !!f.sheet }, updatedAt: new Date()
  }).where(eq(t.plans.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '요금제 저장', targetType: 'plan', targetId: id, detail: { name } });
  revalidatePath('/admin/plans');
  return { ok: true as const };
}

export async function addPlan() {
  const u = await requirePerm('요금제 편집');
  const db = await getDb();
  const rows = await db.select({ name: t.plans.name, sort: t.plans.sort }).from(t.plans);
  let n = 1;
  const nameOf = (k: number) => `새 요금제${k > 1 ? ' ' + k : ''}`;
  while (rows.some((x) => x.name === nameOf(n))) n++;
  const [p] = await db.insert(t.plans).values({
    name: nameOf(n), setupFee: 0, monthlyFee: 0, sort: Math.max(0, ...rows.map((x) => x.sort)) + 1,
    defaultFeatures: { alim: false, blog: '꺼짐', place: false, ml: false, sheet: false }
  }).returning();
  await db.insert(t.auditLogs).values({ userId: u.id, action: '요금제 추가', targetType: 'plan', targetId: p.id });
  revalidatePath('/admin/plans');
}
