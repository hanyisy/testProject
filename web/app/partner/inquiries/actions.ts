'use server';
/* 파트너 문의: 상태 변경(계약이면 금액, 바꾸면 "결과 입력 필요"가 풀림) · 메모 · 전화/문자 기록 — 자기 업체 문의만
 * 바뀐 내용은 문의 진행 기록(inquiry_logs)에 남음 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { INQ_ORDER } from '@/lib/partner-app';
import { applyContract } from '@/lib/settlement';

const STATUSES = [...INQ_ORDER, '무산'] as const;

export async function setInquiryStatus(id: string, status: string, amount?: number) {
  const user = await requirePartner();
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUSES.includes(status as never)) return { ok: false };
  const db = await getDb();
  const [before] = await db.select({ status: t.inquiries.status, amount: t.inquiries.amount }).from(t.inquiries).where(and(eq(t.inquiries.id, id), eq(t.inquiries.partnerId, user.partnerId))).limit(1);
  if (!before) return { ok: false };
  const amt = status === '계약' ? Math.max(0, Math.round(amount ?? 0)) : before.amount;
  await db.update(t.inquiries)
    .set({ status: status as '신규', needsResult: false, ...(status === '계약' ? { amount: amt } : {}) })
    .where(and(eq(t.inquiries.id, id), eq(t.inquiries.partnerId, user.partnerId)));
  if (before.status !== status || (status === '계약' && amt !== before.amount)) {
    await db.insert(t.inquiryLogs).values({ inquiryId: id, kind: '상태', text: `${before.status} → ${status}${status === '계약' && amt ? ` · ${amt.toLocaleString('ko-KR')}원` : ''}`, userId: user.id });
  }
  /* 지원형 파트너면 이번 달 정산에 반영 */
  await applyContract(user.partnerId, before, { status, amount: amt });
  revalidatePath('/partner', 'layout');
  return { ok: true };
}

async function own(id: string) {
  const user = await requirePartner();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = await getDb();
  const [q] = await db.select({ id: t.inquiries.id }).from(t.inquiries).where(and(eq(t.inquiries.id, id), eq(t.inquiries.partnerId, user.partnerId))).limit(1);
  return q ? { db, user } : null;
}

export async function addInquiryMemo(id: string, text: string) {
  const x = await own(id);
  const body = text.trim().slice(0, 1000);
  if (!x || !body) return { ok: false as const };
  await x.db.insert(t.inquiryLogs).values({ inquiryId: id, kind: '메모', text: body, userId: x.user.id });
  revalidatePath('/partner/inquiries', 'layout');
  return { ok: true as const };
}

/** 전화 · 문자 버튼을 누르면 기록 (실제 통화 · 발송은 휴대폰에서) */
export async function logContact(id: string, kind: '전화' | '문자') {
  const x = await own(id);
  if (!x) return;
  await x.db.insert(t.inquiryLogs).values({ inquiryId: id, kind, text: kind === '전화' ? '고객에게 전화했어요' : '고객에게 문자를 보냈어요', userId: x.user.id });
  revalidatePath('/partner/inquiries', 'layout');
}
