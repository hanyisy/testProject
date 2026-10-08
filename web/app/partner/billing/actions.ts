'use server';
/* 결제 내역 (2g): 세금계산서 발행 요청(사업자 정보 없으면 입력 후 요청) · 온라인 결제 */
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { today } from '@/lib/config';
import { chargeOnline } from '@/lib/adapters/payment';

export type Biz = { name: string; reg: string; email: string };
const REG = /^\d{3}-\d{2}-\d{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ownCharge(chargeId: string) {
  const user = await requirePartner();
  const db = await getDb();
  const [c] = await db.select().from(t.charges).where(and(eq(t.charges.id, chargeId), eq(t.charges.partnerId, user.partnerId))).limit(1);
  return { db, c, user };
}

const bizValid = (b: Biz) => !!b.name.trim() && REG.test(b.reg) && EMAIL.test(b.email.trim());

/** 세금계산서 발행 요청 — 계좌 입금 건만. 사업자 정보가 없으면 needBiz */
export async function requestTax(chargeId: string): Promise<{ ok: true } | { ok: false; needBiz?: true; error?: string }> {
  const { db, c, user } = await ownCharge(chargeId);
  if (!c || c.method !== '계좌 입금') return { ok: false, error: '요청할 수 없는 항목이에요' };
  const [p] = await db.select().from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1);
  if (!p.bizName || !p.taxRegNo || !p.taxEmail) return { ok: false, needBiz: true };
  const [has] = await db.select({ id: t.taxRequests.id }).from(t.taxRequests).where(eq(t.taxRequests.chargeId, chargeId)).limit(1);
  if (!has) await db.insert(t.taxRequests).values({ chargeId, requestedOn: await today() });
  revalidatePath('/partner/billing');
  return { ok: true };
}

/** 사업자 정보 저장 (설정 2h · 요청 창 공용) */
export async function saveBiz(b: Biz) {
  const user = await requirePartner();
  if (!bizValid(b)) return { ok: false as const, error: '상호 · 사업자등록번호(000-00-00000) · 이메일을 확인해 주세요' };
  const db = await getDb();
  await db.update(t.partners).set({ bizName: b.name.trim(), taxRegNo: b.reg, taxEmail: b.email.trim() }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner/settings');
  return { ok: true as const };
}

export async function saveBizAndRequest(chargeId: string, b: Biz) {
  const r = await saveBiz(b);
  if (!r.ok) return r;
  return requestTax(chargeId);
}

export async function clearBiz() {
  const user = await requirePartner();
  const db = await getDb();
  await db.update(t.partners).set({ bizName: null, taxRegNo: null, taxEmail: null }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner/settings');
}

/** 온라인 결제 — 결제 어댑터(컨펌 단계 데모 승인) */
export async function payOnline(chargeId: string) {
  const { db, c } = await ownCharge(chargeId);
  if (!c || c.method !== '온라인 결제' || c.state !== '미결제') return { ok: false as const, error: '결제할 수 없는 항목이에요' };
  /* 두 번 눌러도 한 번만 결제: 미결제 · 진행 표시(confirmedAt) 없는 건을 먼저 잡고, 결제가 안 되면 놓음 */
  const [claimed] = await db.update(t.charges).set({ confirmedAt: new Date() })
    .where(and(eq(t.charges.id, chargeId), eq(t.charges.state, '미결제'), isNull(t.charges.confirmedAt))).returning({ id: t.charges.id });
  if (!claimed) return { ok: false as const, error: '이미 결제를 진행하고 있어요' };
  const r = await chargeOnline({ chargeId, amount: c.amount, orderName: c.item });
  if (!r.ok) { await db.update(t.charges).set({ confirmedAt: null }).where(eq(t.charges.id, chargeId)); return r; }
  await db.update(t.charges).set({ state: '결제 완료', confirmedAt: r.approvedAt, payer: r.method }).where(and(eq(t.charges.id, chargeId), eq(t.charges.state, '미결제')));
  revalidatePath('/partner/billing');
  return { ok: true as const };
}
