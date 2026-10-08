'use server';
/* 문의·정산 (3l): 계좌 입금 확인 · 세금계산서 발행 완료 처리 — 관리팀 이상 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';

export async function confirmDeposit(chargeId: string) {
  const u = await requirePerm('입금 확인 · 세금계산서');
  const db = await getDb();
  const [c] = await db.update(t.charges).set({ state: '입금 확인', confirmedBy: u.id, confirmedAt: new Date() })
    .where(and(eq(t.charges.id, chargeId), eq(t.charges.state, '입금 대기'))).returning();
  if (c) await db.insert(t.auditLogs).values({ userId: u.id, action: '입금 확인', targetType: 'charge', targetId: chargeId, detail: { item: c.item, amount: c.amount } });
  revalidatePath('/admin', 'layout');
}

export async function issueTax(taxId: string) {
  const u = await requirePerm('입금 확인 · 세금계산서');
  const db = await getDb();
  const [x] = await db.update(t.taxRequests).set({ state: '발행 완료', issuedBy: u.id, issuedAt: new Date() })
    .where(and(eq(t.taxRequests.id, taxId), eq(t.taxRequests.state, '요청됨'))).returning();
  if (x) await db.insert(t.auditLogs).values({ userId: u.id, action: '세금계산서 발행 완료', targetType: 'tax', targetId: taxId });
  revalidatePath('/admin', 'layout');
}
