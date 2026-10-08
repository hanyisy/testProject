/* 지원형 정산: 파트너가 문의를 계약(금액)으로 바꾸거나 되돌리면 이번 달 정산 줄에 더하고 뺌
 * 달이 끝나면 본사가 "정산 수수료 · n월"로 청구하고 줄에 청구 건을 연결함 (closeSettlement) */
import 'server-only';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';

/** 계약으로 치는 상태: 계약 · 완료 (완료로 바꿔도 계약은 그대로 — 수수료가 빠지지 않게) */
export const CONTRACTED = ['계약', '완료'];

export async function applyContract(partnerId: string, inquiryId: string, before: { status: string; amount: number | null }, after: { status: string; amount: number | null }) {
  const db = await getDb();
  const [row] = await db.select({ rate: t.plans.settleRatePct }).from(t.partners).innerJoin(t.plans, eq(t.plans.id, t.partners.planId)).where(eq(t.partners.id, partnerId)).limit(1);
  if (!row?.rate) return;
  const was = CONTRACTED.includes(before.status), now = CONTRACTED.includes(after.status);
  const dCount = (now ? 1 : 0) - (was ? 1 : 0);
  const dAmt = (now ? after.amount ?? 0 : 0) - (was ? before.amount ?? 0 : 0);
  if (!dCount && !dAmt) return;
  /* 고치는 달: 새로 계약하면 이번 달, 이미 계약이던 건(취소 · 금액 변경)은 그 계약을 맺은 달 */
  let month = (await today()).slice(0, 7);
  if (was) {
    const [log] = await db.select({ at: t.inquiryLogs.createdAt }).from(t.inquiryLogs)
      .where(and(eq(t.inquiryLogs.inquiryId, inquiryId), eq(t.inquiryLogs.kind, '상태'), like(t.inquiryLogs.text, '%→ 계약%'))).orderBy(desc(t.inquiryLogs.createdAt)).limit(1);
    const at = log?.at ?? (await db.select({ at: t.inquiries.receivedAt }).from(t.inquiries).where(eq(t.inquiries.id, inquiryId)).limit(1))[0]?.at;
    if (at) month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(at).slice(0, 7);
  }
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

/** 이번 달 월 관리비 청구 — 운영 중 파트너마다 한 건 (계약 시작 전 · 종료 뒤 달은 건너뜀 · 여러 번 불러도 한 번만)
 *  결제 방식: 온라인 결제 업체는 미결제, 그 밖은 계좌 입금(입금자명 = 상호) */
export async function billMonthly() {
  const db = await getDb();
  const day = await today();
  const month = day.slice(0, 7), m = Number(month.slice(5));
  const item = `월 관리비 · ${m}월`;
  const rows = await db.select({ p: t.partners, fee: t.plans.monthlyFee }).from(t.partners).innerJoin(t.plans, eq(t.plans.id, t.partners.planId)).where(eq(t.partners.status, '운영 중'));
  for (const { p, fee } of rows) {
    if (!fee || (p.startedAt && p.startedAt.slice(0, 7) > month) || (p.endedAt && p.endedAt.slice(0, 7) < month)) continue;
    const [has] = await db.select({ id: t.charges.id }).from(t.charges).where(and(eq(t.charges.partnerId, p.id), eq(t.charges.item, item), sql`${t.charges.billedOn} >= ${month + '-01'}`, sql`${t.charges.billedOn} < ${nextMonthFirst(month)}`)).limit(1);
    if (has) continue;
    const online = p.payMode === '온라인 결제';
    await db.insert(t.charges).values({ partnerId: p.id, billedOn: `${month}-01`, item, method: online ? '온라인 결제' : '계좌 입금', amount: fee, state: online ? '미결제' : '입금 대기', payer: online ? null : p.name });
  }
}

export { nextMonthFirst };
