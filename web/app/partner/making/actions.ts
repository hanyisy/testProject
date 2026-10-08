'use server';
/* 만들고 있는 페이지 — 파트너는 시안에 좋아요 · 의견만 남김 (생성 · 배포는 본사) */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';

async function ownRun(runId: string, partnerId: string) {
  const db = await getDb();
  const [r] = await db.select({ id: t.generationRuns.id }).from(t.generationRuns)
    .where(and(eq(t.generationRuns.id, runId), eq(t.generationRuns.partnerId, partnerId))).limit(1);
  return !!r;
}

export async function toggleDraftLike(runId: string, label: string) {
  const user = await requirePartner();
  if (!(await ownRun(runId, user.partnerId))) return;
  const db = await getDb();
  const [d] = await db.select().from(t.generationDrafts).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label))).limit(1);
  if (!d) return;
  await db.update(t.generationDrafts).set({ partnerLike: !d.partnerLike }).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label)));
  revalidatePath('/partner/making');
}

export async function saveDraftNote(runId: string, label: string, note: string) {
  const user = await requirePartner();
  if (!(await ownRun(runId, user.partnerId))) return;
  const db = await getDb();
  await db.update(t.generationDrafts).set({ partnerNote: note.trim().slice(0, 500) }).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label)));
  revalidatePath('/partner/making');
}
