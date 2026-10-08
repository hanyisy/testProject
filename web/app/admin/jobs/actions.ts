'use server';
/* 작업 로그 (3k): 재시도 → 다시 실패하면 제작 담당에게 전달 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';
import { runJob } from '@/lib/adapters/jobs';
import { isUuid } from '@/lib/partners';

export async function retryJob(id: string) {
  const u = await requirePerm('작업 로그');
  if (!isUuid(id)) return;
  const db = await getDb();
  const [j] = await db.select().from(t.jobs).where(eq(t.jobs.id, id)).limit(1);
  if (!j || j.status !== '실패' || j.tries >= 2) return;
  await db.update(t.jobs).set({ status: '재시도 중' }).where(eq(t.jobs.id, id));
  const r = await runJob(j);
  await db.update(t.jobs).set(r.ok ? { status: '성공', tries: j.tries + 1 } : { status: '실패', tries: j.tries + 1, reason: r.reason }).where(eq(t.jobs.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: r.ok ? '작업 재시도 성공' : '작업 재시도 실패', targetType: 'job', targetId: id });
  revalidatePath('/admin', 'layout');
}

export async function forwardJob(id: string) {
  const u = await requirePerm('작업 로그');
  if (!isUuid(id)) return;
  const db = await getDb();
  const [j] = await db.select().from(t.jobs).where(eq(t.jobs.id, id)).limit(1);
  if (!j || j.status !== '실패' || j.tries < 2) return;
  await db.update(t.jobs).set({ status: '제작 담당 전달' }).where(eq(t.jobs.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '제작 담당에게 전달', targetType: 'job', targetId: id, detail: { kind: j.kind, reason: j.reason } });
  revalidatePath('/admin', 'layout');
}
