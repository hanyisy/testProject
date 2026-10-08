'use server';
/* 파트너 문의 상태 변경 — 자기 업체 문의만. 계약이면 금액 함께, 바꾸면 "결과 입력 필요"가 풀림 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { INQ_ORDER } from '@/lib/partner-app';

const STATUSES = [...INQ_ORDER, '무산'] as const;

export async function setInquiryStatus(id: string, status: string, amount?: number) {
  const user = await requirePartner();
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUSES.includes(status as never)) return { ok: false };
  const db = await getDb();
  await db.update(t.inquiries)
    .set({ status: status as '신규', needsResult: false, ...(status === '계약' ? { amount: Math.max(0, Math.round(amount ?? 0)) } : {}) })
    .where(and(eq(t.inquiries.id, id), eq(t.inquiries.partnerId, user.partnerId)));
  revalidatePath('/partner', 'layout');
  return { ok: true };
}
