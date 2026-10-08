'use server';
/* 설정 (2h): 업체 정보(상호 · 연락처) · 알림 설정 — 계정은 lib/account-actions, 사업자 정보는 결제 내역 actions 공용 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';

export async function saveCompany(name: string, tel: string) {
  const user = await requirePartner();
  const digits = tel.replace(/\D/g, '');
  if (!name.trim()) return { ok: false as const, error: '상호를 입력해 주세요' };
  if (digits.length < 9 || digits.length > 11) return { ok: false as const, error: '연락처를 확인해 주세요' };
  const db = await getDb();
  await db.update(t.partners).set({ name: name.trim(), tel }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner', 'layout');
  return { ok: true as const };
}

const NOTIFY_KEYS = ['lead', 'result', 'indexed'] as const;
export async function setNotify(key: (typeof NOTIFY_KEYS)[number], on: boolean) {
  const user = await requirePartner();
  if (!NOTIFY_KEYS.includes(key) || typeof on !== 'boolean') return;
  const db = await getDb();
  const [p] = await db.select({ notify: t.partners.notify }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1);
  await db.update(t.partners).set({ notify: { ...p.notify, [key]: on } }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner/settings');
}
