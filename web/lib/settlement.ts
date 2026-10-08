/* 지원형 정산: 파트너가 문의를 계약(금액)으로 바꾸거나 되돌리면 이번 달 정산 줄에 더하고 뺌
 * 달이 끝나면 본사가 "정산 수수료 · n월"로 청구하고 줄에 청구 건을 연결함 (closeSettlement) */
import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';

export async function applyContract(partnerId: string, before: { status: string; amount: number | null }, after: { status: string; amount: number | null }) {
  const db = await getDb();
  const [row] = await db.select({ rate: t.plans.settleRatePct }).from(t.partners).innerJoin(t.plans, eq(t.plans.id, t.partners.planId)).where(eq(t.partners.id, partnerId)).limit(1);
  if (!row?.rate) return;
  const was = before.status === '계약', now = after.status === '계약';
  const dCount = (now ? 1 : 0) - (was ? 1 : 0);
  const dAmt = (now ? after.amount ?? 0 : 0) - (was ? before.amount ?? 0 : 0);
  if (!dCount && !dAmt) return;
  const month = (await today()).slice(0, 7);
  const [cur] = await db.select().from(t.settlements).where(and(eq(t.settlements.partnerId, partnerId), eq(t.settlements.month, month))).limit(1);
  if (cur?.chargeId) return; // 이미 청구한 달은 바꾸지 않음
  if (!cur) {
    const amount = Math.max(0, dAmt);
    await db.insert(t.settlements).values({ partnerId, month, contractCount: Math.max(0, dCount), contractAmount: amount, ratePct: row.rate, fee: Math.round((amount * row.rate) / 100) });
    return;
  }
  await db.update(t.settlements).set({
    contractCount: sql`greatest(0, ${t.settlements.contractCount} + ${dCount})`,
    contractAmount: sql`greatest(0, ${t.settlements.contractAmount} + ${dAmt})`,
    fee: sql`round(greatest(0, ${t.settlements.contractAmount} + ${dAmt}) * ${t.settlements.ratePct} / 100.0)::int`
  }).where(eq(t.settlements.id, cur.id));
}

const nextMonthFirst = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};

/** 지난 달까지의 정산 줄 중 아직 청구 안 한 것 → "정산 수수료 · n월" 청구 건을 만들고 연결 (여러 번 불러도 한 번만) */
export async function closeSettlements() {
  const db = await getDb();
  const month = (await today()).slice(0, 7);
  const open = await db.select({ s: t.settlements, p: t.partners }).from(t.settlements).innerJoin(t.partners, eq(t.partners.id, t.settlements.partnerId))
    .where(and(sql`${t.settlements.month} < ${month}`, sql`${t.settlements.chargeId} is null`));
  for (const { s, p } of open) {
    if (!s.fee) continue;
    const [c] = await db.insert(t.charges).values({
      partnerId: s.partnerId, billedOn: nextMonthFirst(s.month), item: `정산 수수료 · ${Number(s.month.slice(5))}월 경유 계약 ${s.contractCount}건`,
      method: p.payMode === '온라인 결제' ? '온라인 결제' : '계좌 입금', amount: s.fee, state: p.payMode === '온라인 결제' ? '미결제' : '입금 대기', payer: p.payMode === '온라인 결제' ? null : p.name
    }).returning();
    await db.update(t.settlements).set({ chargeId: c.id }).where(eq(t.settlements.id, s.id));
  }
}

export { nextMonthFirst };
